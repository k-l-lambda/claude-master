# Development Environment Setup Guide

## Overview

This guide covers setting up development environments for:
1. **anthropic-sdk-typescript** - The TypeScript SDK (open source, testable)
2. **claude-code** - Plugin examples and documentation (no source code, not testable)

---

## 1. anthropic-sdk-typescript Setup

### Location
```
/home/camus/work/claude-master/third-party/anthropic-sdk-typescript/
```

### Prerequisites
- Node.js 18+
- Yarn 1.22.22 (specified in package.json)

### Setup Steps

#### 1.1 Install Yarn (if not already installed)
```bash
npm install -g yarn@1.22.22
```

#### 1.2 Navigate to SDK directory
```bash
cd /home/camus/work/claude-master/third-party/anthropic-sdk-typescript
```

#### 1.3 Install dependencies
```bash
yarn install
```

#### 1.4 Build the project
```bash
yarn build
# or
./scripts/build-all
```

### Available Scripts

From `package.json`:

```bash
# Run tests
yarn test
# or
./scripts/test

# Build the project
yarn build
./scripts/build-all

# Lint code
yarn lint
./scripts/lint

# Format code
yarn format
./scripts/format

# Fix formatting
yarn fix
```

### Running Tests

```bash
cd /home/camus/work/claude-master/third-party/anthropic-sdk-typescript

# Run all tests
yarn test

# Or use the script directly
./scripts/test
```

The test script:
- Uses Jest test framework
- May start a mock server (Prism) on port 4010
- Runs all test files in the project
- Located in `tests/` directory

### Project Structure

```
anthropic-sdk-typescript/
├── src/                    # TypeScript source code
│   ├── client.ts          # Main client implementation
│   ├── resources/         # API resources
│   ├── internal/          # Internal utilities
│   └── ...
├── tests/                 # Jest test files
├── dist/                  # Compiled JavaScript (after build)
├── scripts/               # Build and test scripts
├── package.json
└── tsconfig.json
```

### Development Workflow

1. **Make changes** to TypeScript files in `src/`
2. **Build** the project: `yarn build`
3. **Run tests**: `yarn test`
4. **Format code**: `yarn format`
5. **Lint**: `yarn lint`

---

## 2. claude-code Repository

### Location
```
/home/camus/work/claude-master/third-party/claude-code/
```

### ⚠️ Important Note

**This repository does NOT contain the Claude Code source code.**

It contains:
- Plugin examples
- Documentation
- Examples
- Plugin development guides

The actual Claude Code CLI tool is **closed source** and distributed as a compiled npm package.

### What's in the Repository

```
claude-code/
├── plugins/                # Example plugins
│   ├── agent-sdk-dev/     # Agent SDK dev plugin
│   ├── code-review/       # Code review plugin
│   ├── commit-commands/   # Git workflow plugin
│   ├── feature-dev/       # Feature development plugin
│   └── ...
├── examples/              # Usage examples
├── .claude/               # Claude Code configuration examples
├── CHANGELOG.md           # Version history
└── README.md              # Documentation
```

### Using the Plugins

#### Option 1: Copy plugins to your project
```bash
# Copy a plugin to your project
cp -r /home/camus/work/claude-master/third-party/claude-code/plugins/commit-commands \
      /path/to/your/project/.claude/plugins/
```

#### Option 2: Link plugins for development
```bash
# In your project's .claude/settings.json
{
  "plugins": [
    {
      "name": "commit-commands",
      "path": "/home/camus/work/claude-master/third-party/claude-code/plugins/commit-commands"
    }
  ]
}
```

### Exploring Plugins

Each plugin has its own structure:

```bash
# Example: Exploring commit-commands plugin
cd /home/camus/work/claude-master/third-party/claude-code/plugins/commit-commands

# Check plugin structure
ls -la

# Read plugin documentation
cat README.md

# View plugin metadata
cat .claude-plugin/plugin.json

# Check commands
ls commands/

# Check agents (if any)
ls agents/ 2>/dev/null || echo "No agents in this plugin"
```

