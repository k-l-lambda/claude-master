# Claude Master

A CLI tool that orchestrates two Claude AI instances working together:
- **Instructor**: Plans and oversees tasks using extended thinking
- **Worker**: Executes implementation tasks

## Quick Links

- [Quick Start Guide](QUICKSTART.md) - Get started quickly
- [Example Prompts](EXAMPLE_PROMPTS.md) - Reference prompts for different use cases
- [Implementation Details](IMPLEMENTATION.md) - Technical documentation

## Architecture

### Instructor Instance
- Receives user's task and system prompt
- Uses extended thinking for deep analysis and planning
- Has file reading, writing, and git permissions
- Determines which model Worker should use
- Reviews Worker's responses and provides next instructions

### Worker Instance
- Receives instructions from Instructor
- Has full implementation permissions (read, write, edit files, bash commands)
- NO access to git or other dangerous operations
- Focuses on execution

### CLI Tool
- Manages communication between both instances
- Displays both conversations in console with color coding
- Supports configurable round limits

## Installation

```bash
npm install
npm run build
```

## Configuration

### Option 1: Using .env.local file (Recommended)

Create a `.env.local` file in the project root:

```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local with your values
```

Example `.env.local`:
```bash
ANTHROPIC_AUTH_TOKEN=your-api-key-here
ANTHROPIC_BASE_URL=https://api.anthropic.com
```

### Option 2: Using environment variables

```bash
export ANTHROPIC_AUTH_TOKEN="your-api-key-here"
export ANTHROPIC_BASE_URL="https://api.anthropic.com"
```

### Option 3: Using CLI options

Pass credentials directly via command line options (see CLI Options below).

## Usage

### Basic Usage

The `<instruction>` argument is used as the system prompt/context for the Instructor. A common pattern is to put task details in a README.md file:

```bash
# With .env.local configured
npm start "Read the README.md to be aware about our task"

# Or with environment variables
source claude.local.sh
npm start "Read the CLAUDE.md file to understand the task"
```

### Direct Task Description

You can also provide the task description directly:

```bash
npm start "Create a simple Express.js server with health check endpoint. Use TypeScript and follow best practices."
```

### With Custom Options

```bash
node dist/index.js "Read the README.md to be aware about our task" \
  --work-dir /path/to/your/project \
  --max-rounds 10 \
  --instructor-model claude-sonnet-4-5-20250929 \
  --worker-model claude-sonnet-4-5-20250929
```

### CLI Options

- `<instruction>` - Instruction/context for Instructor (required). Examples:
  - `"Read the README.md to be aware about our task"`
  - `"Create a REST API with authentication"`
- `-d, --work-dir <path>` - Working directory for both Instructor and Worker (default: current directory)
- `-r, --max-rounds <number>` - Maximum number of conversation rounds
- `-i, --instructor-model <model>` - Model for Instructor (default: claude-sonnet-4-5-20250929)
- `-w, --worker-model <model>` - Default model for Worker (default: claude-sonnet-4-5-20250929)
- `-k, --api-key <key>` - Anthropic API key (or use ANTHROPIC_AUTH_TOKEN in .env.local or env var)
- `-u, --base-url <url>` - API base URL (or use ANTHROPIC_BASE_URL in .env.local or env var)

**Note on Work Directory:**
Both Instructor and Worker operate in the specified work directory. All file operations (reading, writing, editing, git commands) happen relative to this directory.

### Configuration Priority

Configuration values are loaded in the following order (highest priority first):
1. CLI options (`--api-key`, `--base-url`)
2. Environment variables
3. `.env.local` file

### Environment Variables

The following variables can be set in `.env.local`:

Required:
- `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY` - Your Anthropic API key

Optional:
- `ANTHROPIC_BASE_URL` - Custom API endpoint

### Usage Patterns

**Pattern 1: Task in README file (Recommended)**

Put your task description in a CLAUDE.md or README.md file in your project:

```markdown
# Task Description

Create a REST API for a todo application with the following requirements:
- Use Express.js and TypeScript
- Implement CRUD operations
- Add input validation
- Include error handling
- Write tests

Follow TDD principles: write tests first, then implement.
```

