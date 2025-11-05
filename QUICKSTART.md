# Quick Start Guide

## Installation & Build

```bash
npm install
npm run build
```

## Configuration

**Recommended: Create a `.env.local` file**

```bash
# Copy the example
cp .env.example .env.local

# Edit with your values
nano .env.local
```

Add your API key:
```bash
ANTHROPIC_AUTH_TOKEN=your-api-key-here
ANTHROPIC_BASE_URL=https://api.anthropic.com  # optional
```

**Alternative: Use environment variables**
```bash
export ANTHROPIC_AUTH_TOKEN="your-api-key"
```

## Basic Usage

```bash
# With .env.local configured (recommended)
npm start "Create a simple Express.js server"

# Or set up environment (legacy method)
source ./claude.local.sh
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

✅ `.env.local` file support for easy configuration
✅ Extended thinking for Instructor
✅ Natural language message format
✅ Configurable round limits
✅ Model selection per task
✅ Color-coded console output
✅ Permission separation (Instructor=read/write/git, Worker=full except git)
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

You can set these in `.env.local` file (recommended) or as environment variables:

Required:
- `ANTHROPIC_AUTH_TOKEN` - Your API key

Optional:
- `ANTHROPIC_BASE_URL` - Custom API endpoint

## Configuration Files

```
.env.example    # Template for environment variables
.env.local            # Your actual config (git-ignored)
claude.local.sh       # Legacy shell script (optional)
```

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
# Option 1: Use .env.local (recommended)
cp .env.example .env.local
# Edit .env.local and add your key

# Option 2: Set environment variable
export ANTHROPIC_AUTH_TOKEN="your-key-here"

# Option 3: Pass via CLI
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
