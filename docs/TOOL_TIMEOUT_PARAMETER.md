# Tool Timeout Parameter - Agent-Controlled Timeouts

## Overview

将`timeout`参数暴露给agent，让agent可以根据具体命令的预期执行时间灵活控制超时时长。

## Changes Made

### 1. src/tools.ts

**Instructor's bash_command** (lines 118-134):
```typescript
{
  name: 'bash_command',
  description: 'Execute bash commands for file system exploration...',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '...' },
      timeout: {
        type: 'number',
        description: 'Timeout in seconds (default: 30). Use higher values for long-running commands like builds or tests.',
      },
    },
    required: ['command'],
  },
}
```

**Instructor's git_command** (lines 104-120):
```typescript
{
  name: 'git_command',
  description: 'Execute git commands',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '...' },
      timeout: {
        type: 'number',
        description: 'Timeout in seconds (default: 30). Use higher values for operations like large clones or fetches.',
      },
    },
    required: ['command'],
  },
}
```

**Worker's bash_command** (lines 286-302):
```typescript
{
  name: 'bash_command',
  description: 'Execute safe bash commands (non-git, non-destructive)',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '...' },
      timeout: {
        type: 'number',
        description: 'Timeout in seconds (default: 30). Use higher values for long-running commands like builds or tests.',
      },
    },
    required: ['command'],
  },
}
```

### 2. src/tool-executor.ts

**gitCommand()** (lines 259-278):
```typescript
private async gitCommand(input: any): Promise<string> {
  const command = input.command;
  const timeoutSeconds = input.timeout || 30; // Default 30 seconds
  const timeoutMs = timeoutSeconds * 1000;

  try {
    const result = execSync(`git ${command}`, {
      cwd: this.workDir,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: timeoutMs,
    });
    return result || 'Command executed successfully';
  } catch (error: any) {
    if (error.killed && error.signal === 'SIGTERM') {
      throw new Error(`Git command timed out after ${timeoutSeconds} seconds: git ${command}`);
    }
    throw new Error(`Git command failed: ${error.message}`);
  }
}
```

**bashCommand()** (lines 280-307):
```typescript
private async bashCommand(input: any): Promise<string> {
  const command = input.command;
  const timeoutSeconds = input.timeout || 30; // Default 30 seconds
  const timeoutMs = timeoutSeconds * 1000;

  // Security: block dangerous commands
  const dangerousCommands = ['rm -rf', 'sudo', 'mkfs', 'dd', '> /dev'];
  for (const dangerous of dangerousCommands) {
    if (command.includes(dangerous)) {
      throw new Error(`Dangerous command blocked: ${command}`);
    }
  }

  try {
    const result = execSync(command, {
      cwd: this.workDir,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: timeoutMs,
    });
    return result || 'Command executed successfully';
  } catch (error: any) {
    if (error.killed && error.signal === 'SIGTERM') {
      throw new Error(`Bash command timed out after ${timeoutSeconds} seconds: ${command}`);
    }
    throw new Error(`Bash command failed: ${error.message}`);
  }
}
```

## Usage Examples

### Example 1: Quick Command (Use Default)

Agent调用不需要长时间等待的命令：

```typescript
{
  "name": "bash_command",
  "input": {
    "command": "ls -la"
  }
}
// Uses default 30 second timeout
```

### Example 2: Build Command (Custom Timeout)

Agent知道这是一个构建命令，可能需要更长时间：

```typescript
{
  "name": "bash_command",
  "input": {
    "command": "npm run build",
    "timeout": 120
  }
}
// Uses 120 second (2 minute) timeout
```

### Example 3: Test Suite (Extended Timeout)

运行完整测试套件：

```typescript
{
  "name": "bash_command",
  "input": {
    "command": "npm test",
    "timeout": 300
  }
}
// Uses 300 second (5 minute) timeout
```

### Example 4: Git Clone (Large Repository)

Clone大型仓库：

```typescript
{
  "name": "git_command",
  "input": {
    "command": "clone https://github.com/large/repo.git",
    "timeout": 600
  }
}
// Uses 600 second (10 minute) timeout
```

## Benefits

### 1. **灵活性**
- Agent可以根据命令类型选择合适的超时
- 快速命令使用默认30秒
- 长时间命令（构建、测试、clone）使用更长超时

### 2. **智能化**
- Agent能够判断：
  - `ls` → 使用默认
  - `npm run build` → 使用60-120秒
  - `npm test` → 使用180-300秒
  - `git clone large-repo` → 使用300-600秒

### 3. **安全性**
- 仍有超时保护（不会无限期等待）
- Agent可以为已知快速命令设置短超时
- 防止意外的长时间阻塞

### 4. **用户体验**
- 减少误报超时（之前固定30秒可能太短）
- 长命令不会被过早终止
- 错误消息显示实际使用的超时时间

## Agent's Perspective

Agent现在可以这样思考：

```
Instructor: "I need to run the test suite. This typically takes 2-3 minutes, 
so I'll set timeout to 300 seconds to be safe."

{
  "name": "bash_command",
  "input": {
    "command": "npm test",
    "timeout": 300
  }
}
```

```
Worker: "Just checking if Node.js is installed, should be instant."

{
  "name": "bash_command",
  "input": {
    "command": "node --version"
  }
}
// Uses default 30 seconds (more than enough)
```

## Default Behavior

**如果agent不指定timeout参数**：
- ✅ 自动使用30秒默认值
- ✅ 向后兼容（不会破坏现有调用）
- ✅ 对大多数命令来说足够

## Comparison

### Before (Fixed 30s)
```typescript
// All commands use 30 seconds
bash_command("ls")           // 30s - OK
bash_command("npm test")     // 30s - 可能太短！
bash_command("npm run build") // 30s - 可能太短！
git_command("clone large")   // 30s - 几乎肯定太短！
```

### After (Agent-Controlled)
```typescript
// Agent选择合适的超时
bash_command("ls")                      // 30s (default) - Perfect
bash_command("npm test", timeout=180)   // 180s - Just right
bash_command("npm run build", timeout=120) // 120s - Appropriate
git_command("clone large", timeout=600) // 600s - Safe
```

## Status

✅ **COMPLETE** - Timeout参数已暴露给agent，支持灵活的超时控制。

## Files Modified

1. `src/tools.ts` - 为bash_command和git_command添加timeout参数定义
2. `src/tool-executor.ts` - 使用input.timeout参数，默认30秒
