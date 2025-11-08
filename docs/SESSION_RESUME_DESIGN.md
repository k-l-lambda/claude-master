# Session Resume Feature - Design Document

## Overview

允许用户在重新启动claude-master时恢复之前的session，继续上一次的对话。

## Use Cases

### 1. 意外中断恢复
```bash
# Session被意外中断（断网、崩溃等）
./dist/index.js "Long task"
[Working...]
^C  # Ctrl+C或意外中断

# 重启后恢复
./dist/index.js --resume
# 或
./dist/index.js --continue
```

### 2. 分段工作
```bash
# 完成第一阶段工作
./dist/index.js "Implement feature part 1" -r 10
[Completes 10 rounds]
Session ended

# 稍后继续
./dist/index.js --resume "Continue with part 2"
```

### 3. 多设备协作
```bash
# 在机器A上开始
./dist/index.js "Start project"
[Working...]
# Save session to shared location

# 在机器B上继续
./dist/index.js --resume --session-file /shared/session.json
```

## Design

### Session State Structure

```typescript
interface SessionState {
  // Metadata
  sessionId: string;
  createdAt: string;
  lastUpdatedAt: string;
  version: string;
  
  // Configuration
  config: {
    instructorModel: string;
    workerModel: string;
    maxRounds: number;
    useThinking: boolean;
    workDir: string;
  };
  
  // Execution State
  currentRound: number;
  remainingRounds: number;
  
  // Conversation History
  instructor: {
    conversationHistory: Message[];
    systemPrompt: string;
  };
  
  worker: {
    conversationHistory: Message[];
  };
  
  // Last State
  lastInstruction: string;
  lastInstructorResponse: {
    thinking: string;
    instruction: string;
    workerModel: string;
    shouldContinue: boolean;
    needsCorrection: boolean;
  } | null;
}
```

### File Storage

**Default Location**: `.claude-master/sessions/`

```
.claude-master/
├── sessions/
│   ├── session-2025-11-08-15-30-00.json    # Auto-saved sessions
│   ├── session-2025-11-08-16-45-00.json
│   └── current.json                         # Symlink to latest
└── config.json                              # Global config
```

### CLI Options

```bash
# Resume latest session
./dist/index.js --resume
./dist/index.js --continue

# Resume specific session
./dist/index.js --resume --session <session-id>
./dist/index.js --resume --session-file <path>

# List available sessions
./dist/index.js --list-sessions

# Clean old sessions
./dist/index.js --clean-sessions --older-than 7d
```

## Implementation Plan

### Phase 1: Basic Save/Load

**Files to Create**:
- `src/session-manager.ts` - Session persistence logic
- `src/types.ts` - Add SessionState interface

**Files to Modify**:
- `src/orchestrator.ts` - Save state periodically
- `src/index.ts` - Add --resume CLI option

### Phase 2: Auto-Save

**Features**:
- Auto-save every 5 rounds
- Save on graceful exit
- Save on Ctrl+C (signal handler)

### Phase 3: Session Management

**Features**:
- List sessions
- Delete old sessions
- Export/import sessions

## Key Implementation Details

### 1. SessionManager Class

```typescript
class SessionManager {
  private sessionDir: string;
  
  constructor(baseDir: string = '.claude-master/sessions') {
    this.sessionDir = baseDir;
  }
  
  async saveSession(state: SessionState): Promise<string> {
    const filename = `session-${state.sessionId}.json`;
    const filepath = path.join(this.sessionDir, filename);
    await fs.writeFile(filepath, JSON.stringify(state, null, 2));
    
    // Update current.json symlink
    const currentPath = path.join(this.sessionDir, 'current.json');
    await fs.symlink(filename, currentPath);
    
    return filepath;
  }
  
  async loadSession(sessionId?: string): Promise<SessionState | null> {
    if (!sessionId) {
      // Load from current.json
      const currentPath = path.join(this.sessionDir, 'current.json');
      const content = await fs.readFile(currentPath, 'utf-8');
      return JSON.parse(content);
    }
    
    const filepath = path.join(this.sessionDir, `session-${sessionId}.json`);
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content);
  }
  
  async listSessions(): Promise<SessionState[]> {
    const files = await fs.readdir(this.sessionDir);
    const sessions = [];
    
    for (const file of files) {
      if (file.startsWith('session-') && file.endsWith('.json')) {
        const content = await fs.readFile(
          path.join(this.sessionDir, file),
          'utf-8'
        );
        sessions.push(JSON.parse(content));
      }
    }
    
    return sessions.sort((a, b) => 
      new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()
    );
  }
}
```

### 2. Orchestrator Integration

