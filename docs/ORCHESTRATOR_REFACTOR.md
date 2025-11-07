# Orchestrator.run() Refactoring Plan

## Current Problems

1. **Too Long**: The `run()` method is ~500 lines
2. **Deeply Nested**: 4-5 levels of nesting with complex control flow
3. **Duplicated Error Handling**: Same error handling code repeated 3 times
4. **Mixed Concerns**: User input, Instructor processing, Worker processing, error recovery all in one method
5. **Hard to Test**: Cannot test individual parts in isolation
6. **Hard to Read**: Difficult to understand the overall flow

## Current Structure

```
run()
  ├─ Outer loop: Session management
  │   ├─ Wait for user input
  │   ├─ Process initial instruction
  │   │   ├─ Error handling (duplicated)
  │   │   └─ Status display
  │   ├─ Handle needsCorrection
  │   │   ├─ Error handling (duplicated)
  │   │   └─ Status display
  │   └─ Inner loop: Instructor-Worker conversation
  │       ├─ Process Worker instruction
  │       │   └─ Timeout handling
  │       ├─ Process Instructor review
  │       │   ├─ Error handling (duplicated)
  │       │   └─ Status display
  │       └─ Handle timeout response
  └─ Cleanup
```

## Refactored Structure

### Extract Methods

1. **`handleError(error, context)`** - Centralized error handling
2. **`callInstructor(message, context)`** - Call Instructor with streaming
3. **`callWorker(instruction, model)`** - Call Worker with streaming and timeout
4. **`handleNeedsCorrection(response)`** - Handle correction flow
5. **`getUserInstruction(isFirstRun, initialInstruction)`** - Get user input
6. **`processInstructorWorkerLoop(instructorResponse)`** - Main conversation loop

### New Flow

```typescript
async run(initialInstruction?: string): Promise<void> {
  this.displayWelcome();

  try {
    let instructorResponse = null;
    let isFirstRun = true;

    while (true) {
      // 1. Get user instruction (if needed)
      if (!instructorResponse?.shouldContinue) {
        const userInstruction = await this.getUserInstruction(isFirstRun, initialInstruction);
        if (!userInstruction) break;
        isFirstRun = false;

        // 2. Initial Instructor processing
        instructorResponse = await this.callInstructor(userInstruction, 'user-input');
        if (!instructorResponse) continue;

        // 3. Handle correction if needed
        instructorResponse = await this.handleNeedsCorrection(instructorResponse);
        if (!instructorResponse) continue;
      }

      // 4. Instructor-Worker conversation loop
      instructorResponse = await this.processInstructorWorkerLoop(instructorResponse);
    }
  } catch (error) {
    this.handleFatalError(error);
  } finally {
    this.cleanup();
  }
}
```

## Benefits

1. **Easier to Read**: Main flow is ~30 lines instead of 500
2. **Easier to Test**: Each method can be tested independently
3. **No Duplication**: Error handling in one place
4. **Clear Separation**: Each method has one responsibility
5. **Easier to Modify**: Changes to one part don't affect others

## Implementation Steps

1. Extract `handleError()` - centralize error handling
2. Extract `callInstructor()` - Instructor API call with streaming
3. Extract `callWorker()` - Worker API call with streaming and timeout
4. Extract `handleNeedsCorrection()` - correction flow
5. Extract `getUserInstruction()` - user input handling
6. Extract `processInstructorWorkerLoop()` - conversation loop
7. Simplify `run()` method using extracted methods
8. Test refactored code
