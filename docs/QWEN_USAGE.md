# Qwen Integration - Usage Guide

## Overview

Claude Master now supports multiple AI providers! You can use:
- **Claude** (Anthropic) - Default, with extended thinking support
- **Qwen** (Alibaba Cloud) - OpenAI-compatible API

You can mix and match providers for Instructor and Worker roles.

## Quick Start

### Using Qwen

```bash
# Set up Qwen OAuth authentication (recommended - free!)
node tests/qwen-oauth-helper.mjs

# Or use API key
export QWEN_API_KEY="sk-your-key-here"
export QWEN_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
export QWEN_MODEL="qwen-max"

# Run with Qwen for both Instructor and Worker
./dist/index.js "Your task here" --provider qwen
```

### Mixed Providers (Recommended)

Use Claude for Instructor (thinking capability) and Qwen for Worker (cost-effective):

```bash
# Set up both providers
export ANTHROPIC_AUTH_TOKEN="your-claude-token"
export QWEN_API_KEY="your-qwen-key"  # Or use OAuth

# Run with mixed providers
./dist/index.js "Your task here" \
  --instructor-provider claude \
  --worker-provider qwen
```

## Command-Line Options

### Provider Selection

- `-p, --provider <provider>` - Set provider for both Instructor and Worker (claude|qwen)
- `--instructor-provider <provider>` - Override provider for Instructor only
- `--worker-provider <provider>` - Override provider for Worker only

### Qwen Configuration

- `--qwen-api-key <key>` - Qwen API key (or use QWEN_API_KEY env var)
- `--qwen-base-url <url>` - Qwen API base URL (or use QWEN_BASE_URL env var)
- `--qwen-model <model>` - Qwen model name (or use QWEN_MODEL env var)

## Configuration Examples

### 1. All Claude (Default)

```bash
export ANTHROPIC_AUTH_TOKEN="your-token"
./dist/index.js "Task description"
```

### 2. All Qwen

```bash
export QWEN_API_KEY="sk-xxx"
./dist/index.js "Task description" --provider qwen
```

### 3. Claude Instructor + Qwen Worker (Recommended)

Best of both worlds: Claude's thinking for planning, Qwen's efficiency for implementation.

```bash
export ANTHROPIC_AUTH_TOKEN="your-claude-token"
export QWEN_API_KEY="your-qwen-key"

./dist/index.js "Task description" \
  --instructor-provider claude \
  --worker-provider qwen \
  --instructor-model claude-sonnet-4-5-20250929 \
  --worker-model qwen-max
```

### 4. Using .env.local

Create `.env.local` in your project directory:

```bash
# Claude configuration
ANTHROPIC_AUTH_TOKEN=your-claude-token
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Qwen configuration
QWEN_API_KEY=your-qwen-key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-max

# Provider selection (optional)
# INSTRUCTOR_PROVIDER=claude
# WORKER_PROVIDER=qwen
```

Then run without explicit options:

```bash
./dist/index.js "Task description" \
  --instructor-provider claude \
  --worker-provider qwen
```

## Qwen OAuth Authentication

The easiest way to use Qwen is with OAuth (free access with Qwen Chat account):

1. Run the OAuth helper:
```bash
node tests/qwen-oauth-helper.mjs
```

2. Scan the QR code or visit the URL in your browser

3. Log in with your Qwen Chat account

4. Credentials are automatically saved to `~/.qwen/oauth_creds.json`

5. Use Qwen without setting QWEN_API_KEY:
```bash
./dist/index.js "Task" --provider qwen
```

The OAuth token will be used automatically!

## Qwen API Options

### DashScope (Recommended)
- Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- Models: `qwen-max`, `qwen-plus`, `qwen-turbo`
- Requires: Alibaba Cloud account + API key
- Get key: https://dashscope.aliyun.com/

### ModelScope
- Base URL: `https://api-inference.modelscope.cn/v1`
- Models: Various Qwen models
- Requires: Alibaba Cloud account binding
- Get key: https://www.modelscope.cn/my/myaccesstoken

### Qwen Chat OAuth (Easiest!)
- Base URL: Provided automatically via OAuth
- Model: `coder-model` (maps to qwen3-coder-plus)
- Requires: Qwen Chat account (free!)
- Setup: Run `node tests/qwen-oauth-helper.mjs`

## Model Recommendations

### For Instructor (Planning & Decision Making)
- **Claude Sonnet 4.5** - Best thinking capability ✅ Recommended
- Qwen Max - Good alternative if Claude unavailable

### For Worker (Implementation)
- **Qwen Max** - Fast, cost-effective ✅ Recommended
- Qwen Plus - Balanced performance/cost
- Claude Sonnet 4 - Premium option

### Mixed Setup (Best Value)
```bash
--instructor-provider claude --instructor-model claude-sonnet-4-5-20250929 \
--worker-provider qwen --worker-model qwen-max
```

This combines Claude's superior planning with Qwen's efficient execution!

## Provider Capabilities

| Feature | Claude | Qwen |
|---------|--------|------|
| Extended Thinking | ✅ Yes | ❌ No |
| Tool Calling | ✅ Yes | ✅ Yes |
| Streaming | ✅ Yes | ✅ Yes |
| Vision | ✅ Yes | ✅ Yes |
| Max Tokens | 8192 | 8192 |
| Context Window | 200K | 32K |

## Troubleshooting

### Qwen Authentication Errors

If you get 401 errors:

1. **Try OAuth first** (recommended):
   ```bash
   node tests/qwen-oauth-helper.mjs
   ```

2. **Check API key validity**:
   - DashScope: Visit https://dashscope.aliyun.com/
   - ModelScope: May require Alibaba Cloud binding

3. **Verify base URL**:
   - DashScope: `https://dashscope.aliyuncs.com/compatible-mode/v1`
   - OAuth: Provided automatically

4. **Check model name**:
   - DashScope: `qwen-max`, `qwen-plus`, `qwen-turbo`
   - OAuth: `coder-model`

### Tool Calling Issues

Both Claude and Qwen support tool calling. If you see tool-related errors:

1. Ensure you're using a model that supports function calling
2. Check that the provider is properly configured
3. Verify API credentials are correct

## Examples

### Example 1: Build a web application

```bash
./dist/index.js "Build a simple todo app with React" \
  --instructor-provider claude \
  --worker-provider qwen \
  --max-rounds 20
```

### Example 2: Refactor codebase

```bash
./dist/index.js "Refactor the authentication module" \
  --provider qwen \
  --work-dir ./src
```

### Example 3: Debug and fix issues

```bash
./dist/index.js "Fix the failing unit tests" \
  --instructor-provider claude \
  --worker-provider qwen
```

## Cost Comparison

Approximate costs (check provider websites for current pricing):

- Claude Sonnet 4: $$$ (Premium)
- Claude Sonnet 3.5: $$ (Mid-range)
- Qwen Max: $ (Affordable)
- Qwen Plus: $ (Very affordable)
- Qwen with OAuth: FREE! (with daily limits)

**Recommended setup for cost optimization:**
- Instructor: Claude Sonnet 4.5 (thinking capability worth the cost)
- Worker: Qwen (most API calls happen here, save significantly!)

---

**Need help?** See the main README.md or run `./dist/index.js --help`