```typescript
class Orchestrator {
  private sessionManager: SessionManager;
  
  async run(initialInstruction?: string, resumeSession?: boolean) {
    if (resumeSession) {
      await this.resumeFromSession();
    }
    
    // ... normal execution
    
    // Auto-save every 5 rounds
    if (this.currentRound % 5 === 0) {
      await this.saveSession();
    }
  }
  
  private async saveSession(): Promise<void> {
    const state: SessionState = {
      sessionId: this.sessionId,
      createdAt: this.createdAt,
      lastUpdatedAt: new Date().toISOString(),
      version: '1.0.0',
      config: { ...this.config },
      currentRound: this.currentRound,
      remainingRounds: this.remainingRounds,
      instructor: {
        conversationHistory: this.instructor.getConversationHistory(),
        systemPrompt: this.instructor.getSystemPrompt(),
      },
      worker: {
        conversationHistory: this.worker.getConversationHistory(),
      },
      lastInstruction: this.lastInstruction,
      lastInstructorResponse: this.lastInstructorResponse,
    };
    
    await this.sessionManager.saveSession(state);
    Display.system(`💾 Session saved (Round ${this.currentRound})`);
  }
  
  private async resumeFromSession(): Promise<void> {
    const state = await this.sessionManager.loadSession();
    
    if (!state) {
      Display.warning('No session to resume');
      return;
    }
    
    Display.info(`📂 Resuming session from ${state.lastUpdatedAt}`);
    Display.info(`   Round: ${state.currentRound}`);
    Display.info(`   Remaining: ${state.remainingRounds}`);
    
    this.sessionId = state.sessionId;
    this.currentRound = state.currentRound;
    this.remainingRounds = state.remainingRounds;
    
    // Restore conversation history
    this.instructor.restoreConversationHistory(state.instructor.conversationHistory);
    this.worker.restoreConversationHistory(state.worker.conversationHistory);
    
    this.lastInstructorResponse = state.lastInstructorResponse;
    
    Display.success('Session resumed successfully');
  }
}
```

### 3. CLI Integration

```typescript
// src/index.ts
program
  .option('--resume', 'Resume from last session')
  .option('--continue', 'Alias for --resume')
  .option('--session <id>', 'Resume specific session by ID')
  .option('--session-file <path>', 'Resume from specific session file')
  .option('--list-sessions', 'List available sessions')
  .option('--no-auto-save', 'Disable auto-save')
```

## Security & Privacy Considerations

### 1. Sensitive Data
- Conversation history可能包含敏感信息
- API keys不应该保存在session中
- 考虑加密存储

### 2. File Permissions
```typescript
// Create session file with restricted permissions
await fs.writeFile(filepath, content, { mode: 0o600 });  // Owner only
```

### 3. Auto-Cleanup
```typescript
// Delete sessions older than N days
async cleanOldSessions(days: number = 30) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  
  const sessions = await this.listSessions();
  for (const session of sessions) {
    if (new Date(session.lastUpdatedAt).getTime() < cutoff) {
      await this.deleteSession(session.sessionId);
    }
  }
}
```

## Benefits

### 1. Resilience
- 意外中断不会丢失进度
- 长时间任务可以分段完成

### 2. Flexibility
- 可以随时暂停和恢复
- 支持多设备协作

### 3. Debugging
- 可以复现问题场景
- 保存失败的session供分析

## Limitations

### 1. Tool State
- 文件系统状态不能回滚
- Git操作已执行无法撤销
- 需要用户手动处理外部状态

### 2. Model Changes
- 恢复时model版本可能不同
- API行为可能有变化

### 3. Memory Usage
- Large conversation history会占用内存
- 需要定期清理

## Future Enhancements

### 1. Cloud Storage
```bash
./dist/index.js --save-to-cloud
./dist/index.js --resume --from-cloud
```

### 2. Branching
```bash
# Fork session at specific round
./dist/index.js --resume --fork-at-round 15
```

### 3. Replay
```bash
# Replay session with different model
./dist/index.js --replay session-123 --with-model haiku
```

### 4. Diff & Merge
```bash
# Compare two sessions
./dist/index.js --diff session-1 session-2

# Merge sessions
./dist/index.js --merge session-1 session-2
```

## Priority

**High Priority**:
- ✅ Basic save/load functionality
- ✅ Auto-save on exit
- ✅ --resume flag

**Medium Priority**:
- Session listing
- Auto-cleanup
- Signal handler (Ctrl+C save)

**Low Priority**:
- Cloud storage
- Branching
- Replay

## Questions to Resolve

1. **When to auto-save?**
   - Every N rounds?
   - After each Instructor response?
   - Only on user request?

2. **How to handle model changes?**
   - Warn user if model differs?
   - Force same model?
   - Allow override?

3. **Should Worker state be saved?**
   - Yes - full conversation history
   - Partial - only essential state
   - No - rebuild from Instructor

4. **Session naming?**
   - Auto-generated IDs?
   - User-provided names?
   - Based on initial instruction?

## Next Steps

1. Implement SessionManager class
2. Add save/load methods to Orchestrator
3. Add --resume CLI option
4. Test with real scenarios
5. Document usage

## Status

📋 **DESIGN COMPLETE** - Ready for implementation discussion.
