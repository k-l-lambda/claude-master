# Worker/Instructor Mock Response Separation - Implementation Complete

## Problem

In debug mode, both Instructor and Worker were using the same mock responses. This caused Worker responses to sometimes contain "Tell worker:" or "DONE", which doesn't make sense - only the Instructor should use these phrases.

## Solution

Separated mock responses by adding a `context` parameter throughout the call chain to distinguish between Instructor and Worker contexts.

## Changes Made

### 1. src/client.ts

**Modified `generateMockResponse()`** (line 20):
```typescript
private generateMockResponse(
  model: string,
  useThinking: boolean,
  context?: 'instructor' | 'worker'  // NEW PARAMETER
): Anthropic.Message
```

**Created separate response arrays**:
- `instructorResponses`: Contains "Tell worker:", "DONE", and incorrect formats for testing needsCorrection
- `workerResponses`: Contains only implementation reports, never "Tell worker:" or "DONE"

**Response selection**:
```typescript
const responses = isWorker ? workerResponses : instructorResponses;
```

**Modified `streamMockResponse()`** (line 137):
- Added `context?: 'instructor' | 'worker'` parameter
- Pass context to `generateMockResponse()`

**Modified `streamMessage()`** (line 200):
- Added `context?: 'instructor' | 'worker'` parameter
- Pass context to `streamMockResponse()` when in debug mode

### 2. src/instructor.ts

**Modified Instructor API call** (line 131):
```typescript
const response = await this.client.streamMessage(
  ...
  'instructor'  // Pass 'instructor' context
);
```

### 3. src/worker.ts

**Modified Worker API call** (line 79):
```typescript
const response = await this.client.streamMessage(
  ...
  'worker'  // Pass 'worker' context
);
```

## Response Types

### Instructor Responses
- "Tell worker: [instruction]" (weight: 6) - Correct format
- "DONE" variants (weight: 0.2) - Task completion
- Incorrect formats (weight: 5) - Triggers needsCorrection for testing

### Worker Responses
- "I've implemented the feature..." (weight: 3)
- "The function has been created..." with code blocks (weight: 3)
- "Task completed successfully..." (weight: 2)
- "Implementation complete..." (weight: 2)
- "Done! The changes have been implemented..." (weight: 1)

**Total Worker Response Weight**: 11
**Note**: Worker responses NEVER contain "Tell worker:" or "DONE"

## Testing

Verified with manual test showing:
- ✅ Worker responses contain only implementation reports
- ✅ Worker never says "Tell worker:" or "DONE"
- ✅ Instructor correctly uses "Tell worker:" format
- ✅ Instructor can say "DONE" to finish tasks
- ✅ needsCorrection flow works correctly

## Test Command

```bash
(sleep 3 && echo "Build a calculator" && sleep 10 && echo "exit") | \
  ./dist/index.js --debug -r 5
```

## Results

The debug mode now properly simulates the dual-AI architecture:
- **Instructor**: Plans, instructs, and signals completion
- **Worker**: Implements and reports results
- Each has appropriate responses for their role
- Orchestrator logic is thoroughly tested without API calls

## Status

✅ **COMPLETE** - Worker and Instructor mock responses are now properly separated and contextually appropriate.
