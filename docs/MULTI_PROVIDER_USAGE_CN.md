# 多 AI 提供商支持 - 使用指南

## 概述

Claude Master 现在支持多个 AI 提供商！**Provider 会根据模型名称自动选择**，无需手动指定。

- **Claude** (Anthropic) - 默认，支持 Extended Thinking
- **Qwen** (阿里云) - OpenAI 兼容 API

## 快速开始

### 使用方式

只需指定模型名称，系统会自动选择对应的 provider：

```bash
# 使用 Claude (默认)
./dist/index.js "Your task" -i sonnet -w sonnet

# 使用 Qwen
./dist/index.js "Your task" -i qwen -w qwen

# 混合使用 (推荐)
./dist/index.js "Your task" -i sonnet -w qwen
```

### 模型名称映射

系统会自动识别模型名称并选择对应的 provider：

**Claude 模型:**
- `sonnet` → `claude-sonnet-4-5-20250929`
- `opus` → `claude-opus-4-1-20250805`
- `haiku` → `claude-haiku-4-5-20251001`
- 或任何 `claude-*` 开头的完整模型 ID

**Qwen 模型:**
- `qwen` → `Qwen/Qwen3-Coder-480B-A35B-Instruct`
- `qwen-max` → `qwen-max`
- `qwen-plus` → `qwen-plus`
- `qwen-turbo` → `qwen-turbo`
- `coder-model` → `coder-model` (OAuth)
- 或任何包含 `qwen` 的模型名称

## 配置说明

### 1. API Keys 通用配置

API key 和 base URL 参数在两个 backend 之间通用：

```bash
# 设置 API key (两个 provider 都能用)
export ANTHROPIC_API_KEY="your-claude-key"
export QWEN_API_KEY="your-qwen-key"

# 或使用通用变量
export OPENAI_API_KEY="your-key"  # Qwen 会使用这个

# 运行时只需指定模型
./dist/index.js "Task" -i sonnet -w qwen
```

### 2. 命令行选项

```bash
# 基础选项
-i, --instructor-model <model>   # Instructor 使用的模型 (自动选择 provider)
-w, --worker-model <model>       # Worker 使用的模型 (自动选择 provider)
-k, --api-key <key>              # 通用 API key (Claude 和 Qwen 都能用)
-u, --base-url <url>             # 通用 base URL

# Qwen 特定选项 (可选，用于覆盖)
--qwen-api-key <key>             # Qwen 专用 API key (优先级高于通用 key)
--qwen-base-url <url>            # Qwen 专用 base URL (优先级高于通用 URL)
--qwen-model <model>             # 当使用 "qwen" 简写时映射到的具体模型
```

## 使用示例

### 示例 1: 全 Claude (默认)

```bash
export ANTHROPIC_API_KEY="your-key"
./dist/index.js "Build a todo app"
```

### 示例 2: 全 Qwen

```bash
export QWEN_API_KEY="your-key"
./dist/index.js "Refactor code" -i qwen -w qwen
```

### 示例 3: 混合使用 (推荐)

Claude 负责规划（thinking），Qwen 负责实现（高效）：

```bash
export ANTHROPIC_API_KEY="your-claude-key"
export QWEN_API_KEY="your-qwen-key"

./dist/index.js "Build a web app" \
  -i sonnet \
  -w qwen
```

### 示例 4: 使用完整模型 ID

```bash
./dist/index.js "Task" \
  -i claude-sonnet-4-5-20250929 \
  -w qwen-max
```

### 示例 5: 使用通用 API key

```bash
# 设置一个通用 key，两个 provider 都能用
export OPENAI_API_KEY="your-key"

./dist/index.js "Task" \
  -i qwen \
  -w qwen-max
```

### 示例 6: Qwen OAuth (免费!)

```bash
# 首次认证
node tests/qwen-oauth-helper.mjs

# 然后直接使用，无需 API key
./dist/index.js "Task" -i qwen -w qwen
```

## 环境变量优先级

### 对于 Claude:
1. `--api-key` 或 `-k` (命令行)
2. `ANTHROPIC_API_KEY` (环境变量)
3. `ANTHROPIC_AUTH_TOKEN` (环境变量)

### 对于 Qwen:
1. `--qwen-api-key` (Qwen 专用命令行)
2. `--api-key` 或 `-k` (通用命令行)
3. `QWEN_API_KEY` (Qwen 专用环境变量)
4. `OPENAI_API_KEY` (OpenAI 兼容环境变量)

### 对于 Base URL:
1. `--qwen-base-url` (Qwen 专用，仅当使用 Qwen 模型)
2. `--base-url` 或 `-u` (通用)
3. `QWEN_BASE_URL` (Qwen 专用环境变量)
4. `OPENAI_BASE_URL` (OpenAI 兼容环境变量)
5. 默认值: `https://dashscope.aliyuncs.com/compatible-mode/v1`

## .env.local 配置示例

创建 `.env.local` 文件：

```bash
# Claude 配置
ANTHROPIC_API_KEY=your-claude-key
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Qwen 配置
QWEN_API_KEY=your-qwen-key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 或使用 OpenAI 兼容变量
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=your-base-url
```

然后运行：

```bash
./dist/index.js "Task" -i sonnet -w qwen
```

## Qwen OAuth 认证

最简单的方式是使用 OAuth (免费！)：

1. 运行 OAuth 辅助工具:
```bash
node tests/qwen-oauth-helper.mjs
```

2. 扫描二维码或访问 URL 登录

3. 凭证自动保存到 `~/.qwen/oauth_creds.json`

4. 直接使用，无需设置 API key:
```bash
./dist/index.js "Task" -i qwen -w qwen
```

## Worker 动态模型切换 ✨

