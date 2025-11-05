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
npm start "Read the README.md to be aware about our task"

# Or set up environment (legacy method)
source ./claude.local.sh
npm start "Read the CLAUDE.md file to understand the task"

# Or use the compiled version directly
node dist/index.js "Create a simple Express.js server"
```

## Usage Patterns

**Pattern 1: Task in README (Recommended)**

Create a README.md or CLAUDE.md with your task:
```markdown
# Task
Create a REST API with Express.js and TypeScript.
Include CRUD operations and tests.
```

Then:
```bash
npm start "Read the README.md to be aware about our task"
```

**Pattern 2: Direct Instruction**
```bash
npm start "Create a calculator module with add, subtract, multiply, divide functions"
```

**Pattern 3: Role-based Instruction**
```bash
npm start "You are a TDD expert. Create a string utility library. Write tests first, then implement."
```

## CLI Options

```bash
node dist/index.js "Your instruction" \
  --max-rounds 10 \
  --instructor-model claude-sonnet-4-5-20250929 \
  --worker-model claude-sonnet-4-5-20250929 \
  --api-key "your-api-key" \
  --base-url "https://api.anthropic.com"
```

Note: `--system-prompt` option has been removed. The instruction argument IS the system prompt/context for the Instructor.

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

**User runs:**
```bash
npm start "Read the CLAUDE.md to understand our task"
```

**Round 1:**
- Instructor: *thinks* → *reads CLAUDE.md* → "Tell worker: Create the project structure with src/, tests/, and package.json"

**Round 2:**
- Worker: "I've created the project structure"
- Instructor: *receives "Worker says: I've created..."* → *thinks* → "Tell worker: Implement the main function as described in CLAUDE.md"

**Round 3:**
- Worker: "I've implemented the main function with tests"
- Instructor: *receives "Worker says: I've implemented..."* → *thinks* → "DONE"

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
