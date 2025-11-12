# Claude Master

A dual-AI orchestration CLI that coordinates two Claude instances to complete software engineering tasks:
- **Instructor**: The architect and project organizer
- **Worker**: The implementation executor

## ✨ What Makes This Special

- 🧠 **Intelligent Task Decomposition**: Instructor breaks down complex tasks into manageable steps
- 🔄 **Continuous Session**: Complete multiple tasks without restarting
- 🎯 **Model Selection**: Instructor dynamically chooses the best model for each task
- ⏸️ **Interactive Control**: Pause anytime with ESC to guide the process
- 🔍 **Full Visibility**: Watch both AIs collaborate in real-time with color-coded output

## 🚀 Quick Start

### Installation

**Option 1: Install from npm (Recommended)**

```bash
# Install globally - no authentication required!
npm install -g @k-l-lambda/claude-master

# Verify installation
claude-master --version
```

After installation, you can use `claude-master` from anywhere:
```bash
# Set up your API key
export ANTHROPIC_AUTH_TOKEN="your-key"

# Run from any directory
cd ./my-project
claude-master "Do this task described in README.md"
```

**Option 2: Install from Source (Development)**
```bash
# Clone the repository
git clone https://github.com/k-l-lambda/claude-master.git
cd claude-master

# Install dependencies and build
npm install
npm run build

# Install globally (creates 'claude-master' command)
npm link

# Or on Windows:
npm install -g .
```

**Option 3: Local Development**
```bash
# Install dependencies
npm install
npm run build

# Run locally with npm
npm start "Do this task described in README.md" -d ./my-project

# Or use the dev command (with auto-reload)
npm run dev "Your task" -d ./my-project
```

### Uninstall

```bash
# If installed from npm
npm uninstall -g @k-l-lambda/claude-master

# If installed from source with npm link
npm unlink -g claude-master
```

### Configuration

**Option 1: Environment Variable (Global)**
```bash
# Add to ~/.bashrc or ~/.zshrc
export ANTHROPIC_AUTH_TOKEN="your-api-key-here"
export ANTHROPIC_BASE_URL="https://api.anthropic.com"  # optional
```

**Option 2: .env.local File (Per Project)**
```bash
# In your project directory
echo "ANTHROPIC_AUTH_TOKEN=your-key" > .env.local
echo "ANTHROPIC_BASE_URL=https://api.anthropic.com" >> .env.local
```

**Option 3: CLI Arguments**
```bash
claude-master "task" -k your-key -u https://api.anthropic.com
```

### Quick Test

```bash
# Verify installation
./verify-installation.sh

# Test with the simple calculator example
claude-master "Read README.md to understand your task" \
  -d tests/cases/simple-calculator \
  --no-thinking
```

## 📋 Key Features

### Continuous Session Mode
The system stays active after completing a task, ready for your next instruction:
```bash
# Start with an initial task
npm start "Read README.md to understand your task" -d ./my-project

# After completion:
✓ Instructor has completed the current task
💬 Instructor is waiting for your next instruction...
Your instruction: Add error handling to all API endpoints
# Continue working in the same context!
```

### Dynamic Model Selection
Instructor can choose the right model for each subtask:
- **Sonnet** (default) - Balanced for most tasks
- **Opus** - Complex architecture and algorithms
- **Haiku** - Quick commands and simple tasks

### Interactive Pause (ESC)
Press ESC during execution to:
- Give new directions
- Clarify requirements
- Add constraints
- Resume or exit

## 📖 How It Works

### The Two Agents

**Instructor (Project Organizer)**
- Reads and understands task requirements
- Plans project architecture
- Breaks down complex tasks
- Chooses appropriate Worker model
- Reviews Worker's output
- Makes decisions
- Manages Worker's context and permissions

Tools: File operations, Git commands, Worker management (call_worker, tell_worker, etc.)

**Worker (Implementation Executor)**
- Executes specific instructions from Instructor
- Writes and modifies code
- Runs commands (npm, build, test)
- Searches the web for documentation
- Uses read-only git commands
- Reports results back to Instructor

Tools: File operations, Bash commands, Web search, Git status (read-only)

### Communication Flow

```
User → Instructor (with task)
         ↓
   [Thinks deeply about approach]
         ↓
   call_worker(system_prompt, instruction, model='sonnet')
         ↓
      Worker → [Executes task with tools]
         ↓
   [Worker returns result]
         ↓
   Instructor → Reviews and continues or says DONE
```

