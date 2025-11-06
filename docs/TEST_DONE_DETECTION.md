# DONE Detection - Unit Tests

## Test File
`tests/test-done-detection.js`

## Purpose
Tests the DONE detection regex used in `src/instructor.ts:184` to ensure it correctly identifies when the Instructor has completed a task.

## Requirements

### DONE Must Be Uppercase
DONE signal **must be in uppercase**. Mixed case or lowercase will not trigger completion.

✅ Valid: `DONE`, `**DONE**`
❌ Invalid: `Done`, `done`

### DONE Must Be At The End
DONE must appear at the end of the response, not in the middle of conversation.

✅ Valid: `Analysis complete.\n\nDONE`
❌ Invalid: `DONE\nBut more work is needed`

### DONE Must Be Standalone
DONE cannot be part of a sentence or phrase.

✅ Valid: `DONE`, `DONE.`, `DONE!`
❌ Invalid: `This is not DONE yet`, `We need to get this DONE`

## Running Tests

```bash
node tests/test-done-detection.js
```

## Test Categories

### 1. Valid DONE Signals (Should Match)
- Markdown formatted: `**DONE**`, `__DONE__`, `_DONE_`
- Plain DONE at end: `DONE`, `DONE.`, `DONE!`
- DONE after text: `Some text\nDONE`
- DONE with whitespace: `  DONE  `

### 2. Invalid DONE Usage (Should NOT Match)
- DONE in middle of sentence: "This is not DONE yet"
- DONE at end of sentence (not standalone): "We need to get this DONE"
- DONE followed by more text: "DONE\nBut more work"
- Lowercase/mixed case: "done", "Done"

### 3. Edge Cases
- DONE after multiple lines
- DONE with tabs and indentation
- Empty lines before DONE

### 4. Real-world Scenarios
- Instructor responses with and without completion
- Instructions mentioning "done" casually
- Review completions

## Test Results

All tests passing means:
- ✅ DONE correctly identified when task is complete
- ✅ Casual mentions of "done" don't trigger false completion
- ✅ Only uppercase DONE at end triggers completion
- ✅ Markdown formatting works

## Regex Explanation

```javascript
const DONE_REGEX = /\*\*DONE\*\*|__DONE__|_DONE_|(?:^|\n)\s*DONE[\s.!]*$/;
```

Matches:
1. `\*\*DONE\*\*` - Markdown bold `**DONE**`
2. `__DONE__` - Markdown bold alt `__DONE__`
3. `_DONE_` - Markdown italic `_DONE_`
4. `(?:^|\n)\s*DONE[\s.!]*$` - Standalone DONE:
   - `(?:^|\n)` - Start of string OR after newline
   - `\s*` - Optional whitespace before
   - `DONE` - Literal text (case-sensitive, uppercase only)
   - `[\s.!]*` - Optional whitespace/punctuation after
   - `$` - End of string (ensures DONE is at the end)

## Adding New Test Cases

To add a new test case:

```javascript
testDoneDetection(
  'Your test string here',
  true,  // or false - should it match?
  'Description of what you are testing'
);
```

Example:
```javascript
testDoneDetection(
  'Task is complete\n\nDONE',
  true,
  'Completion with blank line before DONE'
);
```

## Related Files
- `src/instructor.ts` - Contains the actual DONE detection logic
- `docs/TERMINAL_OUTPUT.md` - Terminal output documentation
