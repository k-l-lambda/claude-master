# Bash Command Timeout Fix

## Problem

Worker的输出卡死在执行bash命令处：
```
1. First, I'll check if Node.js is installed:
2. Now I'll try a simple test run:
```

**根本原因**：`tool-executor.ts`的`bashCommand()`方法使用`execSync`但**没有设置timeout参数**，导致如果命令卡住（等待输入、死循环等），整个Worker进程都会被阻塞。

## Analysis

### 超时机制的层级

1. **Claude API层面** (5-10分钟)
   - 整个API请求的总超时
   - 但不能及时中断卡住的工具

2. **Orchestrator Worker超时** (60秒无chunk)
   - 检测streaming是否有新输出
   - **无法检测到工具执行卡住**（因为工具同步执行，不产生chunk）

3. **Tool执行层面** (之前缺失)
   - ❌ bash_command: 没有超时
   - ❌ git_command: 没有超时
   - ✅ web_search: curl有`-m 10`超时
   - ❌ read_file/write_file: 没有超时

### 为什么Worker会卡死？

```typescript
// Worker的agentic loop
while (iteration < maxIterations) {
  // 1. 调用API，得到response（包含tool_use）
  const response = await this.client.streamMessage(...);

  // 2. 执行工具
  for (const toolUse of toolUses) {
    const result = await this.toolExecutor.executeTool(toolUse); // ← 卡在这里
    toolResults.push(result);
  }

  // 3. 永远到不了这里...
}
```

**卡死点**：`executeTool()` → `bashCommand()` → `execSync(command)` → 命令卡住 → 整个线程阻塞

## Solution

在`tool-executor.ts`为bash和git命令添加30秒超时：

### src/tool-executor.ts

**bashCommand()** (lines 286-298):
```typescript
const result = execSync(command, {
  cwd: this.workDir,
  encoding: 'utf-8',
  maxBuffer: 10 * 1024 * 1024,
  timeout: 30000, // 30 seconds timeout ← 添加
});

// 捕获超时错误
catch (error: any) {
  if (error.killed && error.signal === 'SIGTERM') {
    throw new Error(`Bash command timed out after 30 seconds: ${command}`);
  }
  throw new Error(`Bash command failed: ${error.message}`);
}
```

**gitCommand()** (lines 263-276):
```typescript
const result = execSync(`git ${command}`, {
  cwd: this.workDir,
  encoding: 'utf-8',
  maxBuffer: 10 * 1024 * 1024,
  timeout: 30000, // 30 seconds timeout ← 添加
});

// 捕获超时错误
catch (error: any) {
  if (error.killed && error.signal === 'SIGTERM') {
    throw new Error(`Git command timed out after 30 seconds: git ${command}`);
  }
  throw new Error(`Git command failed: ${error.message}`);
}
```

## Behavior

### Before
```
Worker: "1. First, I'll check if Node.js is installed:"
[bash_command: node --version]
... (卡死，永不返回)
```

### After
```
Worker: "1. First, I'll check if Node.js is installed:"
[bash_command: node --version]
... (30秒后)
Error: Bash command timed out after 30 seconds: node --version
[tool_result 返回给Worker，包含错误信息]
Worker: "It seems the command timed out. Let me try another approach..."
```

## Why 30 Seconds?

**合理性分析**：
- ✅ 大多数命令在1秒内完成
- ✅ 编译/测试命令可能需要10-20秒
- ✅ 30秒足够覆盖正常场景
- ✅ 避免无限期等待
- ❌ 不要太短（如5秒），可能打断正常的长命令

**与Worker超时(60秒)的关系**：
- Worker超时：60秒无streaming chunk
- Bash超时：30秒内必须完成
- **协同工作**：如果bash命令30秒超时，会返回错误给Worker，Worker可以继续（产生新chunk）

## Testing

可以用这个命令测试超时：
```bash
# 创建一个会卡住30秒的命令
echo "sleep 100" | ./dist/index.js --debug "Run bash: sleep 100"

# 应该在30秒后看到超时错误
# Error: Bash command timed out after 30 seconds: sleep 100
```

## Future Improvements

可以考虑：
1. **可配置超时**：不同命令不同超时时间
2. **read_file超时**：大文件读取可能也很慢
3. **进度反馈**：长时间命令显示进度（需要改用spawn而非execSync）

## Status

✅ **FIXED** - Bash和Git命令现在有30秒超时保护，不会再无限期卡死Worker。
