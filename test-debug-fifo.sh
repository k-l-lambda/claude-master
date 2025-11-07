#!/bin/bash

# Test with mkfifo to provide delayed input

echo "========================================="
echo "Testing Debug Mode with Worker/Instructor"
echo "========================================="
echo ""

FIFO="/tmp/test-input-$$"
mkfifo "$FIFO"

# Feed input in background
(
    # Send initial instruction
    echo "Test the orchestration system"
    # Give time for rounds to execute (15 seconds)
    sleep 15
    # Then exit
    echo "exit"
) > "$FIFO" &

FEEDER_PID=$!

# Run the orchestrator with the fifo as stdin
timeout 20s ./dist/index.js --debug -r 8 < "$FIFO" 2>&1 | tee /tmp/debug-output.txt

# Cleanup
kill $FEEDER_PID 2>/dev/null || true
rm -f "$FIFO"

echo ""
echo "========================================="
echo "Analysis"
echo "========================================="

# Check for Worker interactions
if grep -q "🤖 WORKER" /tmp/debug-output.txt; then
    echo "✅ Worker was called"

    # Check if Worker said "Tell worker:"
    if grep "🤖 WORKER" /tmp/debug-output.txt | grep -A 20 "Processing Instruction" | grep -q "Tell worker:"; then
        echo "❌ ERROR: Worker response contains 'Tell worker:'"
        grep "🤖 WORKER" /tmp/debug-output.txt | grep -A 20 "Processing Instruction" | grep "Tell worker:"
    else
        echo "✅ Worker did NOT say 'Tell worker:'"
    fi

    # Check if Worker said "DONE"
    if grep "🤖 WORKER" /tmp/debug-output.txt | grep -A 20 "Processing Instruction" | grep -q "DONE"; then
        echo "❌ ERROR: Worker response contains 'DONE'"
    else
        echo "✅ Worker did NOT say 'DONE'"
    fi
else
    echo "⚠️  Worker was never called"
fi

# Check for Instructor
if grep -q "🧠 INSTRUCTOR" /tmp/debug-output.txt; then
    echo "✅ Instructor was called"

    if grep "🧠 INSTRUCTOR" /tmp/debug-output.txt | grep -A 20 "Response:" | grep -q "Tell worker:"; then
        echo "✅ Instructor uses 'Tell worker:' format"
    else
        echo "ℹ️  Instructor might have used DONE or needs correction"
    fi
fi

# Count rounds
ROUNDS=$(grep -c "ROUND" /tmp/debug-output.txt || echo "0")
echo ""
echo "📊 Total rounds executed: $ROUNDS"

rm -f /tmp/debug-output.txt

echo ""
echo "Test complete!"
