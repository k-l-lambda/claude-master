# Claude Master

A CLI tool that orchestrates two Claude AI instances working together:
- **Instructor**: Plans and oversees tasks using extended thinking
- **Worker**: Executes implementation tasks

## Architecture

### Instructor Instance
- Receives user's task and system prompt
- Uses extended thinking for deep analysis and planning
- Has limited permissions (file reading & git only)
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

## Conversation Flow

1. User provides a task
2. Instructor receives task, uses thinking to analyze, and creates instruction for Worker
3. Worker receives instruction and executes (writes code, edits files, etc.)
4. Instructor reviews Worker's response and either:
   - Continues with next instruction
   - Completes the task
5. Repeat until task is complete or max rounds reached

## Example

```bash
npm start "Create a TypeScript function to validate email addresses with tests"
```

The Instructor will:
1. Think about the requirements
2. Instruct Worker to create the email validation function
3. Review Worker's implementation
4. Instruct Worker to add tests
5. Review tests and complete

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

The Instructor must respond in this format:

```xml
<instruction>
Clear instruction for the Worker
</instruction>

<worker_model>
opus | sonnet | haiku
</worker_model>

<continue>
YES | NO
</continue>
```

## Tool Access

### Instructor Tools (Limited)
- `read_file` - Read file contents
- `glob_files` - Find files by pattern
- `grep_search` - Search code
- `git_command` - Git operations

### Worker Tools (Full)
- `read_file` - Read file contents
- `write_file` - Create new files
- `edit_file` - Edit existing files
- `glob_files` - Find files by pattern
- `grep_search` - Search code
- `bash_command` - Execute safe bash commands (no git)

## License

ISC
