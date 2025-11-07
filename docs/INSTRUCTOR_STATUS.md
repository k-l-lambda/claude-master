# Instructor Status Display

## Overview

每轮 Instructor 响应后，在控制台打印一行状态信息，使用 emoji 图标直观显示关键状态，便于观察和调试。

## Status Line Format

```
[Status] 🧠 Opus | ▶️  Continue | ✅ OK
```

## Emoji Icons

### 模型 (Worker Model)

| Emoji | Model | 含义 |
|-------|-------|------|
| 🧠 | Opus | 最强大，适合复杂任务 |
| 🚀 | Sonnet | 平衡性能，默认模型 |
| ⚡ | Haiku | 最快速，适合简单任务 |

### 继续状态 (shouldContinue)

| Emoji | 状态 | 含义 |
|-------|------|------|
| ▶️  | Continue | 会继续到 Worker 对话 |
| ⏹️  | Stop | 停止（DONE 或需要纠正）|

### 格式状态 (needsCorrection)

| Emoji | 状态 | 含义 |
|-------|------|------|
| ✅ | OK | 格式正确（有 "tell worker:" 或 "DONE"）|
| ⚠️  | Needs correction | 需要纠正格式 |

## Example Scenarios

### Scenario 1: 正常指令（Sonnet）

```
Instructor 输出:
  "Let me analyze this. Tell worker: Read the file src/index.ts"

状态显示:
  [Status] 🚀 Sonnet | ▶️  Continue | ✅ OK

解释:
  - 使用 Sonnet 模型
  - 会继续到 Worker
  - 格式正确
```

### Scenario 2: 使用 Opus 模型

```
Instructor 输出:
  "This requires deep analysis. Tell worker (use opus): Analyze the entire system architecture"

状态显示:
  [Status] 🧠 Opus | ▶️  Continue | ✅ OK

解释:
  - Instructor 指定使用强大的 Opus 模型
  - 会继续到 Worker
  - 格式正确
```

### Scenario 3: 使用 Haiku 模型

```
Instructor 输出:
  "Simple task. Tell worker (use haiku): List all TypeScript files"

状态显示:
  [Status] ⚡ Haiku | ▶️  Continue | ✅ OK

解释:
  - Instructor 选择快速的 Haiku 模型
  - 会继续到 Worker
  - 格式正确
```

### Scenario 4: 任务完成

```
Instructor 输出:
  "All changes have been verified. DONE"

状态显示:
  [Status] 🚀 Sonnet | ⏹️  Stop | ✅ OK

解释:
  - 默认 Sonnet（不再需要 Worker）
  - 停止对话（任务完成）
  - 格式正确（有 DONE）
```

### Scenario 5: 需要纠正格式

```
Instructor 输出:
  "Now let me commit these changes to git..."

状态显示:
  [Status] 🚀 Sonnet | ⏹️  Stop | ⚠️  Needs correction

系统提示:
  ⚠️  Instructor did not use the correct communication format.
     To communicate with Worker, use: "Tell worker: [instruction]"
     To finish the task, respond with: "DONE"

解释:
  - 默认 Sonnet
  - 停止（需要纠正）
  - 格式不正确（缺少 "tell worker:" 或 "DONE"）
```

### Scenario 6: 纠正后继续

```
Instructor 输出:
  "Tell worker: Run git commit with the message 'Update docs'"

状态显示:
  [Status] 🚀 Sonnet | ▶️  Continue | ✅ OK

解释:
  - 使用 Sonnet
  - 纠正后继续到 Worker
  - 格式正确
```

## Implementation

### Display Class (src/display.ts:83-111)

```typescript
static instructorStatus(workerModel: string, shouldContinue: boolean, needsCorrection: boolean): void {
  // Model emoji
  let modelEmoji = '🚀'; // default sonnet
  if (workerModel.includes('opus')) {
    modelEmoji = '🧠'; // Opus - powerful brain
  } else if (workerModel.includes('haiku')) {
    modelEmoji = '⚡'; // Haiku - fast lightning
  } else if (workerModel.includes('sonnet')) {
    modelEmoji = '🚀'; // Sonnet - balanced rocket
  }

  // Continue emoji
  const continueEmoji = shouldContinue ? '▶️ ' : '⏹️ ';

  // Correction emoji
  const correctionEmoji = needsCorrection ? '⚠️ ' : '✅';

  // Model short name
  const modelName = this.getModelShortName(workerModel);

  console.log(chalk.dim(`[Status] ${modelEmoji} ${modelName} | ${continueEmoji} ${shouldContinue ? 'Continue' : 'Stop'} | ${correctionEmoji} ${needsCorrection ? 'Needs correction' : 'OK'}`));
}
```

### Orchestrator Integration (src/orchestrator.ts)

在两个位置调用：

1. **主流程 Instructor 响应后** (line 193-198):
```typescript
Display.newline();

// Print debug status
Display.instructorStatus(
  instructorResponse.workerModel || this.config.workerModel,
  instructorResponse.shouldContinue,
  instructorResponse.needsCorrection || false
);
```

2. **纠正流程后** (line 258-263):
```typescript
Display.newline();

// Print debug status after correction
Display.instructorStatus(
  instructorResponse.workerModel || this.config.workerModel,
  instructorResponse.shouldContinue,
  instructorResponse.needsCorrection || false
);
```

## Benefits

### 1. 快速诊断

一眼看出当前状态：
- 使用什么模型？
- 会不会继续？
- 格式对不对？

### 2. 调试辅助

状态不符合预期时：
- ⏹️ Stop 但想继续？→ 检查是否缺少 "tell worker:"
- ⚠️ 需要纠正？→ Instructor 没有使用正确格式
- 🧠 Opus 但想要快速？→ Instructor 选择了复杂模型

### 3. 流程可见性

清晰展示对话流程：
```
Round 1:
  [Status] 🚀 Sonnet | ▶️  Continue | ✅ OK     ← 继续
  Worker 响应...

Round 2:
  [Status] 🚀 Sonnet | ⏹️  Stop | ⚠️  Needs correction  ← 需要纠正
  系统提示...
  [Status] 🚀 Sonnet | ▶️  Continue | ✅ OK     ← 纠正后继续
  Worker 响应...

Round 3:
  [Status] 🚀 Sonnet | ⏹️  Stop | ✅ OK         ← 任务完成
```

### 4. 模型选择透明

立即看到 Instructor 选择的模型：
- 看到 🧠 Opus → 知道任务复杂，可能需要更长时间
- 看到 🚀 Sonnet → 平衡的选择
- 看到 ⚡ Haiku → 知道任务简单，会很快完成

## Visual Design

使用 `chalk.dim()` 使状态行：
- 不干扰主要输出
- 保持可读性
- 便于快速扫描

状态行始终在 Instructor 响应后，便于上下文关联。

## Testing

运行测试查看所有场景：

```bash
node tests/test-instructor-status.js
```

## Related Files

- `src/display.ts` - Status display method
- `src/orchestrator.ts` - Integration points
- `tests/test-instructor-status.js` - Test scenarios
- `docs/INSTRUCTOR_STATUS.md` - This document

## Status

✅ **IMPLEMENTED** - 状态显示已集成到 orchestrator，每轮 Instructor 响应后自动显示。
