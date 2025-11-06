# Streaming Tool Use Bug Fix

## 问题描述

在使用流式 API (`stream: true`) 时，所有的 tool_use 调用都收到了空的 input 对象 `{}`，导致工具执行失败。

## 问题表现

```
[ToolExecutor] Full toolUse object: {
  "type": "tool_use",
  "id": "toolu_bdrk_01W4NrseWuyPKrzyZfhZXqLd",
  "name": "read_file",
  "input": {}  // ❌ 应该包含 file_path 参数
}
```

错误信息：
```
Error: Missing required parameter: file_path
Error: Cannot read properties of undefined (reading 'includes')
```

## 根本原因

在 `src/client.ts` 的 `streamMessage` 方法中，我们只处理了以下流式事件：
- `message_start`
- `content_block_start`
- `content_block_delta` (只处理了 `thinking_delta` 和 `text_delta`)
- `message_delta`

**但没有处理 `input_json_delta` 事件！**

对于 tool_use，Anthropic API 的流式响应会通过多个 `input_json_delta` 事件逐步构建工具的 input 对象：

```javascript
// 事件序列示例
content_block_start: { type: 'tool_use', name: 'read_file', input: {} }
content_block_delta: { type: 'input_json_delta', partial_json: '{"file' }
content_block_delta: { type: 'input_json_delta', partial_json: '_path":"' }
content_block_delta: { type: 'input_json_delta', partial_json: 'README.md' }
content_block_delta: { type: 'input_json_delta', partial_json: '"}' }
content_block_stop: { index: 0 }
```

## 解决方案

在 `src/client.ts` 中添加对 `input_json_delta` 的处理：

```typescript
} else if (event.delta.type === 'input_json_delta') {
  // Handle tool_use input accumulation
  if (block) {
    block.partial_json = (block.partial_json || '') + event.delta.partial_json;
  }
}
```

并在 `content_block_stop` 事件中解析完整的 JSON：

```typescript
} else if (event.type === 'content_block_stop') {
  // Finalize tool_use input
  const block = contentBlocks.get(event.index);
  if (block && block.type === 'tool_use' && block.partial_json) {
    try {
      block.input = JSON.parse(block.partial_json);
      delete block.partial_json; // Clean up temporary field
    } catch (e) {
      console.error('[StreamMessage] Failed to parse tool input JSON:', e);
      block.input = {};
    }
  }
}
```

## 验证

测试脚本 `tests/test-tool-call.js` 证明了：
- ✅ 非流式 API 正常返回完整的 input 参数
- ✅ 修复后的流式 API 也能正确返回完整的 input 参数

```javascript
// 修复后的输出
Tool: read_file
Input: {
  "file_path": "README.md"
}
```

## 相关文件

- `src/client.ts` - 修复了流式响应处理
- `src/tool-executor.ts` - 添加了参数验证和更好的错误信息
- `tests/test-tool-call.js` - 验证工具调用的测试脚本

## 参考

- Anthropic API 文档：https://docs.anthropic.com/en/api/messages-streaming
- 相关 Issue：https://github.com/anthropics/anthropic-sdk-typescript/issues (如有的话)