**重要特性:** Worker 支持运行时动态切换模型和 provider！

Instructor 可以根据任务特点动态选择 Worker 使用的模型：

```typescript
// 简单任务 - 使用快速便宜的 Qwen
call_worker(
  system_prompt: "...",
  instruction: "创建一些基础文件",
  model: "qwen-turbo"  // ← 动态指定
)

// 复杂任务 - 切换到强大的 Claude
tell_worker(
  message: "现在进行复杂的重构",
  model: "sonnet"  // ← 运行时切换！
)
```

**优势:**
- 🎯 **灵活选择**: 根据任务复杂度选择最合适的模型
- 💰 **成本优化**: 简单任务用便宜模型，复杂任务用强大模型
- ⚡ **性能优化**: 快速任务用 Turbo，质量优先用 Sonnet
- 🔄 **无缝切换**: 运行时切换，无需重启
- 💾 **智能缓存**: 每个 provider 的 client 只创建一次

详细说明请参考: [Worker 动态 Client 切换文档](./WORKER_DYNAMIC_CLIENT_SWITCHING_CN.md)

## 推荐配置

### 成本优化方案（动态切换推荐）

使用 Claude thinking 能力规划，Worker 动态选择最合适的模型：

```bash
export ANTHROPIC_API_KEY="your-claude-key"
export QWEN_API_KEY="your-qwen-key"

./dist/index.js "Your complex task" \
  -i sonnet       # Claude Sonnet for planning (with thinking)
  -w qwen         # Worker 初始模型 (但可以动态切换)
```

**Instructor 策略示例:**
```typescript
// 默认使用 Qwen - 成本低
call_worker(model: "qwen", instruction: "实现基础功能")

// 复杂问题切换到 Claude - 质量高
tell_worker(model: "sonnet", message: "重构架构")

// 简单操作恢复 Qwen - 速度快
tell_worker(model: "qwen-turbo", message: "格式化代码")
```

**优势:**
- Instructor 使用 Claude Extended Thinking 深度思考规划
- Worker 根据任务自动选择最优模型
- 简单任务用 Qwen (低成本、高速度)
- 复杂任务用 Claude (高质量、强推理)
- 大部分 API 调用发生在 Worker，整体成本大幅降低

### 性能方案

使用最新最强模型：

```bash
./dist/index.js "Task" \
  -i claude-sonnet-4-5-20250929 \
  -w claude-sonnet-4-5-20250929
```

### 开发/测试方案

使用免费的 Qwen OAuth：

```bash
node tests/qwen-oauth-helper.mjs  # 一次性设置
./dist/index.js "Task" -i qwen -w qwen
```

## Provider 能力对比

| 功能 | Claude | Qwen |
|------|--------|------|
| Extended Thinking | ✅ 是 | ❌ 否 |
| Tool Calling | ✅ 是 | ✅ 是 |
| Streaming | ✅ 是 | ✅ 是 |
| Vision | ✅ 是 | ✅ 是 |
| Max Tokens | 8192 | 8192 |
| Context Window | 200K | 32K |
| 成本 | $$$ | $ |

## 故障排查

### Qwen 401 错误

1. **优先尝试 OAuth** (推荐):
   ```bash
   node tests/qwen-oauth-helper.mjs
   ```

2. **检查 API key 有效性**:
   - DashScope: https://dashscope.aliyun.com/
   - ModelScope: 可能需要绑定阿里云账号

3. **验证 base URL**:
   - DashScope: `https://dashscope.aliyuncs.com/compatible-mode/v1`
   - OAuth: 自动提供

4. **检查模型名称**:
   - DashScope: `qwen-max`, `qwen-plus`, `qwen-turbo`
   - OAuth: `coder-model`

### Provider 自动选择问题

查看启动日志，确认 provider 检测正确：

```
Starting dual-AI orchestration system
Instructor: sonnet (claude)
Worker: qwen (qwen)
```

如果检测错误，使用完整模型 ID：

```bash
./dist/index.js "Task" \
  -i claude-sonnet-4-5-20250929 \
  -w Qwen/Qwen3-Coder-480B-A35B-Instruct
```

## 常见问题

**Q: 如何知道当前使用的是哪个 provider?**

A: 启动时会显示：
```
Instructor: sonnet (claude)
Worker: qwen (qwen)
```

**Q: API key 和 base URL 在两个 provider 之间通用吗?**

A: 是的！`--api-key` 和 `--base-url` 对两个 provider 都有效。如需特定配置，使用 `--qwen-api-key` 等覆盖。

**Q: 可以 Instructor 和 Worker 使用不同 provider 吗?**

A: 可以！只需指定不同的模型即可：
```bash
./dist/index.js "Task" -i sonnet -w qwen
```

**Q: 如何添加新的 provider?**

A:
1. 实现 `AIClient` 接口
2. 在 `AIClientFactory` 中添加
3. 在 `ModelManager` 中添加模型映射
4. 更新文档

## 示例工作流

### 构建 Web 应用

```bash
export ANTHROPIC_API_KEY="your-claude-key"
export QWEN_API_KEY="your-qwen-key"

./dist/index.js "Build a React todo app with authentication" \
  -i sonnet \
  -w qwen \
  --max-rounds 30
```

### 代码重构

```bash
./dist/index.js "Refactor the authentication module for better maintainability" \
  -i qwen-max \
  -w qwen-max \
  --work-dir ./src
```

### Bug 修复

```bash
./dist/index.js "Fix the failing unit tests in test/auth.test.ts" \
  -i sonnet \
  -w qwen
```

---

**需要帮助?**
- 查看主 README.md
- 运行 `./dist/index.js --help`
- 查看测试脚本: `tests/qwen-api-test.mjs`
