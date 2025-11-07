#!/bin/bash

# Automated test for debug mode
# This will run the orchestrator in debug mode and provide automatic inputs

echo "========================================="
echo "Testing Debug Mode - Automated Test"
echo "========================================="
echo ""

# Create a temporary file for test output
TEST_OUTPUT="/tmp/claude-master-debug-test-$$.txt"

# Run the orchestrator with debug mode
# Provide automatic "exit" after 5 seconds to end the test
(
    echo "Test the orchestrator with various scenarios"
    sleep 8
    echo "exit"
) | timeout 30s ./dist/index.js --debug -r 10 2>&1 | tee "$TEST_OUTPUT"

EXIT_CODE=$?

echo ""
echo "========================================="
echo "Test Analysis"
echo "========================================="

# Check for errors or issues
if grep -q "ERROR:" "$TEST_OUTPUT"; then
    echo "❌ ERRORS FOUND:"
    grep "ERROR:" "$TEST_OUTPUT"
    echo ""
fi

if grep -q "Orchestration failed:" "$TEST_OUTPUT"; then
    echo "❌ ORCHESTRATION FAILED:"
    grep "Orchestration failed:" "$TEST_OUTPUT"
    echo ""
fi

if grep -q "needsCorrection" "$TEST_OUTPUT"; then
    echo "✅ needsCorrection flow was tested"
fi

if grep -q "DONE" "$TEST_OUTPUT"; then
    echo "✅ DONE detection was tested"
fi

if grep -q "Tell worker:" "$TEST_OUTPUT"; then
    echo "✅ Worker instruction flow was tested"
fi

# Check exit code
if [ $EXIT_CODE -eq 124 ]; then
    echo "⏱️  Test timed out (30s limit reached)"
elif [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Test completed successfully"
else
    echo "⚠️  Test exited with code: $EXIT_CODE"
fi

# Cleanup
rm -f "$TEST_OUTPUT"

echo ""
echo "Test complete!"
