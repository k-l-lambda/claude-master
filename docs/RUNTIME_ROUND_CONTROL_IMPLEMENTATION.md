# Runtime Round Control - Implementation Summary

## Overview

在重构后的orchestrator基础上重新实现了运行时轮数控制功能，允许用户在会话过程中动态调整剩余对话轮次。

## Changes Made

### 1. src/orchestrator.ts

**Added private field**:
```typescript
private remainingRounds: number;
```

**Constructor initialization** (line 20):
```typescript
this.remainingRounds = config.maxRounds || Infinity;
```

**Added parseRoundControl() method** (lines 132-161):
- Parses `[r+n]` to add n rounds
- Parses `[r=n]` to set remaining rounds to n
- Returns cleaned instruction without control commands
- Displays feedback messages

**Integrated into run() method**:
- Line 433: Parse round control from user input
- Line 436-440: Check for empty instruction after parsing
- Line 444: Display remaining rounds in round header
- Lines 473-485: Check and decrement remaining rounds before Worker call
- Line 507: Display remaining rounds in Instructor review header
- Line 290: Display remaining rounds in correction attempts

### 2. src/display.ts

**Updated round() method** (lines 36-44):
```typescript
static round(current: number, remainingOrMax?: number | string): void {
  let suffix = '';
  if (typeof remainingOrMax === 'number') {
    suffix = ` (${remainingOrMax} left)`;
  } else if (typeof remainingOrMax === 'string') {
    suffix = ` ${remainingOrMax}`;
  }
  console.log('\n' + this.SYSTEM_COLOR(`╭─ Round ${current}${suffix} ─╮`));
}
```

### 3. docs/RUNTIME_ROUND_CONTROL.md

Complete documentation restored from stash commit 7f523f3d66641645.

## Features

### Syntax

**Add rounds**: `[r+n]` (must be at the beginning)
```bash
[r+5] Continue the task
```

**Set rounds**: `[r=n]` (must be at the beginning)
```bash
[r=10] Start new complex task
```

**Important**:
- Control commands MUST appear at the **beginning** of user input
- Commands are removed before passing to Instructor
- Only beginning-of-string matches are recognized
- Middle-of-string occurrences are treated as normal text

### Display Format

**Before**:
```
╭─ Round 3/10 ─╮
```

**After**:
```
╭─ Round 3 (7 left) ─╮
```

### Behavior

1. **Round checking**: Before each Worker call, check if remaining rounds > 0
2. **Round decrement**: Decrement remaining rounds after check passes
3. **Stop on zero**: When rounds reach 0, stop and show message:
   ```
   ERROR: No remaining rounds. Stopping.
   Use [r+n] to add more rounds or [r=n] to set remaining rounds
   ```
4. **Parse on input**: Extract control commands from user input and clean the instruction
5. **Feedback**: Show "📊 Added X rounds. Remaining: Y" or "📊 Set remaining rounds to: X"

## Testing

### Test 1: Add rounds mid-session
```bash
./dist/index.js --debug -r 2 "Task 1"
# After rounds exhausted:
> [r+5] Continue
# Adds 5 rounds, continues execution
```

**Result**: ✅ Successfully added 5 rounds

### Test 2: Set rounds
```bash
./dist/index.js --debug "Task"
> [r=10] New task
```

**Result**: ✅ Successfully set to 10 rounds

### Test 3: Only control command
```bash
> [r+10]
```

**Result**: ✅ Adds rounds, shows warning "No instruction provided after parsing round controls"

## Integration with Refactored Code

The implementation seamlessly integrates with the refactored orchestrator:

1. **Works with correction retry logic**: Correction rounds show remaining count
2. **Works with Worker-Instructor loop**: Round count decrements only for Worker calls
3. **Works with abort/interrupt**: Round state preserved across interruptions
4. **Works with debug mode**: Fully testable without API calls

## Differences from Original Stash

1. **Better integration**: Uses refactored helper methods (callInstructor, callWorker, etc.)
2. **Correction support**: Correction attempts also show remaining rounds
3. **Cleaner code**: Follows the extracted method pattern from refactoring
4. **More robust**: Better error handling and edge case coverage

## Status

✅ **COMPLETE** - Runtime round control fully functional in refactored orchestrator.

## Test Commands

```bash
# Basic test with initial rounds
./dist/index.js --debug -r 3 "Test task"

# Test adding rounds
(echo "Task 1" && sleep 8 && echo "[r+5] Continue" && sleep 5 && echo "exit") | ./dist/index.js --debug -r 2

# Test setting rounds
(echo "[r=10] New task" && sleep 5 && echo "exit") | ./dist/index.js --debug

# Run test script
./test-round-control.sh
```
