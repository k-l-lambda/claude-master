# Debug Mode Implementation Summary

## 🎯 What Was Implemented

A complete debug mode that simulates Claude API responses for testing orchestrator logic without making real API calls.

## 📋 Changes Made

### 1. **types.ts**
Added `debugMode?: boolean` to Config interface

### 2. **client.ts**
- **`generateMockResponse()`** - Generates weighted random mock responses
  - 60% correct format (Tell worker, DONE)
  - 40% incorrect format (triggers needsCorrection)
  - Includes thinking blocks
  - Proper message structure

- **`streamMockResponse()`** - Simulates streaming
  - Thinking: 10-char chunks, 20ms delay
  - Text: 5-char chunks, 30ms delay
  - Realistic typing effect

- **`streamMessage()`** - Check for debug mode
  - If enabled, calls `streamMockResponse()` instead of real API
  - Logs `[DEBUG MODE]` message

### 3. **index.ts**
- Added `--debug` CLI flag
- Skip API key validation in debug mode
- Display warning when debug mode is enabled

### 4. **Documentation**
- **docs/DEBUG_MODE.md** - Complete usage guide
- **test-debug-mode.sh** - Test script

## 🎲 Mock Response Types

| Type | Weight | Triggers Correction? | Example |
|------|--------|---------------------|---------|
| Tell Worker | 3 | ❌ | "Tell worker: Implement feature" |
| Tell Worker (variant) | 3 | ❌ | "Tell worker: Create function" |
| DONE | 2 | ❌ | "DONE" |
| **DONE** (markdown) | 2 | ❌ | "**DONE**" |
| DONE with code | 2 | ❌ | "```bash\nnpm start\n```\n\nDONE" |
| Missing format | 2 | ✅ | "I think we should..." |
| Incomplete | 2 | ✅ | "Let me think about..." |
| Conversational | 1 | ✅ | "I've reviewed..." |

**Total Weight**: 17
- Correct responses: 10/17 (59%)
- Incorrect responses: 7/17 (41%)

## 🚀 Usage

### Basic Usage
```bash
# With initial instruction
./dist/index.js --debug "Test orchestrator"

# Without initial instruction
./dist/index.js --debug

# With options
./dist/index.js --debug -r 10 --no-thinking
```

### No API Key Required
```bash
# This works without any API key
./dist/index.js --debug
```

### Test Script
```bash
# Run automated test
./test-debug-mode.sh
```

## 🎭 What It Tests

### ✅ Tested Scenarios
1. **needsCorrection Flow**
   - Responses without proper format
   - Correction prompting
   - Multiple correction attempts
   - Recovery after correction

2. **DONE Detection**
   - Plain DONE
   - Markdown DONE (**DONE**, __DONE__)
   - DONE after code blocks
   - Various DONE formats

3. **Conversation Flow**
   - User → Instructor → Worker loops
   - Multiple rounds
   - Round limits
   - Session management

4. **Status Display**
   - Model icons (🧠 🚀 ⚡)
   - Continue/Stop indicators
   - Correction warnings
   - Debug logging

5. **Error Recovery**
   - Empty content (if all responses filtered)
   - Interrupt handling (ESC key)
   - Invalid instruction handling

### ❌ Not Simulated
- Tool use (file operations, git)
- Actual code execution
- Real AI reasoning
- Context-aware responses
- Long-term conversation coherence

## 📊 Debug Logging

When debug mode is active, you'll see:

```
[DEBUG MODE] Generating mock response instead of calling API
[DEBUG] handleNeedsCorrection called
[DEBUG] response: {"needsCorrection":true,"shouldContinue":true,"instruction":""}
```

## 🎨 Example Output

```
⚙️  DEBUG MODE ENABLED
   Using mock API responses instead of real Claude API
   This is for testing orchestrator logic only

Starting dual-AI orchestration system
...

[DEBUG MODE] Generating mock response instead of calling API

Response:
I think we should implement this feature using TypeScript.
It would be better for type safety.

[Status] 🚀 Sonnet | ▶️  Continue | ⚠️  Needs correction

⚠️  Instructor did not use the correct communication format.
   To communicate with Worker, use: "Tell worker: [instruction]"
   To finish the task, respond with: "DONE"
```

## 💡 Benefits

1. **No API Costs** - Test without consuming API quota
2. **Fast Iteration** - Instant responses, no network delays
3. **Predictable Testing** - Weighted responses for consistent testing
4. **Error Simulation** - Automatically tests error handling paths
5. **Easy Debugging** - Clear logging shows what's happening
6. **No Credentials** - Works without API keys
7. **Rapid Development** - Test orchestrator changes quickly

## 🔧 Customization

To customize mock responses, edit `src/client.ts`:

```typescript
const responses = [
  {
    weight: 5,  // Higher = more likely
    text: 'Your custom response...'
  },
  // Add more...
];
```

## 📝 Notes

- Responses are random, so each run will be different
- ~40% of responses trigger needsCorrection by design
- Streaming delays simulate real typing speed
- All orchestrator logic is tested, not just happy path
- Debug mode works with all other CLI flags

## 🐛 Troubleshooting

**Q: Why so many corrections?**
A: By design! This tests the correction flow thoroughly.

**Q: Can I force all correct responses?**
A: Yes, set `weight: 0` for incorrect responses.

**Q: Does it test Worker too?**
A: Yes, both Instructor and Worker use mock responses.

**Q: Can I add my own test cases?**
A: Yes, add them to the `responses` array.

## ✅ Testing Checklist

Use debug mode to verify:
- [x] needsCorrection flow
- [x] DONE detection (all formats)
- [x] Round limits
- [x] Status display
- [x] User interrupts (ESC)
- [x] Session management
- [x] Error messages
- [x] Multiple rounds
- [x] Conversation loops

## 🎉 Quick Start

```bash
# 1. Build
npm run build

# 2. Test debug mode
./dist/index.js --debug "Test" -r 3

# 3. Watch it handle various scenarios
# - Correct formats
# - Incorrect formats (needsCorrection)
# - DONE signals
# - Status displays

# 4. Type 'exit' to quit
```

That's it! You can now test orchestrator logic without API calls.