## 🎮 Usage

### Command Format

```bash
# If installed globally
claude-master [instruction] [options]

# If running locally
npm start [instruction] [options]
# or
npm run dev [instruction] [options]
```

### Basic Pattern

1. **Put task details in README.md** (recommended)
2. **Run with initial instruction**:
```bash
# Global installation
claude-master "Read README.md to get aware your task" -d ./your-project

# Local installation
npm start "Read README.md to get aware your task" -d ./your-project
```

### Communication Formats

Instructor communicates with Worker using tool calls:

**Three Worker Tools Available:**

1. **call_worker** - Reset Worker's context with new system prompt
   ```typescript
   call_worker({
     system_prompt: "You are a backend developer...",
     instruction: "Implement user authentication",
     model: "sonnet"  // optional: opus, sonnet, haiku
   })
   ```

2. **call_worker_with_file** - Load system prompt from file
   ```typescript
   call_worker_with_file({
     system_prompt_file: "path/to/prompt.txt",
     instruction: "Implement the feature",
     model: "haiku"
   })
   ```

3. **tell_worker** - Continue existing conversation
   ```typescript
   tell_worker({
     message: "Add error handling to the code",
     model: "sonnet"  // optional
   })
   ```

**Task Completion:**
When task is complete, Instructor responds with "DONE".

### Available Models

- `sonnet` - Claude Sonnet 4.5 (default, balanced)
- `opus` - Claude Opus 4 (most capable, for complex tasks)
- `haiku` - Claude 3.5 Haiku (fastest, for simple tasks)

## 🛠️ Configuration

### Option 1: .env.local (Recommended)
```bash
# Create .env.local file
ANTHROPIC_AUTH_TOKEN=your-api-key-here
ANTHROPIC_BASE_URL=https://api.anthropic.com  # optional
```

### Option 2: Environment Variables
```bash
export ANTHROPIC_AUTH_TOKEN="your-key"
```

### Option 3: CLI Arguments
```bash
npm start "task" -k your-key -u https://api.anthropic.com
```

## 📝 CLI Options

```bash
# Global installation
claude-master <instruction> [options]

# Local installation
npm start <instruction> [options]
```

**Arguments:**
- `<instruction>` - Initial instruction for Instructor (optional, can be provided interactively)

**Options:**
- `-V, --version` - Output the version number
- `-d, --work-dir <path>` - Working directory (default: current)
- `-r, --max-rounds <number>` - Maximum conversation rounds
- `-i, --instructor-model <model>` - Instructor model
- `-w, --worker-model <model>` - Worker default model
- `-k, --api-key <key>` - Anthropic API key
- `-u, --base-url <url>` - API base URL
- `--no-thinking` - Disable thinking display
- `-h, --help` - Display help

## 🎯 Example Use Cases

### 1. Simple Calculator (TDD)
```bash
# Global
claude-master "Read README.md to understand your task" \
  -d tests/cases/simple-calculator \
  --no-thinking

# Local
npm start "Read README.md to understand your task" \
  -d tests/cases/simple-calculator \
  --no-thinking
```

### 2. Todo List Application
```bash
# Global
claude-master "Read README.md to understand your task" \
  -d tests/cases/easy-todo-list \
  --no-thinking

# Local
npm start "Read README.md to understand your task" \
  -d tests/cases/easy-todo-list \
  --no-thinking
```

### 3. HTTP API Client Library
```bash
claude-master "Read README.md to understand your task" \
  -d tests/cases/api-client-library \
  --no-thinking
```

### 4. Expense Tracker (Advanced)
```bash
claude-master "Read README.md to understand your task" \
  -d tests/cases/expense-tracker \
  --no-thinking
```

### 5. Blog CMS Backend (Complex)
```bash
claude-master "Read README.md to understand your task" \
  -d tests/cases/blog-cms-backend \
  --no-thinking
```

### 6. Use with Any Project
```bash
# Navigate to your project
cd ~/my-awesome-project

# Run claude-master
claude-master "Read README.md and help me implement the authentication system"
```

## 🧪 Test Cases

We provide several test cases to evaluate the system's capabilities:

| Test Case | Difficulty | Focus | Rounds |
|-----------|-----------|-------|--------|
| Simple Calculator | Easy | TDD basics | 5-10 |
| Todo List CLI | Easy | Project structure | 5-10 |
| API Client Library | Medium | Library design | 10-15 |
| Expense Tracker | Medium-Hard | Layered architecture | 15-25 |
| Blog CMS Backend | Hard | Production system | 25-40+ |

