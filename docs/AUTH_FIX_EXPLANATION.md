# 认证问题根本原因分析

## 问题描述

使用相同的环境变量：
- ✅ `@anthropic-ai/claude-code` CLI 可以正常启动
- ❌ 基于 `@anthropic-ai/sdk` 的代码报错：`Your credit balance is too low to access the Anthropic API`

## 根本原因

### 关键发现

在 `@anthropic-ai/sdk` 中，认证检查代码如下（`src/client.ts:381-393`）：

```typescript
protected async apiKeyAuth(opts: FinalRequestOptions) {
  if (this.apiKey == null) {      // 只检查 null 或 undefined！
    return undefined;
  }
  return buildHeaders([{ 'X-Api-Key': this.apiKey }]);
}

protected async bearerAuth(opts: FinalRequestOptions) {
  if (this.authToken == null) {   // 只检查 null 或 undefined！
    return undefined;
  }
  return buildHeaders([{ Authorization: `Bearer ${this.authToken}` }]);
}
```

**关键点**：检查条件是 `== null`，这意味着：
- ✅ `null` 或 `undefined` → 不发送该认证头
- ❌ `''` (空字符串) → **会发送空的认证头！**

### SDK 构造函数的默认值

在 SDK 源码中（`third-party/claude-code/cli.js:833`）：

```javascript
class h3{constructor({
  baseURL:A=ACA("ANTHROPIC_BASE_URL"),
  apiKey:B=ACA("ANTHROPIC_API_KEY") ?? null,      // 默认值是 null，不是空字符串！
  authToken:Q=ACA("ANTHROPIC_AUTH_TOKEN") ?? null,
  ...
}={}){
```

SDK 使用 `?? null` 来确保未设置的环境变量返回 `null`，而不是空字符串。

### 问题代码 vs 正确代码

#### ❌ 问题代码（修复前）

```typescript
// src/index.ts
const authToken = process.env.ANTHROPIC_AUTH_TOKEN || '';  // 空字符串！
const apiKey = process.env.ANTHROPIC_API_KEY || '';        // 空字符串！

// 传递给 SDK
const client = new Anthropic({
  authToken: '',  // 会导致发送空的 Authorization 头
  apiKey: '',     // 会导致发送空的 X-Api-Key 头！
});
```

当 `apiKey` 是空字符串时，SDK 会发送 `X-Api-Key: ""`，服务器可能：
1. 优先检查 API Key 认证
2. 发现 API Key 无效或余额不足
3. 返回 400 错误："Your credit balance is too low"

#### ✅ 正确代码（修复后）

```typescript
// src/index.ts
const authToken = process.env.ANTHROPIC_AUTH_TOKEN || undefined;  // undefined！
const apiKey = process.env.ANTHROPIC_API_KEY || undefined;        // undefined！

// 传递给 SDK
const client = new Anthropic({
  authToken: authToken,  // undefined → SDK 内部转为 null
  apiKey: apiKey,        // undefined → SDK 内部转为 null
});
```

当 `apiKey` 是 `undefined` 或 `null` 时：
- ✅ SDK 不发送 `X-Api-Key` 头
- ✅ SDK 只发送 `Authorization: Bearer <token>` 头
- ✅ 服务器使用正确的认证方式

## Claude Code CLI 的实现

Claude Code CLI 也是这样做的（推测）：

```typescript
// Claude Code 可能的实现
const config: any = {};
if (process.env.ANTHROPIC_AUTH_TOKEN) {
  config.authToken = process.env.ANTHROPIC_AUTH_TOKEN;
}
if (process.env.ANTHROPIC_API_KEY) {
  config.apiKey = process.env.ANTHROPIC_API_KEY;
}
const client = new Anthropic(config);
```

或者使用 SDK 的默认值机制：
```typescript
const client = new Anthropic({
  // 不传递字段，让 SDK 自己从环境变量读取
  // SDK 会使用 ?? null 确保未设置时为 null
});
```

## 修复总结

### 修改文件
1. **src/index.ts** - 使用 `undefined` 代替空字符串
2. **src/types.ts** - 已经正确使用可选字段 `authToken?: string`

### 关键变化

```diff
- const authToken = process.env.ANTHROPIC_AUTH_TOKEN || '';
+ const authToken = process.env.ANTHROPIC_AUTH_TOKEN || undefined;

- const apiKey = process.env.ANTHROPIC_API_KEY || '';
+ const apiKey = process.env.ANTHROPIC_API_KEY || undefined;
```

### 测试验证

运行 `test-fix-verification.js` 证实修复有效：
- ✅ `apiKey == null` → true（不发送 X-Api-Key 头）
- ✅ `authToken == null` → false（发送 Authorization 头）
- ✅ API 调用成功

## 认证流程对比

### Claude Code CLI vs 修复前的代码

| 场景 | Claude Code CLI | 修复前的代码 | 修复后的代码 |
|-----|----------------|------------|------------|
| 只设置 ANTHROPIC_AUTH_TOKEN | authToken=值<br>apiKey=null | authToken=值<br>apiKey='' | authToken=值<br>apiKey=null |
| 发送的 HTTP 头 | ✅ Authorization: Bearer xxx | ❌ Authorization: Bearer xxx<br>❌ X-Api-Key: "" | ✅ Authorization: Bearer xxx |
| API 调用结果 | ✅ 成功 | ❌ 失败（400） | ✅ 成功 |

## 结论

**claude-code/cli.js 与 anthropic-sdk 的认证流程没有区别**，因为 Claude Code 使用 SDK 实现。

真正的区别在于：
- **Claude Code**：正确传递 `null`/`undefined` 给 SDK
- **修复前的代码**：错误传递空字符串 `''` 给 SDK，导致发送空的认证头

修复方法：**使用 `undefined` 而不是空字符串作为默认值**。
