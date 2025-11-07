#!/bin/bash

# Test that Worker responses don't contain "Tell worker:" or "DONE"

echo "========================================="
echo "Testing Worker Mock Responses"
echo "========================================="
echo ""

TEST_OUTPUT="/tmp/claude-debug-worker-test-$$.txt"

# Run with an instruction that will trigger worker interaction
# Wait 5 seconds before sending exit to let some rounds execute
(
    echo "Test the orchestrator with various scenarios"
    sleep 12
    echo "exit"
) | timeout 20s ./dist/index.js --debug -r 5 2>&1 | tee "$TEST_OUTPUT"

EXIT_CODE=$?

echo ""
echo "========================================="
echo "Test Analysis"
echo "========================================="
echo ""

# Check if Worker section contains invalid phrases
if grep -A 10 "WORKER.*Processing Instruction" "$TEST_OUTPUT" | grep -q "Tell worker:"; then
    echo "❌ ERROR: Worker response contains 'Tell worker:' which is invalid"
    echo "    Worker should never instruct itself!"
    grep -A 10 "WORKER.*Processing Instruction" "$TEST_OUTPUT" | grep "Tell worker:"
else
    echo "✅ Worker responses do not contain 'Tell worker:'"
fi

if grep -A 10 "WORKER.*Processing Instruction" "$TEST_OUTPUT" | grep -q "DONE"; then
    echo "❌ ERROR: Worker response contains 'DONE' which is invalid"
    echo "    Only Instructor should say DONE!"
    grep -A 10 "WORKER.*Processing Instruction" "$TEST_OUTPUT" | grep "DONE"
else
    echo "✅ Worker responses do not contain 'DONE'"
fi

# Check if Instructor correctly uses "Tell worker:"
if grep -A 10 "INSTRUCTOR.*Processing" "$TEST_OUTPUT" | grep -q "Tell worker:"; then
    echo "✅ Instructor correctly uses 'Tell worker:' format"
else
    echo "⚠️  Instructor did not use 'Tell worker:' (might have used DONE or incorrect format)"
fi

# Count rounds executed
ROUND_COUNT=$(grep -c "ROUND" "$TEST_OUTPUT" || echo "0")
echo ""
echo "📊 Rounds executed: $ROUND_COUNT"

# Show if worker was called
if grep -q "WORKER.*Processing Instruction" "$TEST_OUTPUT"; then
    echo "✅ Worker was called at least once"
else
    echo "⚠️  Worker was never called (Instructor may have said DONE immediately)"
fi

# Check exit code
if [ $EXIT_CODE -eq 124 ]; then
    echo "⏱️  Test timed out (20s limit reached)"
elif [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Test completed successfully"
else
    echo "⚠️  Test exited with code: $EXIT_CODE"
fi

# Cleanup
rm -f "$TEST_OUTPUT"

echo ""
echo "Test complete!"
