# Quick Start Guide

## Installation & Build

```bash
npm install
npm run build
```

## Basic Usage

```bash
# Set up environment (API keys)
source ./claude.local.sh

# Run a task
npm start "Create a simple Express.js server"

# Or use the compiled version directly
node dist/index.js "Your task here"
```

## CLI Options

```bash
node dist/index.js "Your task" \
  --system-prompt "You are an expert in Node.js" \
  --max-rounds 10 \
  --instructor-model claude-sonnet-4-5-20250929 \
  --worker-model claude-sonnet-4-5-20250929 \
  --api-key "your-api-key" \
  --base-url "https://api.anthropic.com"
```

## System Prompt Examples

**For TDD (Test-Driven Development):**
```bash
npm start "Create a calculator module" \
  --system-prompt "You are a TDD expert. Always have Worker write tests first, then implement to pass the tests."
```

**For Security-Focused Development:**
```bash
npm start "Build a user login system" \
  --system-prompt "You are a security engineer. Review all code for vulnerabilities and ensure proper input validation and authentication."
```

**For Performance Optimization:**
```bash
npm start "Optimize this application" \
  --system-prompt "You are a performance specialist. Analyze code using git tools, identify bottlenecks, and guide Worker to implement efficient solutions."
```

## Message Format

### Instructor → Worker

**Option 1: Using "Tell worker:"**
```
Tell worker: Create a file named test.txt
```
→ Only "Create a file named test.txt" is sent to Worker

**Option 2: Entire response**
```
Create a file named test.txt
```
→ Entire message sent to Worker

### Worker → Instructor

Automatically formatted:
```
Worker says: I've created test.txt successfully
```

### Completion

When Instructor says:
```
DONE
```
The conversation ends.

## Example Conversation

**Round 1:**
- User: "Create a TypeScript calculator"
- Instructor: *thinks* → "Tell worker: Create a basic calculator class in TypeScript with add, subtract, multiply, divide methods"

**Round 2:**
- Worker: "I've created the Calculator class with all four methods"
- Instructor: *receives "Worker says: I've created..."* → *thinks* → "Tell worker: Add unit tests for all calculator methods"

**Round 3:**
- Worker: "I've added comprehensive tests for all methods"
- Instructor: *receives "Worker says: I've added..."* → *thinks* → "DONE"

## Features

✅ Extended thinking for Instructor
✅ Natural language message format
✅ Configurable round limits
✅ Model selection per task
✅ Color-coded console output
✅ Permission separation (Instructor=read/git, Worker=full except git)
✅ Streaming responses

## Common Commands

```bash
# Development mode with live reload
npm run dev "Your task"

# Build
npm run build

# Run examples
./examples.sh

# Show help
node dist/index.js --help
```

## Environment Variables

Required:
- `ANTHROPIC_AUTH_TOKEN` - Your API key

Optional:
- `ANTHROPIC_BASE_URL` - Custom API endpoint

## Project Structure

```
src/
├── index.ts          # CLI entry point
├── orchestrator.ts   # Message coordinator
├── instructor.ts     # Instructor AI (planning)
├── worker.ts         # Worker AI (execution)
├── client.ts         # Claude API client
├── display.ts        # Console UI
├── tools.ts          # Tool definitions
└── types.ts          # Type definitions
```

## Troubleshooting

**API Key Error:**
```bash
export ANTHROPIC_AUTH_TOKEN="your-key-here"
# or
node dist/index.js "task" --api-key "your-key"
```

**Module Errors:**
```bash
npm install
npm run build
```

**Permission Issues:**
```bash
chmod +x dist/index.js
chmod +x examples.sh
```
