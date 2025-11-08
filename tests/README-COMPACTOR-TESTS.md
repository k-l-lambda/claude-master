# Compactor Tests

This directory contains tests for the conversation compaction functionality.

## Test Files

### 1. `test-compactor.js`
Tests the full Instructor context compaction flow:
- Creates a mock conversation history
- Calls Claude API to generate summary
- Verifies the summary contains all required sections
- Checks token reduction

**Run with:**
```bash
node tests/test-compactor.js
```

**Requirements:**
- `ANTHROPIC_AUTH_TOKEN` environment variable must be set
- API access to Claude (will make actual API call)
- Takes ~10-20 seconds to complete

**What it tests:**
- ✅ Compactor can generate summaries via API
- ✅ Summary contains required sections (Primary Request, Technical Concepts, etc.)
- ✅ Summary covers key topics from conversation
- ✅ Boundary markers are created correctly
- ✅ Token statistics are calculated

### 2. `test-worker-context-logic.js`
Tests Worker context compaction logic (no API calls):
- Simulates Worker conversation with tool calls
- Tests round counting algorithm
- Tests message slicing logic
- Verifies edge cases

**Run with:**
```bash
node tests/test-worker-context-logic.js
```

**Requirements:**
- No API access needed
- Runs instantly

**What it tests:**
- ✅ Round counting distinguishes instructions from tool_results
- ✅ Handles rounds with multiple tool calls correctly
- ✅ Message slicing preserves round boundaries
- ✅ Edge cases (keep more than exists, keep 1 round, etc.)

## Expected Output

### Successful Test
Both tests should output:
```
🎉 TEST PASSED: [test name] is working correctly!
✅ All tests completed successfully!
```

### Failed Test
If a test fails, you'll see:
```
❌ TEST FAILED with error:
[error details]
```

## Test Coverage

### Instructor Context Compaction
- [x] API integration (Anthropic client)
- [x] Summary generation
- [x] Section presence validation
- [x] Topic coverage checking
- [x] Token reduction calculation
- [x] Boundary marker creation

### Worker Context Compaction
- [x] Round counting (string vs array content)
- [x] Tool call handling (multiple tools per round)
- [x] Message slicing logic
- [x] Edge case: keep more than exists
- [x] Edge case: keep only 1 round
- [x] Edge case: rounds with varying message counts

## Notes

- The Instructor compaction test makes a real API call, so it:
  - Requires valid authentication
  - Consumes API credits (~0.001-0.01¢)
  - May fail if API is unavailable

- The Worker logic test is pure logic testing:
  - No external dependencies
  - Instant execution
  - Can run offline

## Future Test Ideas

1. **Load Testing**: Test compaction with very large conversations (1000+ messages)
2. **Token Limit**: Test auto-compact trigger at 160k tokens
3. **Multiple Compactions**: Test compacting already-compacted conversations
4. **Edge Cases**: Empty conversations, single-message conversations
5. **Integration**: Test full orchestrator flow with compaction
