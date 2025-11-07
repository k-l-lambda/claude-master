#!/bin/bash

# Test debug mode with automatic exit after a few rounds
echo "Testing Debug Mode - Will auto-exit after showing a few rounds"
echo ""

# Create a test input that will trigger different scenarios
# Using echo to pipe input
(
  sleep 2
  echo "exit"
) | timeout 10s ./dist/index.js --debug "Test the orchestrator logic" -r 5 || true

echo ""
echo "===== Test Complete ====="
echo "Debug mode allows testing without API calls"
echo "Run manually: ./dist/index.js --debug"
