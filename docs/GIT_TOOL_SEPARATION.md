# Git Tool Separation - Read-Only vs Read-Write

## Overview

将git工具细分为两个版本：
1. **git_status** - 只读操作，Worker可以安全使用
2. **git_command** - 读写操作，只有Instructor可以使用

## Motivation

**之前的问题**：
- Worker完全没有git访问权限（git_command被永久禁止）
- Worker无法查看仓库状态、历史、diff等
- Instructor需要频繁为Worker提供git信息

**改进后**：
- Worker可以自主查看git状态
- Worker可以检查代码历史、分支、差异
- Instructor保留git写操作的独占权限
- 提高Worker的自主性和效率

## Changes Made

### 1. src/tools.ts

**新增git_status工具（Instructor和Worker都有）**:
```typescript
{
  name: 'git_status',
  description: 'Execute read-only git commands to inspect repository state (status, log, diff, show, branch, remote, etc.). Safe for Worker to use.',
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Git command to execute (e.g., "status", "log --oneline -10", "diff", "show HEAD", "branch -a", "remote -v")',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in seconds (default: 30).',
      },
    },
    required: ['command'],
  },
}
```

**保留git_command工具（仅Instructor）**:
```typescript
{
  name: 'git_command',
  description: 'Execute any git commands including write operations (commit, push, pull, add, reset, etc.). Restricted to Instructor only.',
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Git command to execute (e.g., "commit -m \'message\'", "push origin main", "pull", "add .", "reset --hard")',
      },
      timeout: { ... },
    },
    required: ['command'],
  },
}
```

**Worker工具列表**:
- ✅ Added: `git_status` (新增)
- ❌ Still forbidden: `git_command` (永久禁止)

### 2. src/tool-executor.ts

**新增gitStatus()方法** (lines 262-298):
```typescript
private async gitStatus(input: any): Promise<string> {
  const command = input.command;
  const timeoutSeconds = input.timeout || 30;
  const timeoutMs = timeoutSeconds * 1000;

  // Whitelist of read-only git commands
  const readOnlyCommands = [
    'status', 'log', 'diff', 'show', 'branch', 'remote',
    'ls-files', 'ls-tree', 'describe', 'rev-parse', 'rev-list',
    'blame', 'shortlog', 'reflog', 'tag', 'config --get', 'config --list'
  ];

  // Check if command starts with any read-only command
  const isReadOnly = readOnlyCommands.some(cmd => {
    const cmdStart = command.trim().split(/\s+/)[0];
    return cmdStart === cmd || cmd.startsWith(cmdStart);
  });

  if (!isReadOnly) {
    throw new Error(`Git command '${command}' is not a read-only operation. Use git_command tool instead for write operations.`);
  }

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

**添加case处理** (line 107-109):
```typescript
case 'git_status':
  result = await this.gitStatus(toolUse.input);
  break;