Create a prompt file or use inline:
```bash
npm start "You are the INSTRUCTOR in a dual-AI system.

Read the README.md to understand the task.

Your capabilities:
- File reading, writing, editing, and git tools
- Extended thinking for planning
- Cannot execute bash (only Worker can)

Communication:
- Tell worker: [instruction]
- use opus/sonnet/haiku for model selection
- DONE when complete

Guide Worker step by step through implementation."
```

**Pattern 2: Direct instruction**

```bash
npm start "Create a simple HTTP server that returns 'Hello World' on GET /. Use Node.js and include a test."
```

**Pattern 3: Role-based with specific methodology**

```bash
npm start "You are a TDD expert working with a Worker AI.

Task: Create a calculator module with add, subtract, multiply, divide.

For each function:
1. Tell worker to write tests first
2. Tell worker to implement
3. Verify tests pass

Communication: 'Tell worker: [instruction]', 'DONE' when complete."
```

**See [EXAMPLE_PROMPTS.md](EXAMPLE_PROMPTS.md) for more examples.**

## Conversation Flow

1. User provides an instruction
2. Instructor receives instruction, uses thinking to analyze
3. Instructor responds with instruction for Worker (using "Tell worker:" or entire response)
4. Worker receives instruction and executes (writes code, edits files, etc.)
5. Instructor receives Worker's response prefixed with "Worker says: ..."
6. Instructor reviews and either:
   - Continues with next instruction
   - Says "DONE" to complete the task
7. Repeat until task is complete or max rounds reached

### Interactive Interruption

During execution, you can press **ESC** to pause and give instructions:

1. Press **ESC** - Both Instructor and Worker are paused
2. Enter your instruction to the Instructor
3. Instructor processes your instruction and continues chatting with Worker
4. Or press Enter to resume without changes

**Example:**
```
[Instructor thinking...]
<Press ESC>
⏸️  Execution paused by user (ESC pressed)
Enter your instruction to Instructor: Focus on security - review all input validation

[Instructor processes new instruction...]
[Conversation continues with new focus...]
```

## Message Format

### From Instructor to Worker

**Option 1: Using "Tell worker:"**
```
Tell worker: Create a new file called hello.txt with content "Hello World"
```
Only the text after "Tell worker:" is sent to Worker.

**Option 2: Entire response**
```
Create a new file called hello.txt with content "Hello World"
```
If no "Tell worker:" prefix, the entire Instructor response is sent to Worker.

### From Worker to Instructor

Worker's responses are automatically prefixed:
```
Worker says: I've created the file hello.txt with the requested content.
```

### Completion

When done, Instructor should say:
```
DONE
```

## Example

```bash
npm start "Create a TypeScript function to validate email addresses with tests"
```

The Instructor will:
1. Think about the requirements
2. Say "Tell worker: Create an email validation function in TypeScript"
3. Review Worker's implementation (receives "Worker says: ...")
4. Say "Tell worker: Add unit tests for the email validation function"
5. Review tests and say "DONE"

## Output Format

The console displays:
- **Blue**: Instructor's thoughts and instructions
- **Green**: Worker's responses and actions
- **Gray**: Instructor's thinking process
- **Yellow**: System messages and round indicators

## Development

```bash
# Run in development mode
npm run dev "Your task"

# Build
npm run build

# Run built version
npm start "Your task"
```

## Instructor Response Format

The Instructor uses natural language with optional "Tell worker:" prefix:

**Simple format:**
```
Tell worker: [instruction for worker]
```

**Or without prefix (sends entire response to Worker):**
```
[instruction for worker]
```

**To indicate completion:**
```
DONE
```

**Optional model hints** (can be anywhere in response):
```
Tell worker to use opus: [instruction]
# or
Use model: haiku
```

## Tool Access

### Instructor Tools
- `read_file` - Read file contents
- `write_file` - Create new files
- `edit_file` - Edit existing files
- `glob_files` - Find files by pattern
- `grep_search` - Search code
- `git_command` - Git operations

### Worker Tools (No git)
- `read_file` - Read file contents
- `write_file` - Create new files
- `edit_file` - Edit existing files
- `glob_files` - Find files by pattern
- `grep_search` - Search code
- `bash_command` - Execute safe bash commands (no git)

## License

ISC
