#!/bin/bash

echo "========================================="
echo "Testing Runtime Round Control"
echo "========================================="
echo ""

# Test 1: Initial rounds and [r+n]
echo "Test 1: Starting with -r 2, then add 3 rounds with [r+3]"
(
    sleep 2
    echo "Task 1"
    sleep 3
    echo "[r+3] Continue"
    sleep 5
    echo "exit"
) | timeout 15s ./dist/index.js --debug -r 2 2>&1 | grep -E "(Max Rounds|Round \d+|📊|remaining|No remaining)" | head -20

echo ""
echo "========================================="

# Test 2: [r=n] set rounds
echo "Test 2: Set rounds to 5 with [r=5]"
(
    sleep 2
    echo "[r=5] New task"
    sleep 8
    echo "exit"
) | timeout 15s ./dist/index.js --debug 2>&1 | grep -E "(Round \d+|📊|remaining|Set)" | head -15

echo ""
echo "========================================="

# Test 3: Only control command
echo "Test 3: Only [r+10] without instruction"
(
    sleep 2
    echo "[r+10]"
    sleep 2
    echo "exit"
) | timeout 10s ./dist/index.js --debug -r 1 2>&1 | grep -E "(📊|remaining|No instruction)" | head -5

echo ""
echo "Test complete!"
