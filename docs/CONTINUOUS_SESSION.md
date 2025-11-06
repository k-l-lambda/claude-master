# Continuous Session Mode

## 功能说明

系统现在支持**持续会话模式**，当 Instructor 完成一个任务后（响应 "DONE"），不会退出程序，而是等待用户输入下一个指令，形成连续的对话循环。

## 使用方式

### 方式1：直接启动进入交互模式

```bash
yarn dev -d ./project --no-thinking
```

程序启动后会提示：
```
💬 Instructor is waiting for your next instruction...
   Type your instruction, or type "exit" to quit.

Your instruction: _
```

### 方式2：提供初始指令，完成后进入交互模式

```bash
yarn dev "Read README.md and understand the task" -d ./project --no-thinking
```

Instructor 完成初始任务后，会显示：
```
✓ Instructor has completed the current task

💬 Instructor is waiting for your next instruction...
   Type your instruction, or type "exit" to quit.

Your instruction: _
```

## 会话流程

```
┌─────────────────────────────────────────────┐
│ 启动程序                                    │
└──────────────────┬──────────────────────────┘
                   ↓
        ┌──────────────────────┐
        │ 等待用户输入指令      │ ← ─ ─ ─ ┐
        └──────────┬───────────┘         │
                   ↓                      │
        ┌──────────────────────┐         │
        │ Instructor 处理指令   │         │
        └──────────┬───────────┘         │
                   ↓                      │
        ┌──────────────────────┐         │
        │ Worker 执行任务       │         │
        └──────────┬───────────┘         │
                   ↓                      │
        ┌──────────────────────┐         │
        │ Instructor 审查结果   │         │
        └──────────┬───────────┘         │
                   ↓                      │
           ┌───────────────┐             │
           │ 是否说 DONE？  │             │
           └───┬───────┬───┘             │
               │ 是    │ 否              │
               ↓       └─────────────────┤
        ┌──────────────────────┐         │
        │ 任务完成             │         │
        └──────────┬───────────┘         │
                   │                      │
                   └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                   (循环)

        用户输入 "exit" → 退出程序
```

## 退出方式

在等待输入时，有以下方式退出：

1. 输入 `exit` 或 `quit`
2. 按 `Ctrl+C`
3. 按 `Ctrl+D` (EOF)

## 暂停功能（ESC 键）

在任务执行过程中，可以按 `ESC` 键暂停并给 Instructor 发送新指令：

```
⏸️  Execution paused by user (ESC pressed)

Enter your instruction to Instructor (or press Enter to resume): _
```

输入指令后，Instructor 会处理该指令，然后继续之前的任务。

## 实现细节

### 外层循环
```typescript
while (continueSession) {
  // 等待用户输入
  if (!instructorResponse || !instructorResponse.shouldContinue) {
    const userInstruction = await this.waitForUserInput();
    if (!userInstruction) break; // 用户输入 exit

    // 处理用户指令
    instructorResponse = await this.instructor.processUserInput(userInstruction);
  }

  // Instructor-Worker 对话循环
  while (instructorResponse.shouldContinue) {
    // Worker 执行 → Instructor 审查 → ...
  }
}
```

### 状态管理
- `instructorResponse.shouldContinue === false` → 任务完成，回到等待输入
- `userInstruction === null` → 用户输入 exit，退出程序
- `instructorResponse.shouldContinue === true` → 继续 Instructor-Worker 循环

## 使用场景

### 场景1：多个独立任务
```bash
$ yarn dev -d ./project --no-thinking

Your instruction: Read and analyze the codebase structure
[Instructor 完成分析...]

✓ Instructor has completed the current task
Your instruction: Now write unit tests for the main module
[Instructor 指导 Worker 写测试...]

✓ Instructor has completed the current task
Your instruction: Run tests and fix any failures
[继续...]

Your instruction: exit
✓ Session ended
```

### 场景2：迭代开发
```bash
$ yarn dev "Implement user authentication" -d ./project

[Instructor 完成初始实现...]

✓ Instructor has completed the current task
Your instruction: Add password validation
[继续迭代...]

Your instruction: Add email verification
[继续迭代...]

Your instruction: exit
✓ Session ended
```

### 场景3：问答式探索
```bash
$ yarn dev -d ./project

Your instruction: What are the main components in this project?
[Instructor 分析并回答...]

Your instruction: How does the authentication flow work?
[Instructor 解释...]

Your instruction: Show me examples of API endpoints
[Instructor 展示...]

Your instruction: exit
```

## 与之前版本的区别

### 旧版本
```bash
yarn dev "Do task A" -d ./project
# 完成任务 A → 退出

yarn dev "Do task B" -d ./project
# 完成任务 B → 退出
```

每次都需要重新启动，Instructor 失去了之前的上下文。

### 新版本
```bash
yarn dev -d ./project
Your instruction: Do task A
# 完成任务 A
Your instruction: Do task B (继续之前的上下文)
# 完成任务 B
Your instruction: Do task C (继续之前的上下文)
# 完成任务 C
Your instruction: exit
```

在同一个会话中完成多个任务，**Instructor 保留完整的对话历史**。

## 配置选项

所有命令行选项在持续会话中都有效：

- `-r, --max-rounds <number>` - 每个任务的最大轮次
- `-i, --instructor-model <model>` - Instructor 使用的模型
- `-w, --worker-model <model>` - Worker 默认模型（可被 Instructor 动态修改）
- `--no-thinking` - 禁用 thinking 功能

## 注意事项

1. **对话历史累积**：Instructor 和 Worker 的对话历史会在整个会话中保留，有助于上下文理解，但也会增加 token 消耗

2. **轮次计数器**：`currentRound` 在整个会话中累加，不会在新任务开始时重置

3. **错误处理**：如果任务执行出错，可以在下一个指令中继续，或输入 `exit` 退出

4. **Ctrl+C 行为**：在等待输入时按 Ctrl+C 会正常退出；在任务执行中按 Ctrl+C 会中断程序

## 相关文件

- `src/orchestrator.ts` - 实现持续会话循环
- `src/index.ts` - 将 instruction 参数改为可选
- `docs/ARCHITECTURE.md` - 系统架构文档