See [tests/cases/README.md](tests/cases/README.md) for details.

## 🎨 Console Output

Color-coded for easy tracking:
- **Blue** - Instructor's responses
- **Green** - Worker's responses
- **Gray** - Thinking process
- **Yellow** - System messages

## 🔧 Development

### Setup for Development
```bash
# Clone and install
git clone https://github.com/yourusername/claude-master.git
cd claude-master
npm install
```

### Development Commands
```bash
# Development mode with auto-reload (tsx)
npm run dev "Your task" -d ./project

# Build TypeScript to JavaScript
npm run build

# Run built version
npm start "Your task" -d ./project

# Link for global testing
npm run link

# Unlink global installation
npm run unlink
```

### Publishing (for maintainers)
```bash
# Update version
npm version patch  # or minor, or major

# Build and publish
npm publish
```

## 📚 Documentation

- [Communication Protocol](docs/COMMUNICATION_PROTOCOL.md) - Detailed communication formats
- [Continuous Session](docs/CONTINUOUS_SESSION.md) - Session management (中文)
- [Test Cases Guide](tests/cases/README.md) - All available test cases
- [Architecture](docs/ARCHITECTURE.md) - System architecture (中文)

## 🔧 Instructor Tools

### Worker Management
- `call_worker` - Reset Worker with new system prompt and instruction
- `call_worker_with_file` - Reset Worker with system prompt from file
- `tell_worker` - Continue Worker's existing conversation
- `set_worker_timeout` - Adjust Worker's inactivity timeout (30-600s)
- `grant_worker_permission` - Grant Worker access to restricted tools
- `revoke_worker_permission` - Revoke Worker's tool permissions

### File Operations
- `read_file` - Read file contents
- `write_file` - Create/overwrite files
- `edit_file` - Edit existing files (replace text)
- `glob_files` - Find files by glob pattern
- `grep_search` - Search code with regex

### Git Operations
- `git_status` - Read-only git commands (status, log, diff, etc.)
- `git_command` - Write git commands (commit, push, etc.)

### Execution
- `bash_command` - Execute bash commands

## 🔍 Worker Tools

### File Operations
- `read_file` - Read file contents with optional offset/limit
- `write_file` - Create/overwrite files
- `edit_file` - Edit existing files (replace text)
- `glob_files` - Find files by glob pattern
- `grep_search` - Search code with regex

### Git Operations (Read-only)
- `git_status` - Read-only git commands (status, log, diff, show, etc.)

### Execution
- `bash_command` - Execute safe bash commands (non-destructive)

### Research
- `web_search` - Search the internet for information

## 💡 Tips

1. **Start Simple**: Use test cases to understand the system
2. **Use README.md**: Put task details in README for better context
3. **Watch Thinking**: Don't use `--no-thinking` initially to see planning
4. **Press ESC**: Interrupt anytime to provide guidance
5. **Continuous Mode**: After "DONE", provide next instruction to continue
6. **Model Selection**: Let Instructor choose models, or guide when needed

## 🐛 Troubleshooting

### "readline was closed"
- Normal when running in background mode or when session ends
- Not an error in interactive mode

### Network Issues with Web Search
- Set proxy: `export https_proxy=http://localhost:1091`
- Web search uses curl, requires network access

### Tests Not Found
- Ensure working directory is correct: `-d path/to/tests`
- Check file exists: `ls tests/cases/simple-calculator/README.md`

## 📄 Project Structure

```
claude-master/
├── src/                    # Source code
│   ├── index.ts           # CLI entry point
│   ├── orchestrator.ts    # Main coordination logic
│   ├── instructor.ts      # Instructor agent
│   ├── worker.ts          # Worker agent
│   ├── client.ts          # Claude API client
│   ├── tools.ts           # Tool definitions
│   ├── tool-executor.ts   # Tool implementations
│   └── display.ts         # Console output formatting
├── tests/
│   └── cases/             # Test cases for evaluation
├── docs/                  # Documentation
└── dist/                  # Built files
```

## 🤝 Contributing

This is a personal project for orchestrating dual-AI collaboration. Feel free to fork and adapt to your needs!

## 📜 License

ISC

---

**Made with ❤️ to explore multi-agent AI collaboration**
