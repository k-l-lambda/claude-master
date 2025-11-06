# 完整解决方案：Credit Balance 错误

## 问题根本原因

您的代理服务器（`https://api.jiekou.ai/anthropic`）有两个限制：

### 1. ❌ 不支持 `thinking` 功能
任何包含 `thinking` 参数的请求都会被拒绝。

### 2. ❌ 不支持对话历史中的 `tool_use` 内容块
当 assistant 的 content 包含 `tool_use` 块时，请求会失败并返回 "credit balance too low" 错误。

## 测试验证

```bash
node test-content-formats.js
```

结果：
- ✅ assistant content 是字符串 → 成功
- ✅ assistant content 是数组（只有 text） → 成功
- ❌ assistant content 是数组（有 tool_use） → **失败**
- ✅ assistant 没有 tool_use → 成功

## 完整修复

### 修改 1：添加 `--no-thinking` 选项

**文件：`src/types.ts`**
```typescript
export interface Config {
  authToken?: string;
  apiKey?: string;
  baseURL?: string;
  instructorModel: string;
  workerModel: string;
  maxRounds?: number;
  useThinking?: boolean;  // 新增
}
```

**文件：`src/index.ts`**
```typescript
.option('--no-thinking', 'Disable thinking feature for Instructor')

const config: Config = {
  // ...
  useThinking: options.thinking !== false,
};
```

**文件：`src/instructor.ts`**
```typescript
// 将硬编码的 true 改为：
this.config.useThinking ?? false
```

### 修改 2：过滤 `tool_use` 块

**文件：`src/instructor.ts`**

在保存对话历史时过滤掉 `tool_use` 块：

```typescript
// 之前：
this.conversationHistory.push({
  role: 'assistant',
  content: response.content,  // 包含 tool_use 块
});

// 之后：
this.conversationHistory.push({
  role: 'assistant',
  content: response.content.filter(
    block => block.type === 'text' || block.type === 'thinking'
  ),  // 只保留 text 和 thinking 块
});
```

### 修改 3：修复认证配置

**文件：`src/index.ts`**

使用 `undefined` 而不是空字符串：

```typescript
// 之前：
const authToken = process.env.ANTHROPIC_AUTH_TOKEN || '';
const apiKey = process.env.ANTHROPIC_API_KEY || '';

// 之后：
const authToken = process.env.ANTHROPIC_AUTH_TOKEN || undefined;
const apiKey = process.env.ANTHROPIC_API_KEY || undefined;
```

## 使用方法

### 运行应用

```bash
yarn dev "Read README.md to get aware your task." \
  -d /path/to/project \
  --no-thinking
```

### 所有命令行选项

```bash
Usage: claude-master [options] <instruction>

Options:
  -d, --work-dir <path>           Working directory
  -r, --max-rounds <number>       Maximum number of conversation rounds
  -i, --instructor-model <model>  Model for Instructor
  -w, --worker-model <model>      Default model for Worker
  -k, --api-key <key>            Anthropic API key
  -u, --base-url <url>           API base URL
  --no-thinking                   Disable thinking feature
  -h, --help                      Display help
```

## 测试脚本

### 1. 验证认证修复
```bash
node test-fix-verification.js
```

### 2. 测试不同功能组合
```bash
node test-combinations.js
```

### 3. 测试 content 格式
```bash
node test-content-formats.js
```

### 4. 测试多次调用
```bash
node test-multiple-calls.js
```

## 成功运行示例

```bash
$ yarn dev "Read README.md to get aware your task." \
    -d /home/camus/work/claude-master/tests/simple-calculator \
    --no-thinking

✓ Working directory: /home/camus/work/claude-master/tests/simple-calculator
✓ Starting dual-AI orchestration system
✓ Instructor Model: claude-sonnet-4-5-20250929
✓ Worker Default Model: claude-sonnet-4-5-20250929

╭─ Round 1 ─╮
[INSTRUCTOR] Processing Initial Instruction
I'll start by reading the README.md file to understand the task.

[WORKER] Processing Instruction
I'll help you read the README.md file to understand the task.

╭─ Round 2 ─╮
[INSTRUCTOR] Reviewing Worker Response

✓ Instructor has completed the task
✓ Task completed successfully
```

## 为什么会有这些限制？

### Thinking 限制
- Thinking 是 Anthropic 较新的功能（2025年推出）
- 您的代理服务器可能还未实现此功能
- 或者需要更高级别的订阅

### Tool Use 历史限制
- 代理服务器可能简化了实现，不支持完整的工具使用历史
- 或者为了降低成本，限制了复杂的对话结构
- 这是代理服务器的实现限制，官方 API 支持此功能

## 如果需要完整功能

如果您需要 thinking 功能和完整的 tool use 支持：

1. **使用官方 Anthropic API**
   ```bash
   # 设置 API Key
   export ANTHROPIC_API_KEY=your_api_key

   # 不设置 ANTHROPIC_BASE_URL（使用官方 API）
   unset ANTHROPIC_BASE_URL

   # 运行（可以不用 --no-thinking）
   yarn dev "Your instruction" -d /path/to/project
   ```

2. **切换到其他代理服务器**
   找一个支持完整功能的代理服务器

## 技术细节

### 为什么过滤 tool_use 块有效？

Anthropic API 的对话历史有两种模式：

1. **完整模式**（官方 API）：
   ```javascript
   messages: [
     { role: 'assistant', content: [
       { type: 'text', text: '...' },
       { type: 'tool_use', id: '...', name: '...', input: {...} }
     ]},
     { role: 'user', content: [
       { type: 'tool_result', tool_use_id: '...', content: '...' }
     ]}
   ]
   ```

2. **简化模式**（您的代理支持）：
   ```javascript
   messages: [
     { role: 'assistant', content: [
       { type: 'text', text: '...' }
     ]},
     { role: 'user', content: 'Next instruction...' }
   ]
   ```

我们的修复将完整模式转换为简化模式，移除 tool_use 和 tool_result，只保留文本内容。这对您的应用是可行的，因为：

- Instructor 不需要知道 Worker 使用了哪些工具
- Instructor 只需要知道 Worker 返回的结果（文本）
- 工具调用的细节不影响 Instructor 的决策

## 总结

✅ **所有问题已解决**：
1. 认证配置：使用 `undefined` 代替空字符串
2. Thinking 功能：添加 `--no-thinking` 选项禁用
3. Tool Use 历史：自动过滤 `tool_use` 块

现在您可以正常使用应用了！🚀
