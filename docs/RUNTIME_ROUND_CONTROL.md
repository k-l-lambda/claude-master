# Runtime Round Control

## Overview

运行时轮数控制功能允许用户在会话过程中动态调整剩余对话轮次，无需重启系统。

**重要**: 控制命令必须出现在用户输入的**开头**，且会在传递给Instructor前被移除。

## Syntax

在用户输入消息**开头**使用以下语法：

### 增加轮次: `[r+n]`

```
[r+5] Continue the task
```

- 增加 5 轮配额
- **必须在消息开头**
- 会从消息中移除，只传递实际指令给Instructor

### 设置轮次: `[r=n]`

```
[r=10] Start new complex task
```

- 设置剩余轮次为 10
- **必须在消息开头**
- 覆盖当前剩余轮次
- 会从消息中移除，只传递实际指令给Instructor

### 组合使用

```
[r=20] [r+5] Complex task with extra rounds
```

- 先设置为 20，再增加 5
- 最终剩余 25 轮
- **所有控制命令必须在开头**
- 两个控制命令都会从消息中移除
- Instructor只看到: "Complex task with extra rounds"

## Important Notes

### ✅ 正确用法 (控制命令在开头)

```
[r+5] Implement the feature
[r=10] Start new task
[r+3] [r=5] Multiple controls
  [r+2]  With spaces (also works)
```

### ❌ 错误用法 (控制命令不在开头)

```
Implement [r+5] the feature     ← [r+5] 会被当作普通文本
Task in middle [r=10] text      ← [r=10] 不会被识别
```

## Usage Examples

### Example 1: 增加轮次

**初始状态**: 启动时 `--max-rounds 5`，剩余 5 轮

```
User: Implement the login feature [r+3]

System:
│ 📊 Added 3 rounds. Remaining: 8

Round 1 (8 left)
────────────────────────────────────────
[INSTRUCTOR] Processing User Instruction
────────────────────────────────────────

│ User Instruction: Implement the login feature
```

**结果**:
- 原消息: `Implement the login feature [r+3]`
- 解析后: `Implement the login feature`
- 剩余轮次: 5 + 3 = 8

### Example 2: 设置轮次

**当前状态**: 剩余 2 轮

```
User: [r=15] Start new complex refactoring task

System:
│ 📊 Set remaining rounds to: 15

Round 3 (15 left)
────────────────────────────────────────
[INSTRUCTOR] Processing User Instruction
────────────────────────────────────────

│ User Instruction: Start new complex refactoring task
```

**结果**:
- 原消息: `[r=15] Start new complex refactoring task`
- 解析后: `Start new complex refactoring task`
- 剩余轮次: 设置为 15（覆盖之前的 2）

### Example 3: 只有控制命令

```
User: [r+10]

System:
│ 📊 Added 10 rounds. Remaining: 12

⚠  No instruction provided after parsing round controls
```

**结果**: 只增加轮次，但因为没有实际指令，会提示并等待新输入

### Example 4: 轮次耗尽

**当前状态**: 剩余 0 轮

```
Round 5 (0 left)
────────────────────────────────────────

ERROR: No remaining rounds. Stopping.

│ Use [r+n] to add more rounds or [r=n] to set remaining rounds
```

**解决方法**:
```
User: [r+5] Continue the task
```

## Display Changes

### Round Header

**旧格式**:
```
╭─ Round 3/10 ─╮
```

**新格式**:
```
╭─ Round 3 (7 left) ─╮
```

- 显示剩余轮次而不是总轮次
- 更直观了解还能进行多少轮对话
- 如果没有限制（Infinity），不显示后缀

### Status Messages

成功解析时显示:
```
│ 📊 Added 5 rounds. Remaining: 15
```

或:
```
│ 📊 Set remaining rounds to: 20
```

## Implementation Details

### Parsing Logic (src/orchestrator.ts:107-131)

```typescript
private parseRoundControl(input: string): string {
  let cleanedInput = input;

  // Match [r+n] - add n rounds
  const addPattern = /\[r\+(\d+)\]/gi;
  const addMatches = [...input.matchAll(addPattern)];
  for (const match of addMatches) {
    const n = parseInt(match[1], 10);
    this.remainingRounds += n;
    Display.system(`📊 Added ${n} rounds. Remaining: ${this.remainingRounds}`);
    cleanedInput = cleanedInput.replace(match[0], '');
  }

  // Match [r=n] - set remaining rounds to n
  const setPattern = /\[r=(\d+)\]/gi;
  const setMatches = [...input.matchAll(setPattern)];
  for (const match of setMatches) {
    const n = parseInt(match[1], 10);
    this.remainingRounds = n;
    Display.system(`📊 Set remaining rounds to: ${this.remainingRounds}`);
    cleanedInput = cleanedInput.replace(match[0], '');
  }

  return cleanedInput.trim();
}
```

### Round Checking (src/orchestrator.ts:330-341)

```typescript
while (continueConversation && instructorResponse.shouldContinue) {
  // Check remaining rounds
  if (this.remainingRounds !== Infinity && this.remainingRounds <= 0) {
    Display.error(`No remaining rounds. Stopping.`);
    Display.system(`Use [r+n] to add more rounds or [r=n] to set remaining rounds`);
    instructorResponse.shouldContinue = false;
    break;
  }

  // Decrement remaining rounds
  if (this.remainingRounds !== Infinity) {
    this.remainingRounds--;
  }

  // ... continue with Worker
}
```

### Display Update (src/display.ts:36-44)

```typescript
static round(current: number, remainingOrMax?: number | string): void {
  let suffix = '';
  if (typeof remainingOrMax === 'number') {
    suffix = ` (${remainingOrMax} left)`;
  } else if (typeof remainingOrMax === 'string') {
    suffix = ` ${remainingOrMax}`;
  }
  console.log('\n' + this.SYSTEM_COLOR(`╭─ Round ${current}${suffix} ─╮`));
}
```

## Use Cases

### 1. 长期任务中途增加配额

```bash
# 启动时设置 5 轮
./claude-master "Complex task" -r 5

# 发现需要更多轮次
> [r+10] Continue the implementation
```

### 2. 预估错误，重新设置

```bash
# 任务比预期复杂
> [r=20] This is more complex than expected
```

### 3. 快速补充配额

```bash
# 简单地增加 5 轮
> [r+5] Continue

# 或者设置充足的配额
> [r=100] Long running task
```

### 4. 测试和调试

```bash
# 测试时先用小配额
./claude-master "Test task" -r 2

# 需要时随时增加
> [r+1] One more round for testing
```

## Benefits

1. **灵活性**: 无需重启就能调整轮次
2. **成本控制**: 根据实际需要动态分配
3. **中断恢复**: 轮次耗尽后可以继续
4. **实时调整**: 根据任务复杂度即时调整

## Notes

- 控制命令不区分大小写
- 可以在消息任意位置使用
- 多个控制命令按顺序处理
- 解析后的控制命令会从消息中移除
- 剩余轮次在每次 Worker 对话开始前递减
- 无限轮次（不设 -r）时不受影响

## Limitations

- 只能增加或设置，不能减少
- 不支持小数轮次
- 不支持负数

## Related Files

- `src/orchestrator.ts` - Round control implementation
- `src/display.ts` - Round display update
- `docs/RUNTIME_ROUND_CONTROL.md` - This document

## Status

✅ **IMPLEMENTED** - Runtime round control is fully functional and integrated into the orchestrator.
