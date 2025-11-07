# DONE Detection - Markdown Code Fence Fix

## Issue

当 Instructor 输出包含 markdown 代码块，并且在代码块后面跟着 DONE 时，DONE 检测会失败。

### Example

```
Instructor 输出:
```bash
npm start                    # Random grid
node src/index.js --help     # Show options
```

DONE
```

**期望**: `isDone = true`, `needsCorrection = false`
**实际**: `isDone = false`, `needsCorrection = true`

**控制台显示**:
```
DONE
[Status] ⚡ Haiku | ⏹️  Stop | ⚠️  Needs correction
```

## Root Cause

Instructor 的输出实际是：
```
...
```

DONE
```
```

注意最后有 **三个反引号** `````（markdown 代码块结束标记）。

DONE 检测的正则表达式是：
```typescript
const isDone = /(?:^|\n)\s*DONE[\s.!]*$/.test(lastLine);
```

这个正则要求 DONE 必须在字符串最后（`$`），但实际上 DONE 后面还有 `\n````，导致匹配失败。

### Why This Happens

1. `lastLine` 包含最后 3 行:
   ```
   ```

   DONE
   ```
   ```

2. 正则 `DONE[\s.!]*$` 要求 DONE 后面只能有 `[\s.!]*`（空格、点、感叹号）

3. 但实际上 DONE 后面是 `\n```\n`，不匹配

4. 所以 `isDone = false`

5. 因为 `!isDone && instruction.length === 0 && text.length > 0`，所以 `needsCorrection = true`

## Solution

修改正则表达式，允许 DONE 后面跟着可选的 markdown 代码块结束标记：

```typescript
// OLD (Problematic)
const isDone = /\*\*DONE\*\*|__DONE__|_DONE__|(?:^|\n)\s*DONE[\s.!]*$/.test(lastLine);

// NEW (Fixed)
const isDone = /\*\*DONE\*\*|__DONE__|_DONE__|(?:^|\n)\s*DONE[\s.!]*(?:\n```)?[\s]*$/.test(lastLine);
```

### Explanation

`(?:\n```)?[\s]*$` 这部分：
- `(?:\n```)? ` - 可选的换行符加三个反引号（非捕获组）
- `[\s]*` - 可选的空白字符
- `$` - 字符串结尾

现在可以匹配：
- `DONE` ✅
- `DONE\n` ✅
- `DONE\n```\n` ✅（新增支持）
- `DONE  ` ✅
- `DONE.\n```  ` ✅

## Test Cases

添加了三个新的测试用例：

```javascript
// Markdown code blocks
testDoneDetection('```bash\necho "hello"\n```\n\nDONE', true, 'DONE after code block');
testDoneDetection('```bash\necho "hello"\n```\n\nDONE\n```', true, 'DONE followed by closing code fence');
testDoneDetection('Some code:\n```\ncode here\n```\nDONE', true, 'DONE after inline code block');
```

**测试结果**: ✅ All tests pass

## Real-World Example

### Before Fix

```
Instructor: Here's how to run it:
```bash
npm start
```

DONE
```

[Status] ⚡ Haiku | ⏹️  Stop | ⚠️  Needs correction  ❌

⚠️  Instructor did not use the correct communication format.
```

### After Fix

```
Instructor: Here's how to run it:
```bash
npm start
```

DONE
```

[Status] ⚡ Haiku | ⏹️  Stop | ✅ OK  ✅

✓ Instructor has completed the current task
```

## Impact

**Before**:
- Markdown 代码块后的 DONE 不被识别
- 误报 needsCorrection
- 用户看到错误的警告

**After**:
- Markdown 代码块后的 DONE 正确识别
- needsCorrection 正确为 false
- 流程正常结束

## Files Modified

- `src/instructor.ts:185` - Updated DONE detection regex
- `tests/test-done-detection.js:5` - Updated test regex
- `tests/test-done-detection.js:77-80` - Added markdown code block tests
- `docs/DONE_MARKDOWN_FIX.md` - This document

## Status

✅ **FIXED** - DONE detection now correctly handles markdown code blocks.
