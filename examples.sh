#!/bin/bash

# Example script showing how to use claude-master

# Source the local config (API keys, etc)
source ./claude.local.sh

# Example 1: Simple task
echo "Example 1: Simple file creation"
node dist/index.js "Create a simple hello.txt file with 'Hello World' content" \
  --max-rounds 3

echo ""
echo "================================"
echo ""

# Example 2: With custom system prompt
echo "Example 2: With custom system prompt"
node dist/index.js "Create a TypeScript function to calculate fibonacci numbers" \
  --system-prompt "You are an expert TypeScript developer focused on clean, efficient code" \
  --max-rounds 5

echo ""
echo "================================"
echo ""

# Example 3: Complex task
echo "Example 3: Complex multi-step task"
node dist/index.js "Create a simple Node.js Express server with two endpoints: GET /health and GET /api/users" \
  --max-rounds 10
