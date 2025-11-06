# Architecture Overview

## System Design

这是一个双 AI 协作系统，包含两个独立的 Claude 实例：

### Instructor（指挥者）
- **角色**：理解任务、制定计划、协调 Worker
- **权限**：
  - ✅ 文件读取（read_file）
  - ✅ 文件写入（write_file）
  - ✅ 文件编辑（edit_file）
  - ✅ 文件查找（glob_files）
  - ✅ 文本搜索（grep_search）
  - ✅ Git 命令（git_command）
- **模型**：默认使用 `claude-sonnet-4-5-20250929`
- **特性**：
  - 支持 thinking（深度思考）
  - 可以动态选择 Worker 使用的模型
  - 使用 "Tell worker: ..." 格式向 Worker 发送指令
  - 使用 "DONE" 结束会话

### Worker（执行者）
- **角色**：执行具体的实现任务
- **权限**：
  - ✅ 文件读取（read_file）
  - ✅ 文件写入（write_file）
  - ✅ 文件编辑（edit_file）
  - ✅ 文件查找（glob_files）
  - ✅ 文本搜索（grep_search）
  - ✅ Bash 命令（bash_command）- 有安全限制
  - ❌ Git 命令（被排除以防止危险操作）
- **模型**：由 Instructor 动态指定，默认 `claude-sonnet-4-5-20250929`

## Agentic Loop（代理循环）

两个 AI 都实现了完整的 agentic loop，能够自主执行工具：

```
1. 接收指令
2. 调用 API（带工具定义）
   ↓
3. API 返回 tool_use？
   是 → 执行工具 → 发送 tool_result → 回到步骤 2
   否 → 提取文本响应 → 继续
```

**关键实现**：
- `InstructorManager.executeWithTools()` - Instructor 的工具执行循环
- `WorkerManager.processInstruction()` - Worker 的工具执行循环
- 最多 10 次迭代防止无限循环

## 对话流程

```
User
  ↓ (initial instruction)
Orchestrator
  ↓
Instructor (with tools)
  ↓ (analyzes task, reads files)
  ↓ "Tell worker: ..."
Worker (with tools)
  ↓ (executes tasks with tools)
  ↓ (returns result)
Instructor
  ↓ (reviews result)
  ↓ "Tell worker: ..." or "DONE"
  ...
```

## 核心组件

### `src/orchestrator.ts`
- 协调 Instructor 和 Worker 之间的对话
- 处理轮次计数和限制
- 支持 ESC 键暂停并接受用户输入
- 显示格式化的对话输出

### `src/instructor.ts`
- 管理 Instructor 的对话历史
- 实现工具执行循环
- 解析响应中的指令和模型选择
- 检测 "DONE" 标记

### `src/worker.ts`
- 管理 Worker 的对话历史
- 实现工具执行循环
- 执行来自 Instructor 的指令

### `src/tool-executor.ts`
- 统一的工具执行接口
- 实现所有工具的具体逻辑：
  - 文件操作（read/write/edit）
  - 文件查找（glob）
  - 文本搜索（grep）
  - Git 命令
  - Bash 命令（带安全检查）
- 参数验证和错误处理

### `src/client.ts`
- Anthropic API 客户端封装
- 支持流式和非流式消息
- **关键修复**：正确处理流式 API 的 `input_json_delta` 事件

### `src/tools.ts`
- 定义 Instructor 和 Worker 可用的工具
- 使用 Anthropic API 的 tool schema 格式

## 认证机制

支持两种认证方式（可以只用其中一种）：

1. **API Key** (`X-Api-Key` header)
   - 环境变量：`ANTHROPIC_API_KEY`
   - 命令行：`--api-key`

2. **Auth Token** (`Authorization: Bearer` header)
   - 环境变量：`ANTHROPIC_AUTH_TOKEN`
   - 默认使用此方式

**重要**：必须使用 `undefined` 而不是空字符串 `""` 来表示未设置的值，因为 SDK 使用 `== null` 检查。

## 代理服务器兼容性

系统设计考虑了代理服务器的限制：

- ✅ 支持不带 `thinking` 特性的代理（使用 `--no-thinking` 选项）
- ✅ 不在对话历史中保留 `tool_use` 块（某些代理不支持）
- ✅ 完整的流式响应处理，包括工具参数

## 使用示例

```bash
# 基本使用
yarn dev "Read README.md and implement the task" -d ./project

# 使用代理（不支持 thinking）
yarn dev "Your task" -d ./project --no-thinking

# 指定模型
yarn dev "Your task" -d ./project -i claude-opus-4-1-20250805

# 限制轮次
yarn dev "Your task" -d ./project -r 5
```

## 测试

- `tests/test-tool-call.js` - 验证工具调用和参数传递
- `tests/cases/simple-calculator/` - 集成测试案例

## 已知问题与解决方案

1. **流式 API 的 tool input 为空** → 已修复（参见 `docs/STREAMING_TOOL_USE_FIX.md`）
2. **代理不支持 thinking** → 使用 `--no-thinking` 选项
3. **"DONE" 误判** → 使用正则表达式 `/\bDONE\b\s*$/` 只匹配句末的 DONE
