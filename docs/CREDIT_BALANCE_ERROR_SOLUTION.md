# 问题总结：Credit Balance 错误

## 问题描述

运行 `yarn dev` 时收到错误：
```
ERROR: 400 {"error":{"message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}
```

## 真正的原因

**不是认证配置问题，而是代理服务器不支持 `thinking` 功能！**

### 测试结果

| 功能组合 | 结果 |
|---------|------|
| 基本消息 | ✅ 成功 |
| 基本消息 + tools | ✅ 成功 |
| 基本消息 + thinking | ❌ 失败（credit balance错误） |
| 基本消息 + tools + thinking | ❌ 失败（credit balance错误） |

结论：任何包含 `thinking` 参数的请求都会被代理服务器拒绝，并返回 "credit balance too low" 错误。

## 解决方案

### 方法 1：使用 `--no-thinking` 标志（推荐）

```bash
yarn dev "Read README.md to get aware your task." -d /path/to/project --no-thinking
```

### 方法 2：修改环境变量（全局禁用）

在 `.env.local` 中添加：
```
DISABLE_THINKING=true
```

然后修改代码读取这个环境变量（需要额外的代码修改）。

## 代码修改

### 1. `src/types.ts`
添加 `useThinking` 配置选项：
```typescript
export interface Config {
  authToken?: string;
  apiKey?: string;
  baseURL?: string;
  instructorModel: string;
  workerModel: string;
  maxRounds?: number;
  useThinking?: boolean;  // NEW
}
```

### 2. `src/index.ts`
添加命令行选项：
```typescript
.option('--no-thinking', 'Disable thinking feature for Instructor (use this if your API/proxy does not support thinking)')

// 在 config 中使用
const config: Config = {
  // ...
  useThinking: options.thinking !== false, // Default to true
};
```

### 3. `src/instructor.ts`
使用配置而不是硬编码：
```typescript
// 之前：
const response = await this.client.streamMessage(
  ...,
  true, // Use thinking - 硬编码
  ...
);

// 之后：
const response = await this.client.streamMessage(
  ...,
  this.config.useThinking ?? false, // 使用配置
  ...
);
```

## 关于认证的说明

认证配置已经是正确的：
- ✅ 使用 `undefined` 而不是空字符串
- ✅ SDK 正确使用 Bearer 认证
- ✅ 不发送空的 X-Api-Key 头

测试脚本验证了这一点：
```bash
node test-fix-verification.js  # ✅ 成功
node test-combinations.js      # ✅ 基本功能成功，thinking 失败
```

## 为什么代理服务器不支持 thinking？

可能的原因：
1. **Thinking 是较新的功能**：您的代理服务器可能还未实现这个功能
2. **需要更高级别订阅**：代理服务器可能限制了某些高级功能
3. **代理实现问题**：代理服务器用 "credit balance" 错误消息来拒绝不支持的功能请求

## 测试命令

### 测试不同模型
```bash
node test-models.js
```

### 测试功能组合
```bash
node test-combinations.js
```

### 验证认证修复
```bash
node test-fix-verification.js
```

### 测试完整应用（禁用thinking）
```bash
yarn dev "Your instruction" -d /path/to/project --no-thinking
```

## 建议

1. **使用 `--no-thinking` 标志**运行您的应用
2. 如果您需要 thinking 功能：
   - 联系代理服务器提供商询问支持情况
   - 或使用官方 Anthropic API（如果有 API key）
   - 或切换到支持 thinking 的代理服务器

## 成功运行示例

```bash
yarn dev "Read README.md to get aware your task." \
  -d /home/camus/work/claude-master/tests/simple-calculator \
  --no-thinking
```

输出：
```
✓ Working directory: /home/camus/work/claude-master/tests/simple-calculator
✓ Starting dual-AI orchestration system
✓ Instructor Model: claude-sonnet-4-5-20250929
✓ Worker Default Model: claude-sonnet-4-5-20250929
✓ I'll start by reading the README.md file to understand the task.
```
