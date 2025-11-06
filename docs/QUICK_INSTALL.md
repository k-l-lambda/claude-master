# Quick Install Guide

This is the **fastest way** to install `claude-master`.

## Prerequisites

- Node.js >= 18.0.0
- npm (comes with Node.js)

## Step 1: Install

```bash
# Install globally from npm - no authentication required!
npm install -g @k-l-lambda/claude-master
```

That's it! The package is publicly available on npmjs.com.

## Step 2: Verify Installation

```bash
# Check version
claude-master --version

# View help
claude-master --help
```

## Step 3: Configure API Key

```bash
# Set your Anthropic API key
export ANTHROPIC_AUTH_TOKEN="your-anthropic-api-key"

# Or add to your shell profile (~/.bashrc or ~/.zshrc)
echo 'export ANTHROPIC_AUTH_TOKEN="your-anthropic-api-key"' >> ~/.bashrc
source ~/.bashrc
```

## Step 4: Test

```bash
# Show help
claude-master --help

# Run a test
cd /path/to/your/project
claude-master "Read README.md to understand the task"
```

## Done! 🎉

You can now use `claude-master` from any directory.

## Updating

```bash
npm update -g @k-l-lambda/claude-master
```

## Uninstalling

```bash
npm uninstall -g @k-l-lambda/claude-master
```

## Next Steps

- Check out the [full documentation](../README.md)
- Try the [test cases](../tests/cases/README.md)
- Read about the [communication protocol](COMMUNICATION_PROTOCOL.md)
