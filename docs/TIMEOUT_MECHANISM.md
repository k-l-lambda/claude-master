# Worker Timeout Mechanism

## Overview
The system implements a 60-second inactivity timeout for Worker responses. If the Worker doesn't produce any new tokens for 60 seconds during streaming, the response is automatically terminated and the Instructor is notified.

## How It Works

### Timeout Detection
- **Monitored Period**: 60 seconds (60,000 milliseconds)
- **Detection Granularity**: Checked every 1 second
- **What's Monitored**: Time since last token received from Worker
- **Trigger**: If no new tokens for 60+ seconds, timeout is triggered

### Timeout Flow

1. **Worker starts streaming** response to Instructor's instruction
2. **Orchestrator tracks** the timestamp of the last received token
3. **Every second**, orchestrator checks: `(current_time - last_token_time) > 60s`
4. **If timeout detected**:
   - Abort the Worker's streaming request
   - Display warning message to user
   - Collect any partial response from Worker
   - Forward timeout message to Instructor

### Message Format to Instructor

When timeout occurs, Instructor receives a message in this format:
```
Worker says: [partial response] [TIMEOUT after 60s]
```

Or if no response was received:
```
Worker says: [No response received - TIMEOUT after 60s]
```

**Note**: The "Worker says:" prefix is automatically added by `processWorkerResponse()`. The `[TIMEOUT after 60s]` marker appears at the end, allowing Instructor to first see the actual content before noticing it timed out.

This allows the Instructor to:
- Read any partial output Worker produced first
- Understand that Worker timed out (marked at the end)
- Decide on next action (retry, modify instruction, etc.)

## Implementation Details

### Orchestrator (src/orchestrator.ts:292-433)

```typescript
// Track last token time
let lastTokenTime = Date.now();
const TIMEOUT_MS = 60000; // 60 seconds
let workerTimedOut = false;

// Start timeout check interval
const timeoutCheckInterval = setInterval(() => {
  const timeSinceLastToken = Date.now() - lastTokenTime;
  if (timeSinceLastToken > TIMEOUT_MS) {
    workerTimedOut = true;
    if (this.currentAbortController) {
      this.currentAbortController.abort(); // Cancel the stream
    }
    clearInterval(timeoutCheckInterval);
  }
}, 1000); // Check every second

// In streaming callback
(chunk) => {
  lastTokenTime = Date.now(); // Reset timeout on each token
  // ... display chunk
}

// In catch block
if (workerTimedOut && error.name === 'AbortError') {
  // Pass timeout message to Instructor
  // Note: processWorkerResponse will add "Worker says:" prefix
  const timeoutMessage = workerTextBuffer
    ? `${workerTextBuffer} [TIMEOUT after 60s]`
    : '[No response received - TIMEOUT after 60s]';

  await this.instructor.processWorkerResponse(timeoutMessage, ...);
}
```

### Key Features

1. **Non-blocking**: Uses `setInterval` to check timeout without blocking
2. **Token-based**: Resets timer on every token, not just at start
3. **Graceful**: Captures partial response before aborting
4. **Informative**: Tells Instructor what happened and what was received
5. **Clean**: Always clears interval in both success and error paths

## Example Scenarios

### Scenario 1: Worker Gets Stuck

```
Instructor: "Tell worker: Run a complex analysis on all files"

Worker: [Starts streaming]
  "I'll analyze the files. Let me start with..."
  [60 seconds pass with no new tokens]

System: ⏱️ Worker response timed out (no activity for 60 seconds)

Instructor receives:
  "Worker says: I'll analyze the files. Let me start with...
   [TIMEOUT after 60s]"

Instructor: [Thinking about timeout]
  "Worker timed out during analysis. Let me simplify the instruction."
  "Tell worker: Just list the files first, then we'll analyze."
```

### Scenario 2: Worker Completes Before Timeout

```
Instructor: "Tell worker: Read file.txt"

Worker: [Starts streaming]
  "Here are the contents of file.txt: ..."
  [Response completes in 5 seconds]

System: [No timeout, normal flow continues]

Instructor receives:
  "Worker says: Here are the contents of file.txt: ..."

[Normal conversation continues]
```

### Scenario 3: Worker Times Out with No Output

```
Instructor: "Tell worker: Execute long operation"

Worker: [Starts streaming but produces no tokens]
  [60 seconds pass]

System: ⏱️ Worker response timed out (no activity for 60 seconds)

Instructor receives:
  "Worker says: [No response received - TIMEOUT after 60s]"

Instructor: [Decides on action]
  "Worker completely timed out with no output. Let me try a
   different approach."
```

## Benefits

1. **Prevents Hanging**: System won't wait indefinitely for stuck Worker
2. **User Feedback**: Clear indication that timeout occurred
3. **Partial Results**: Captures and forwards any partial output
4. **Automatic Recovery**: Instructor can handle timeout and retry
5. **Resource Management**: Frees up resources from stuck requests
6. **Debugging Aid**: Timeout indicates potential issues with instructions or model

## Configuration

Currently hardcoded values:
- **TIMEOUT_MS**: 60000 (60 seconds)
- **CHECK_INTERVAL**: 1000 (1 second)

To modify timeout duration, change `TIMEOUT_MS` in `src/orchestrator.ts:294`.

## Limitations

1. **Only for Worker**: Timeout detection only applies to Worker, not Instructor
2. **Token-based**: If Worker is thinking but not outputting, it will timeout
3. **Fixed Duration**: Timeout is not configurable per instruction
4. **No Resume**: Once timed out, cannot resume the same stream

## Future Enhancements

Potential improvements:
1. Configurable timeout duration (per instruction or globally)
2. Timeout for Instructor responses as well
3. Warning before timeout (e.g., at 45 seconds)
4. Retry mechanism with exponential backoff
5. Different timeout values for different models
6. Timeout history/statistics
7. User confirmation before aborting long operations

## Testing

To test the timeout mechanism:

```bash
# Build the project
npm run build

# Run with an instruction that causes Worker to hang
# (e.g., infinite loop, complex operation, etc.)

# Wait 60 seconds without new tokens

# Expected behavior:
# - Warning displayed after 60s
# - Instructor receives timeout message
# - System continues with Instructor's response
```

## Troubleshooting

### Timeout occurs too frequently
- Worker may need simpler instructions
- Check if Worker model is overloaded
- Consider increasing TIMEOUT_MS value

### Timeout doesn't trigger when expected
- Check if Worker is actually streaming tokens (even slowly)
- Verify AbortController is properly connected
- Check console for any error messages

### Partial response is empty
- Worker may have produced no output before timeout
- This is normal for completely stuck operations
- Message will show "[No response received]"

## Summary

The Worker timeout mechanism provides a safety net against indefinitely hanging Worker responses. It:
- Detects when Worker stops producing tokens for 60 seconds
- Automatically aborts the streaming request
- Forwards partial results to Instructor
- Allows the system to continue operating normally

This ensures robust operation even when Worker encounters issues or gets stuck on difficult instructions.