### "Testing" Claude Code

Since the source is not available, you can test the **plugins** by:

1. **Install Claude Code globally** (if not already):
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Create a test project**:
   ```bash
   mkdir ~/claude-code-test
   cd ~/claude-code-test
   mkdir -p .claude/plugins
   ```

3. **Copy a plugin to test**:
   ```bash
   cp -r /home/camus/work/claude-master/third-party/claude-code/plugins/commit-commands \
         .claude/plugins/
   ```

4. **Run Claude Code**:
   ```bash
   claude
   ```

5. **Test the plugin command**:
   ```
   /commit
   ```

---

## 3. Quick Command Reference

### SDK Development

```bash
# Full workflow
cd /home/camus/work/claude-master/third-party/anthropic-sdk-typescript
yarn install
yarn build
yarn test

# Watch for changes (if available)
yarn test --watch

# Run specific test file
yarn test tests/api-resources/messages.test.ts
```

### Claude Code Plugin Development

```bash
# Explore plugins
cd /home/camus/work/claude-master/third-party/claude-code/plugins
ls -la

# Read plugin docs
cat commit-commands/README.md
cat feature-dev/README.md

# View plugin structure
tree commit-commands -L 2

# Test a plugin in a project
mkdir ~/test-project && cd ~/test-project
cp -r /home/camus/work/claude-master/third-party/claude-code/plugins/commit-commands \
      .claude/plugins/
claude
```

---

## 4. Environment Setup Summary

### For SDK (anthropic-sdk-typescript)

✅ **Can develop:** Yes, full source code available
✅ **Can test:** Yes, Jest tests available
✅ **Can build:** Yes, TypeScript compilation
✅ **Can modify:** Yes, open source

**Setup command:**
```bash
cd /home/camus/work/claude-master/third-party/anthropic-sdk-typescript && \
yarn install && yarn build && yarn test
```

### For Claude Code

❌ **Can develop:** No, closed source
❌ **Can test:** No tests (documentation repo only)
✅ **Can use plugins:** Yes, copy and use in projects
✅ **Can create plugins:** Yes, following plugin structure

**Plugin exploration:**
```bash
cd /home/camus/work/claude-master/third-party/claude-code/plugins
cat */README.md  # Read all plugin docs
```

---

## 5. Troubleshooting

### SDK Issues

**Problem:** `yarn: command not found`
```bash
npm install -g yarn@1.22.22
```

**Problem:** Test failures
```bash
# Check if mock server is running
curl http://localhost:4010

# Kill existing processes on port 4010
lsof -ti:4010 | xargs kill -9

# Retry tests
yarn test
```

**Problem:** Build errors
```bash
# Clean and rebuild
rm -rf dist node_modules
yarn install
yarn build
```

### Claude Code Issues

**Problem:** "No source code to test"
- **Solution:** This is expected. The repo only contains plugins and documentation.

**Problem:** Want to test plugins
- **Solution:** Copy plugins to a project and use with installed `claude` CLI

---

## 6. Next Steps

### SDK Development
1. Read `third-party/anthropic-sdk-typescript/README.md`
2. Explore `src/client.ts` for authentication code
3. Check `tests/` for test examples
4. Make changes and run `yarn test`

### Plugin Development
1. Read plugin docs: `third-party/claude-code/plugins/*/README.md`
2. Study plugin structure in `.claude-plugin/plugin.json`
3. Create your own plugin following the structure
4. Test with installed Claude Code CLI

---

## Summary

**SDK (anthropic-sdk-typescript):**
```bash
cd third-party/anthropic-sdk-typescript
yarn install && yarn build && yarn test
```

**Claude Code:**
- No tests available (documentation repo)
- Use plugins by copying to your projects
- Test plugins with installed `claude` command
