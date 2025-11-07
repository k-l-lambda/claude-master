# Debug Mode Documentation

## Overview

Debug mode allows you to test the orchestrator logic without making actual API calls to Claude. Instead, it generates mock responses that simulate different scenarios, including correct formats, incorrect formats, and edge cases.

## Usage

Enable debug mode with the `--debug` flag:

```bash
# Run with debug mode
./dist/index.js --debug "Test the orchestrator"

# Or without initial instruction
./dist/index.js --debug
```

When debug mode is enabled:
- ✅ No API key required
- ✅ No API calls made
- ✅ Mock responses generated instantly
- ✅ Simulates streaming with delays
- ✅ Tests all orchestrator logic paths

## Mock Response Types

The debug mode generates weighted random responses:

### Correct Formats (Weight: 3 each)
1. **Tell Worker responses**:
   ```
   I understand the task. Let me instruct the Worker to proceed.

   Tell worker: Please implement the requested feature.
   ```

2. **Worker instructions**:
   ```
   Let me analyze this. The Worker should handle the implementation.

   Tell worker: Create a function to solve this problem.
   ```

### DONE Responses (Weight: 2 each)
3. **Plain DONE**:
   ```
   This looks good. The task is complete.

   DONE
   ```

4. **Markdown DONE**:
   ```
   All requirements have been satisfied.

   **DONE**
   ```

5. **DONE with code block**:
   ```
   Here's how to run it:
   ```bash
   npm start
   ```

   DONE
   ```

### Incorrect Formats (Weight: 2 each) - Triggers needsCorrection
6. **Missing format**:
   ```
   I think we should implement this feature using TypeScript.
   It would be better for type safety.
   ```

7. **Incomplete thought**:
   ```
   This is a good approach. Let me think about how to
   proceed with the implementation.
   ```

8. **Conversational** (Weight: 1):
   ```
   I've reviewed the code and it looks mostly correct,
   but there might be some edge cases to consider.
   ```

## What Gets Tested

Debug mode helps you test:

1. **needsCorrection Flow**
   - Responses without "Tell worker:" or "DONE"
   - Correction prompting
   - Multiple correction attempts
   - Recovery after correction

2. **DONE Detection**
   - Plain "DONE"
   - Markdown formatted "DONE" (**DONE**, __DONE__)
   - DONE after code blocks
   - DONE with punctuation

3. **Error Recovery**
   - Empty content handling
   - Interrupt handling (ESC key)
   - Timeout simulation (can be added)

4. **Conversation Flow**
   - User → Instructor → Worker → Instructor loops
   - Multiple rounds
   - Session management

## Features Simulated

### Streaming
- Thinking chunks streamed in 10-char segments (20ms delay)
- Text chunks streamed in 5-char segments (30ms delay)
- Realistic typing effect

### Response Structure
- Thinking blocks (if enabled)
- Text blocks
- Proper content types
- Valid message format

## Example Session

```bash
$ ./dist/index.js --debug "Test orchestrator"

⚙️  DEBUG MODE ENABLED
   Using mock API responses instead of real Claude API
   This is for testing orchestrator logic only

Starting dual-AI orchestration system
Instructor Model: claude-sonnet-4-5-20250929
Worker Default Model: claude-sonnet-4-5-20250929
Press ESC to pause and give instructions

╭─ Round 1 ─╮

────────────────────────────────────────────────────────────────────────────────
[INSTRUCTOR] Processing User Instruction
────────────────────────────────────────────────────────────────────────────────

│ User Instruction: Test orchestrator

[DEBUG MODE] Generating mock response instead of calling API

Thinking...
Mock thinking: Analyzing the request and determining the appropriate response format.

Response:
Let me analyze this. The Worker should handle the implementation.

Tell worker: Create a function to solve this problem.

[Status] 🚀 Sonnet | ▶️  Continue | ✅ OK
```

## Limitations

Debug mode does NOT simulate:
- ❌ Tool use (file operations, git commands)
- ❌ Actual code execution
- ❌ Real AI reasoning
- ❌ Context-aware responses
- ❌ Long conversations (responses are random)

## Use Cases

### 1. Test Orchestrator Logic
Test the flow without consuming API quota:
```bash
./dist/index.js --debug "Test task" -r 10
```

### 2. Test Error Handling
Run multiple times to trigger different response types and test error recovery.

### 3. Test needsCorrection Flow
Since ~20% of responses will be incorrect format, you'll frequently see the correction flow in action.

### 4. Test UI/Display
Verify that status displays, colors, and formatting work correctly.

### 5. Rapid Iteration
Quickly test changes to orchestrator logic without waiting for real API calls.

## Debug Logging

Debug mode includes additional console logging:

```
[DEBUG MODE] Generating mock response instead of calling API
[DEBUG] handleNeedsCorrection called
[DEBUG] response: {"needsCorrection":true,"shouldContinue":true,"instruction":""}
[DEBUG] needsCorrection is true, showing warning
```

## Customizing Mock Responses

To customize the mock responses, edit `src/client.ts` in the `generateMockResponse()` method:

```typescript
const responses = [
  {
    weight: 3,
    text: 'Your custom response...'
  },
  // Add more responses
];
```

Higher weight = more likely to be selected.

## Tips

1. **Use with maxRounds**: Limit iterations for faster testing
   ```bash
   ./dist/index.js --debug -r 5
   ```

2. **Test specific scenarios**: Modify weights in code to test specific cases

3. **Combine with other flags**: Debug mode works with all other options
   ```bash
   ./dist/index.js --debug --no-thinking -r 3
   ```

4. **Exit anytime**: Type "exit" at any prompt to quit

## Troubleshooting

**Q: Why do I keep getting needsCorrection?**
A: This is expected! ~20% of mock responses are intentionally incorrect to test the correction flow.

**Q: Can I make all responses correct?**
A: Yes, set weight=0 for incorrect format responses in `src/client.ts`.

**Q: Does debug mode test Worker responses?**
A: Yes, both Instructor and Worker use the same mock response generator.

**Q: Can I add custom test cases?**
A: Yes, add them to the `responses` array in `generateMockResponse()`.
