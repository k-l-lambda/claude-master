# Claude Master

A CLI tool that orchestrates two Claude AI instances working together:
- **Instructor**: Plans and oversees tasks using extended thinking
- **Worker**: Executes implementation tasks

## Quick Links

- [Quick Start Guide](QUICKSTART.md) - Get started quickly
- [System Prompt Guide](SYSTEM_PROMPT_GUIDE.md) - Learn how to craft effective system prompts
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

## Usage

### Basic Usage

```bash
# Using environment variables from claude.local.sh
source claude.local.sh
npm start "Create a simple Express.js server with health check endpoint"
```

### With Custom Options

```bash
node dist/index.js "Your task here" \
  --system-prompt "You are an expert in Node.js development" \
  --max-rounds 10 \
  --instructor-model claude-sonnet-4-5-20250929 \
  --worker-model claude-sonnet-4-5-20250929
```

### CLI Options

- `<task>` - The task to execute (required)
- `-s, --system-prompt <prompt>` - Custom system prompt for Instructor
- `-r, --max-rounds <number>` - Maximum number of conversation rounds
- `-i, --instructor-model <model>` - Model for Instructor (default: claude-sonnet-4-5-20250929)
- `-w, --worker-model <model>` - Default model for Worker (default: claude-sonnet-4-5-20250929)
- `-k, --api-key <key>` - Anthropic API key (or use ANTHROPIC_AUTH_TOKEN env var)
- `-u, --base-url <url>` - API base URL (or use ANTHROPIC_BASE_URL env var)

### Environment Variables

Required:
- `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY` - Your Anthropic API key

Optional:
- `ANTHROPIC_BASE_URL` - Custom API endpoint

### Example System Prompts for Instructor

The system prompt customizes how the Instructor plans and guides the Worker. Here are some examples:

**Important: Your system prompts should remind the Instructor of its capabilities:**
- Use `Tell worker: [instruction]` to send specific instructions to Worker (or omit prefix to send entire response)
- Mention model preference with phrases like `use opus`, `use sonnet`, or `use haiku` when needed
- Say `DONE` when the task is complete
- You can read, write, and edit files, and use git commands to understand and modify the codebase

**Example 1: General Software Development**
```bash
node dist/index.js "Create a REST API for a todo app" \
  --system-prompt "You are a senior software architect. Focus on:
- Clean code architecture and best practices
- Proper error handling and validation
- Security considerations
- Clear and detailed instructions for the Worker

Communication with Worker:
- Use 'Tell worker: [instruction]' to give clear instructions
- Use 'use opus/sonnet/haiku' to specify model when needed
- Say 'DONE' when task is complete

Break down complex tasks into small, manageable steps."
```

**Example 2: Focus on Testing**
```bash
node dist/index.js "Implement a user authentication system" \
  --system-prompt "You are a test-driven development expert. For every feature:
1. First instruct Worker to write tests
2. Then implement the feature
3. Ensure all tests pass before moving forward

How to communicate:
- Tell worker: [your instruction here]
- Optionally specify: 'use opus' for complex tasks, 'use haiku' for simple tasks
- Say 'DONE' when complete

Emphasize code quality and test coverage."
```

**Example 3: Performance-Focused**
```bash
node dist/index.js "Optimize the database queries in this project" \
  --system-prompt "You are a performance optimization specialist.
- Analyze code thoroughly before giving instructions
- Focus on performance bottlenecks and optimization opportunities
- Use git tools to review existing code
- Provide specific, measurable performance goals
- Guide Worker to implement efficient solutions

Instructions format:
- Tell worker: [specific optimization task]
- Use 'use opus' for complex analysis tasks
- Say 'DONE' when optimizations are complete"
```

**Example 4: Documentation-First Approach**
```bash
node dist/index.js "Add a new payment module" \
  --system-prompt "You are a documentation-driven developer.
For each task:
1. First have Worker create detailed documentation
2. Then implement according to the documented design
3. Add inline comments and API documentation

Communication:
- Tell worker: [instruction]
- Say 'DONE' when everything is documented and implemented

Ensure everything is well-documented and maintainable."
```

**Example 5: Security-Focused**
```bash
node dist/index.js "Build a file upload feature" \
  --system-prompt "You are a security engineer.
- Prioritize security at every step
- Think about potential vulnerabilities (injection, XSS, CSRF, etc.)
- Instruct Worker to implement proper input validation
- Ensure secure file handling and storage
- Review Worker's implementation for security issues

How to instruct:
- Tell worker: [security-focused instruction]
- Use 'use opus' for critical security implementations
- Say 'DONE' when security review is complete"
```

**Example 6: Minimal Guidance (Let Instructor Decide)**
```bash
node dist/index.js "Create a blog system" \
  --system-prompt "You are an experienced tech lead. Use your judgment to:
- Determine the best approach for the task
- Break down work efficiently
- Choose appropriate technologies
- Guide Worker with clear, concise instructions

Remember:
- Tell worker: [instruction] (or just give the instruction directly)
- Specify model if needed: 'use opus/sonnet/haiku'
- Say 'DONE' when finished"
```

**Tips for Writing System Prompts:**
- Be specific about the domain expertise (e.g., "backend developer", "frontend specialist")
- Define the workflow or methodology (e.g., TDD, documentation-first)
- Specify priorities (e.g., security, performance, maintainability)
- Mention any constraints or requirements
- Keep it focused on planning and guidance (not implementation)

## Conversation Flow

1. User provides a task
2. Instructor receives task, uses thinking to analyze
3. Instructor responds with instruction for Worker (using "Tell worker:" or entire response)
4. Worker receives instruction and executes (writes code, edits files, etc.)
5. Instructor receives Worker's response prefixed with "Worker says: ..."
6. Instructor reviews and either:
   - Continues with next instruction
   - Says "DONE" to complete the task
7. Repeat until task is complete or max rounds reached

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