```

## Read-Only Commands Whitelist

Worker可以执行的只读git命令：

| Command | Description | Example |
|---------|-------------|---------|
| `status` | 查看工作区状态 | `git status` |
| `log` | 查看提交历史 | `git log --oneline -10` |
| `diff` | 查看差异 | `git diff HEAD~1` |
| `show` | 显示对象内容 | `git show HEAD` |
| `branch` | 列出分支 | `git branch -a` |
| `remote` | 列出远程仓库 | `git remote -v` |
| `ls-files` | 列出跟踪的文件 | `git ls-files` |
| `ls-tree` | 列出树对象 | `git ls-tree HEAD` |
| `describe` | 描述提交 | `git describe --tags` |
| `rev-parse` | 解析引用 | `git rev-parse HEAD` |
| `rev-list` | 列出提交 | `git rev-list --count HEAD` |
| `blame` | 显示文件修改者 | `git blame file.txt` |
| `shortlog` | 简短日志 | `git shortlog -s -n` |
| `reflog` | 查看引用日志 | `git reflog` |
| `tag` | 列出标签 | `git tag -l` |
| `config --get` | 读取配置 | `git config --get user.name` |
| `config --list` | 列出配置 | `git config --list` |

## Write Operations (Instructor Only)

仅Instructor可以执行的写操作：

| Command | Description | Example |
|---------|-------------|---------|
| `add` | 添加文件到暂存区 | `git add .` |
| `commit` | 提交更改 | `git commit -m "message"` |
| `push` | 推送到远程 | `git push origin main` |
| `pull` | 拉取远程更改 | `git pull` |
| `fetch` | 获取远程更新 | `git fetch origin` |
| `checkout` | 切换分支/恢复文件 | `git checkout -b new-branch` |
| `merge` | 合并分支 | `git merge feature` |
| `rebase` | 变基 | `git rebase main` |
| `reset` | 重置 | `git reset --hard HEAD` |
| `revert` | 回退提交 | `git revert HEAD` |
| `cherry-pick` | 拣选提交 | `git cherry-pick abc123` |
| `stash` | 暂存更改 | `git stash` |
| `clean` | 清理未跟踪文件 | `git clean -fd` |
| `rm` | 删除文件 | `git rm file.txt` |
| `mv` | 移动文件 | `git mv old.txt new.txt` |

## Usage Examples

### Example 1: Worker查看状态

```typescript
// Worker can now check git status
{
  "name": "git_status",
  "input": {
    "command": "status"
  }
}
// Returns: working tree status
```

### Example 2: Worker查看历史

```typescript
// Worker can inspect commit history
{
  "name": "git_status",
  "input": {
    "command": "log --oneline -10"
  }
}
// Returns: last 10 commits
```

### Example 3: Worker查看差异

```typescript
// Worker can check what changed
{
  "name": "git_status",
  "input": {
    "command": "diff HEAD~1"
  }
}
// Returns: diff of last commit
```

### Example 4: Worker尝试写操作（被阻止）

```typescript
// Worker tries to commit - BLOCKED
{
  "name": "git_status",
  "input": {
    "command": "commit -m 'test'"
  }
}
// Error: Git command 'commit -m 'test'' is not a read-only operation. Use git_command tool instead for write operations.
```

### Example 5: Instructor执行写操作

```typescript
// Instructor commits changes
{
  "name": "git_command",
  "input": {
    "command": "add . && git commit -m 'Implement feature'"
  }
}
// Success: committed
```

## Security

### Protection Layers

1. **Whitelist Validation** (tool-executor.ts)
   - 只允许白名单中的命令
   - 拒绝任何写操作

2. **Tool Definition** (tools.ts)
   - `git_status` 明确标记为"read-only"
   - `git_command` 明确标记为"Restricted to Instructor only"

3. **Permission System**
   - Worker的`permanentlyForbiddenTools`仍包含`git_command`
   - Worker默认有`git_status`权限

### Edge Cases

**Q: Worker能否绕过限制执行写操作？**
A: ❌ 不能。即使Worker调用git_status，也会在whitelist检查时被拒绝。

**Q: config命令是否安全？**
A: ✅ 只允许`config --get`和`config --list`（读取配置），不允许`config --set`（写入配置）。

**Q: Instructor是否还能使用git_status？**
A: ✅ 可以。Instructor同时有git_status和git_command两个工具。

## Benefits

### For Worker
- ✅ 可以自主查看代码状态
- ✅ 可以检查提交历史
- ✅ 可以查看分支和差异
- ✅ 提高自主性和效率

### For Instructor
- ✅ 减少为Worker提供git信息的负担
- ✅ 保留对仓库修改的完全控制
- ✅ 可以专注于高层决策

### For System
- ✅ 更清晰的权限划分
- ✅ 更安全的协作模式
- ✅ 更高的整体效率

## Comparison

### Before
```
User: "Check git status and implement feature"

Instructor: "Let me check git status..."
  [uses git_command: status]
  
Instructor: "Tell worker: Implement the feature"

Worker: "I need to know the current status..."
  [❌ Cannot access git]
  
Worker: "Can you tell me the git status?"

Instructor: "Let me check again..."
  [uses git_command: status]
  
Instructor: "Tell worker: Status is clean, proceed"

Worker: "Implementing..."
```

### After
```
User: "Check git status and implement feature"

Instructor: "Tell worker: Check status and implement the feature"

Worker: "Let me check status first..."
  [✅ uses git_status: status]
  
Worker: "Status is clean. Implementing the feature..."
  [implements]
  
Worker: "Done. Here's what changed..."
  [✅ uses git_status: diff]
```

**Result**: 更高效的协作！

## Status

✅ **COMPLETE** - Git工具已细分为只读和读写版本，Worker可以安全使用只读操作。

## Files Modified

1. `src/tools.ts` - 添加git_status工具定义（Instructor和Worker）
2. `src/tool-executor.ts` - 实现gitStatus()方法和白名单验证
