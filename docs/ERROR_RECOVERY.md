# Error Recovery Mechanism

## Problem

The system can encounter three types of errors:

1. **API Validation Errors**: When streaming API responses contain temporary fields like `partial_json`
2. **Terminal I/O Errors**: When terminal operations fail (setRawMode, readline, etc.)
3. **Empty Content Errors**: When messages have no valid content

## Problem 1: API Validation Errors

### Root Cause

When streaming API responses, the Anthropic SDK returns content blocks that may contain temporary fields like `partial_json` in `tool_use` blocks. If these blocks are saved directly to conversation history and sent back to the API, it causes validation errors:

```
400 {"error":{"message":"messages.9.content.1.tool_use.partial_json: Extra inputs are not permitted"}}
```

During streaming:
1. Tool use blocks accumulate input via `partial_json` field
2. At `content_block_stop`, this is parsed into `input` field
3. However, if errors occur or abort happens, `partial_json` may remain
4. When we push `response.content` to conversation history, these temporary fields are included
5. Sending messages with `partial_json` back to API causes 400 errors

### Solution

#### 1. Content Sanitization

Added `sanitizeContent()` method in both `InstructorManager` and `WorkerManager`:

```typescript
private sanitizeContent(content: any[]): any[] {
  const cleaned = content.map(block => {
    if (block.type === 'tool_use') {
      // Remove partial_json and other streaming-specific fields
      const { partial_json, ...cleanBlock } = block;
      // Ensure input exists even if partial_json wasn't fully parsed
      if (!cleanBlock.input) {
        cleanBlock.input = {};
      }
      return cleanBlock;
    }
    return block;
  }).filter(block => {
    // Filter out empty text blocks
    if (block.type === 'text') {
      return block.text && block.text.trim().length > 0;
    }
    return true;
  });

  // Ensure we have at least some content
  if (cleaned.length === 0) {
    throw new Error('Cannot add message with empty content to conversation history');
  }

  return cleaned;
}
```

This method:
- Removes `partial_json` field from tool_use blocks
- Ensures `input` field exists (empty object if missing)
- Filters out empty text blocks
- Throws error if no valid content remains
- Leaves other block types unchanged

#### 2. Apply Sanitization

All places where `response.content` is pushed to conversation history now use sanitization:

**instructor.ts:**
```typescript
this.conversationHistory.push({
  role: 'assistant',
  content: this.sanitizeContent(response.content),
});
```

**worker.ts:**
```typescript
this.conversationHistory.push({
  role: 'assistant',
  content: this.sanitizeContent(response.content),
});
```

#### 3. Error Recovery

Added graceful error handling in `orchestrator.ts` for API validation errors:

```typescript
} catch (error: any) {
  if (error.name === 'AbortError' || error.message?.includes('aborted')) {
    // Interruption already handled
  } else if (error.status === 400 && error.message?.includes('Extra inputs are not permitted')) {
    // API validation error - likely due to malformed messages
    Display.error('API Error: Invalid message format detected');
    Display.system('   This usually happens due to streaming artifacts in conversation history.');
    Display.system('   The conversation history has been sanitized. Please try again.');
    Display.newline();

    // Don't throw - let user continue with next instruction
    instructorResponse = null;
    continue;
  } else {
    throw error; // Re-throw other errors
  }
}
```

Error recovery is applied at:
1. Initial user instruction processing
2. Correction prompt processing
3. Worker instruction processing + Instructor review

## Problem 2: Terminal I/O Errors

### Root Cause

The error "setRawMode EIO" occurs when trying to set raw mode on stdin when:
1. stdin is not a TTY (non-interactive environment)
2. The terminal has been closed or disconnected
3. stdin has been redirected from a file or pipe
4. Multiple setRawMode calls fail due to state changes

### Solution

#### 1. Wrap setRawMode Calls

All `setRawMode()` calls are now wrapped in try-catch blocks:

```typescript
private setupKeyHandler(): void {
  if (process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(true);
      process.stdin.on('data', (data) => {
        // ESC key handler
      });
    } catch (error) {
      // If setRawMode fails, silently continue without ESC key support
      console.warn('⚠️  Raw mode unavailable - ESC key interrupt disabled');
    }
  }
}
```

Applied at:
- Initial setup in `setupKeyHandler()`
- Disabling raw mode in `waitForUserInput()`
- Re-enabling raw mode after user input
- Cleanup in `cleanup()`

#### 2. Better Error Messages

Added specific error handling for EIO errors:

```typescript
} catch (error) {
  // Special handling for terminal I/O errors
  if (error instanceof Error && error.message?.includes('EIO')) {
    Display.error(`Terminal I/O error: ${error.message}`);
    Display.system('   This usually happens when the terminal is disconnected or stdin is redirected.');
    Display.system('   The application will now exit.');
  } else {
    Display.error(`Orchestration failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  throw error;
}
```

## Problem 3: Empty Content Errors

### Root Cause

The error "all messages must have non-empty content" occurs when:
1. An AI response contains only empty text blocks
2. A response is aborted before any content is generated
3. Tool execution produces no output and no text
4. Sanitization removes all content blocks (all were empty or invalid)

### Solution

#### 1. Input Validation

Added validation in `processUserInput()`, `processWorkerResponse()`, and `processInstruction()`:

```typescript
async processUserInput(userMessage: string, ...): Promise<InstructorResponse> {
  // Validate message is not empty
  if (!userMessage || userMessage.trim().length === 0) {
    throw new Error('Cannot process empty user message');
  }

  this.conversationHistory.push({
    role: 'user',
    content: userMessage,
  });
  // ...
}
```

#### 2. Content Filtering

Enhanced `sanitizeContent()` to filter empty blocks and validate final result:

```typescript
.filter(block => {
  // Filter out empty text blocks
  if (block.type === 'text') {
    return block.text && block.text.trim().length > 0;
  }
  return true;
});

// Ensure we have at least some content
if (cleaned.length === 0) {
  throw new Error('Cannot add message with empty content to conversation history');
}
```

#### 3. Error Recovery

Added graceful error handling for empty content errors:

```typescript
else if (error.status === 400 && error.message?.includes('all messages must have non-empty content')) {
  Display.error('API Error: Cannot send empty message');
  Display.system('   This usually happens when a response contains no text or tools.');
  Display.system('   Please try again with a new instruction.');
  Display.newline();

  instructorResponse = null;
  continue;
}
else if (error.message?.includes('Cannot add message with empty content') || error.message?.includes('Cannot process empty')) {
  Display.error('Cannot process empty content');
  Display.system('   The AI response contained no valid content.');
  Display.system('   Skipping this round and continuing...');
  Display.newline();

  instructorResponse.shouldContinue = false;
  break;
}
```

## Benefits

1. **Prevents 400 errors** - No more `partial_json` validation failures
2. **Prevents EIO crashes** - Terminal operations fail gracefully
3. **Prevents empty message errors** - All content is validated before sending
4. **Graceful recovery** - User can continue after errors without restarting
5. **Clear feedback** - User understands what went wrong and why
6. **Automatic cleanup** - Conversation history is always in valid state
7. **Non-interactive support** - Works in environments without TTY

## Testing

1. Run normal conversations - should work as before
2. Interrupt during tool execution - should not cause errors
3. Timeout scenarios - should recover gracefully
4. Multiple rounds with tools - no accumulation of invalid fields
5. Non-TTY environments - should work without raw mode features
6. Terminal disconnect - should show clear error message
7. Empty response handling - should detect and skip gracefully

## Files Modified

- `src/instructor.ts` - Added sanitizeContent() with empty filtering, input validation
- `src/worker.ts` - Added sanitizeContent() with empty filtering, input validation
- `src/orchestrator.ts` - Added error recovery for all three error types
- `docs/ERROR_RECOVERY.md` - This documentation

## Related

- See `DONE_MARKDOWN_FIX.md` for DONE detection improvements
- See `TERMINAL_OUTPUT.md` for display enhancements
