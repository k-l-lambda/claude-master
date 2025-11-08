# ESC Key Second Press Fix

## Problem

ESC键打断功能在第二次使用时失效。

**症状**：
1. 第一次按ESC → 成功中断，显示"⏸️ Execution interrupted"
2. 继续执行新任务
3. 第二次按ESC → 没有反应，无法中断

## Root Cause

### 问题代码（orchestrator.ts）

**setupKeyHandler()** (line 38):
```typescript
process.stdin.on('data', (data) => {
  if (data[0] === 0x1B && !this.paused) {  // ← 检查 !this.paused
    this.interrupted = true;
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.handleInterrupt();
  }
});
```

**handleInterrupt()** (line 52-60):
```typescript
private async handleInterrupt(): Promise<void> {
  this.paused = true;  // ← 设置为 true
  await new Promise(resolve => setTimeout(resolve, 100));
  Display.newline();
  Display.system('⏸️  Execution interrupted by user (ESC pressed)');
  Display.system('   Returning to instruction input...');
  Display.newline();
  this.interrupted = false;  // ← 只重置了 interrupted
}
```

**问题**：
- `handleInterrupt()`设置`this.paused = true`
- 但是**从未重置**回`false`
- 第二次按ESC时，条件`!this.paused`为false，不会触发中断

### 执行流程分析

```
第一次中断：
1. User按ESC
2. setupKeyHandler检查: data[0] === 0x1B && !this.paused ✅ (paused=false)
3. handleInterrupt() → this.paused = true
4. 回到用户输入...
5. paused仍然是true ❌

第二次尝试中断：
1. User按ESC
2. setupKeyHandler检查: data[0] === 0x1B && !this.paused ❌ (paused=true)
3. 条件不满足，不触发中断
4. ESC键失效！
```

## Solution

在`waitForUserInput()`开始时重置`this.paused`标志：

### src/orchestrator.ts (line 70-71)

```typescript
private async waitForUserInput(): Promise<string | null> {
  Display.newline();
  Display.system('💬 Instructor is waiting for your next instruction...');
  Display.system('   Type your instruction, or type "exit" to quit.');
  Display.newline();

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Reset paused flag before accepting input (allow ESC to work again)
  this.paused = false;  // ← 添加此行

  if (process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(false);
    } catch (error) {
      // Ignore
    }
  }
  
  // ... rest of the code
}
```

## Why This Fix Works

**重置时机**：
- 在等待用户新输入**之前**重置`paused`标志
- 确保用户开始新任务时，ESC键可以再次使用

**安全性**：
- 只在等待用户输入时重置（不在执行任务时）
- 不会影响当前正在进行的中断流程

## Verification

### Before Fix
```
Session 1:
User: "Task 1"
[Task running...]
User: Press ESC → ✅ Interrupts successfully
User: "Task 2"
[Task running...]
User: Press ESC → ❌ No response (ESC broken)
```

### After Fix
```
Session 1:
User: "Task 1"
[Task running...]
User: Press ESC → ✅ Interrupts successfully
User: "Task 2"
[Task running...]
User: Press ESC → ✅ Interrupts successfully (ESC works again!)
User: "Task 3"
[Task running...]
User: Press ESC → ✅ Still works!
```

## Related Code

### State Variables
- `this.paused` - 标记是否处于暂停状态，用于防止重复中断
- `this.interrupted` - 标记是否发生了中断事件
- `this.currentAbortController` - 用于取消当前的API调用

### State Transitions

**Correct Flow (After Fix)**:
```
Initial: paused=false, interrupted=false
  ↓
User presses ESC
  ↓
paused=true, interrupted=true, abort API call
  ↓
Display interrupt message
  ↓
interrupted=false
  ↓
Wait for user input → paused=false (Reset!)
  ↓
Ready for next ESC ✅
```

**Broken Flow (Before Fix)**:
```
Initial: paused=false, interrupted=false
  ↓
User presses ESC
  ↓
paused=true, interrupted=true, abort API call
  ↓
Display interrupt message
  ↓
interrupted=false
  ↓
Wait for user input → paused=true (Not reset!)
  ↓
Second ESC won't work ❌
```

## Additional Cleanup

Also removed the invalid check for `this.rl.closed` (line 84):
```typescript
// Before (Invalid - readline.Interface doesn't have 'closed' property)
if (this.rl.closed) {
  reject(new Error('Input stream closed'));
  return;
}

// After (Removed - rely on close event handler instead)
this.rl.question('Input your instruction:\n> ', (answer) => {
  resolve(answer);
});
```

The close event handler already catches this case, so the check was redundant and caused TypeScript errors.

## Status

✅ **FIXED** - ESC key now works consistently on every press, no matter how many times it's used.

## Files Modified

- `src/orchestrator.ts` (line 71) - Added `this.paused = false` reset
- `src/orchestrator.ts` (line 84-87) - Removed invalid `this.rl.closed` check
