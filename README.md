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

```bash
# Install dependencies
npm install
npm run build

# Set up your API key
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_AUTH_TOKEN

# Run a simple test
npm start "Read README.md to understand your task" -d tests/cases/simple-calculator --no-thinking
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

Tools: File operations, Git commands

**Worker (Implementation Executor)**
- Executes specific instructions
- Writes and modifies code
- Runs commands (npm, build, test)
- Searches the web for documentation
- Reports results back

Tools: File operations, Bash commands, Web search

### Communication Flow

```
User → Instructor (with task)
         ↓
   [Thinks deeply about approach]
         ↓
   Tell worker (use sonnet): Create project structure
         ↓
      Worker → [Executes task]
         ↓
   Worker says: [Result]
         ↓
   Instructor → Reviews and continues or says DONE
```

## 🎮 Usage

### Basic Pattern

1. **Put task details in README.md** (recommended)
2. **Run with initial instruction**:
```bash
npm start "Read README.md to get aware your task" -d ./your-project
```

### Communication Formats

Instructor communicates with Worker using:

```bash
# Simple format
Tell worker: [instruction]

# With model selection
Tell worker (use opus): [complex instruction]
Tell worker (model: haiku): [quick command]

# Task completion
**DONE**
```

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
npm start <instruction> [options]
```

**Arguments:**
- `<instruction>` - Initial instruction for Instructor (can be provided later interactively)

**Options:**
- `-d, --work-dir <path>` - Working directory (default: current)
- `-r, --max-rounds <number>` - Maximum conversation rounds
- `-i, --instructor-model <model>` - Instructor model
- `-w, --worker-model <model>` - Worker default model
- `-k, --api-key <key>` - Anthropic API key
- `-u, --base-url <url>` - API base URL
- `--no-thinking` - Disable thinking display

## 🎯 Example Use Cases

### 1. Simple Calculator (TDD)
```bash
npm start "Read README.md to understand your task" \
  -d tests/cases/simple-calculator \
  --no-thinking
```

### 2. Todo List Application
```bash
npm start "Read README.md to understand your task" \
  -d tests/cases/easy-todo-list \
  --no-thinking
```

### 3. HTTP API Client Library
```bash
npm start "Read README.md to understand your task" \
  -d tests/cases/api-client-library \
  --no-thinking
```

### 4. Expense Tracker (Advanced)
```bash
npm start "Read README.md to understand your task" \
  -d tests/cases/expense-tracker \
  --no-thinking
```

### 5. Blog CMS Backend (Complex)
```bash
npm start "Read README.md to understand your task" \
  -d tests/cases/blog-cms-backend \
  --no-thinking
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

```bash
# Development mode with auto-reload
npm run dev "Your task" -d ./project

# Build
npm run build

# Run tests
npm test

# Type checking
npm run type-check
```

## 📚 Documentation

- [Communication Protocol](docs/COMMUNICATION_PROTOCOL.md) - Detailed communication formats
- [Continuous Session](docs/CONTINUOUS_SESSION.md) - Session management (中文)
- [Test Cases Guide](tests/cases/README.md) - All available test cases
- [Architecture](docs/ARCHITECTURE.md) - System architecture (中文)

## 🔍 Worker Tools

### File Operations
- `read_file` - Read file contents with optional offset/limit
- `write_file` - Create new files
- `edit_file` - Edit existing files (replace text)
- `glob_files` - Find files by glob pattern
- `grep_search` - Search code with regex

### Execution
- `bash_command` - Execute safe bash commands (git blocked)

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
