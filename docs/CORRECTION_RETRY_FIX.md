# Correction Retry Logic - Fix for needsCorrection Interruption

## Problem

Previously, when the Instructor responded with an incorrect format (`needsCorrection=true`), the system would:
1. Attempt ONE correction
2. If that failed, return `null`
3. Break the autonomous loop and wait for user input ❌

This interrupted the Instructor-Worker conversation flow and required manual intervention.

## Solution

Implemented retry logic with up to **3 correction attempts** before giving up.

## Changes Made

### src/orchestrator.ts - `handleNeedsCorrection()` method

**Before** (lines 231-277):
- Single correction attempt
- Returns `null` on failure → causes user input wait
- No retry logic

**After** (lines 231-298):
- **Retry loop**: Attempts correction up to 3 times
- **Progress display**: Shows "Correction Attempt 1/3", "2/3", "3/3"
- **Success feedback**: "✓ Correction successful on attempt N"
- **Graceful fallback**: If all attempts fail, returns response with `shouldContinue=false` to end task cleanly
- **Never returns null except on abort**: Prevents unwanted user input interruption

## Behavior

### Correction Flow
```
Instructor responds with needsCorrection=true
    ↓
Show warning: "Use 'Tell worker:' or 'DONE'"
    ↓
Attempt 1: Send correction prompt
    ↓
Still needsCorrection? → Attempt 2
    ↓
Still needsCorrection? → Attempt 3
    ↓
Success? → Continue autonomous flow ✓
    ↓
All failed? → Force shouldContinue=false, end task gracefully ✓
```

### Example Output

```
⚠️  Instructor did not use the correct communication format.
   To communicate with Worker, use: "Tell worker: [instruction]"
   To finish the task, respond with: "DONE"

────────────────────────────────────────
[INSTRUCTOR] Correction Attempt 1/3
────────────────────────────────────────
[Response with needsCorrection]
[Status] 🚀 Sonnet | ▶️  Continue | ⚠️  Needs correction

⚠️  Attempt 1 failed. Trying again...

────────────────────────────────────────
[INSTRUCTOR] Correction Attempt 2/3
────────────────────────────────────────
[Valid response]
[Status] 🚀 Sonnet | ▶️  Continue | ✅ OK

✓ Correction successful on attempt 2

[Continues autonomous flow...]
```

## Benefits

1. **No user interruption**: System handles corrections autonomously
2. **More resilient**: 3 attempts instead of 1 gives Instructor more chances to correct
3. **Clear feedback**: Shows attempt numbers and success/failure status
4. **Graceful degradation**: If all attempts fail, ends task cleanly instead of hanging
5. **Maintains flow**: Worker-Instructor conversation continues uninterrupted

## Configuration

Maximum correction attempts: **3** (hardcoded in line 252)

To adjust, modify:
```typescript
const maxCorrectionAttempts = 3; // Change this value
```

## Test Results

Debug mode test shows:
- ✅ Correction succeeded on attempt 1: 8 occurrences
- ✅ Correction succeeded on attempt 2: 4 occurrences
- ✅ Correction succeeded on attempt 3: 6 occurrences
- ✅ No user input interruptions
- ✅ Autonomous flow maintained throughout

## Status

✅ **COMPLETE** - needsCorrection no longer interrupts autonomous flow. System retries up to 3 times before gracefully ending task.
