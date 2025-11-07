#!/bin/bash

# Manual test - run for 15 seconds to see multiple rounds in action

echo "========================================="
echo "Manual Debug Test - 15 seconds"
echo "========================================="
echo ""
echo "This will run debug mode and show several rounds of interaction."
echo "Watch for:"
echo "  - Instructor responses with 'Tell worker:' or 'DONE'"
echo "  - Worker responses (should NEVER have 'Tell worker:' or 'DONE')"
echo "  - needsCorrection flow"
echo ""
echo "Starting in 2 seconds..."
sleep 2

# Use a here-document to provide input
timeout 15s ./dist/index.js --debug -r 10 <<EOF
Test the orchestration system thoroughly
EOF

echo ""
echo "========================================="
echo "Test ended (15s timeout or completion)"
echo "========================================="
