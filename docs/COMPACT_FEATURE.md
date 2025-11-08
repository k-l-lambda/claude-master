# Conversation Compaction Feature

## Overview

The compaction feature manages both Instructor and Worker conversation histories to prevent token limit overflow and enable long-running sessions.

## Key Design

### Worker Context Management
- **Worker messages are NOT persisted** to session files
- Worker always starts with a clean slate when resuming sessions
- During a session, Instructor can manage Worker's context with tools:
  - `get_worker_context_size`: Monitor Worker's token usage
  - `compact_worker_context`: Trim to recent N rounds (default: 10)
- This design keeps Worker focused on current tasks without historical baggage

### Instructor Context Management
- **Instructor messages ARE persisted** and can be compacted
- When conversation approaches token limits, history is summarized
- Summary preserves critical context while reducing token usage
- Boundary markers indicate where compaction occurred

## Usage

### Instructor Context Compaction

#### Manual Compaction
User can trigger compaction at any time:
```bash
# During session, type:
[compact]
```

This will:
1. Generate a detailed summary of conversation history
2. Replace history with compact summary
3. Save updated session
4. Display token savings

#### Automatic Compaction
System automatically compacts when approaching limits:
- Triggers at **160,000 tokens** (80% of 200k limit)
- Runs before processing each user instruction
- Shows warning and compaction progress
- Continues seamlessly after compaction

### Worker Context Management

Instructor can manage Worker's context during a session using tools:

#### Check Worker Context Size
```typescript
// Instructor uses tool
get_worker_context_size

// Returns:
Worker Context Size:
- Rounds: ~25 (50 messages)
- Token usage: 45,000 / 200,000 tokens (22%)

💡 Recommendation:
- Consider compacting if > 100k tokens (50% of limit)
- Must compact if approaching 160k tokens (80% of limit)
- Use compact_worker_context to trim to recent rounds
```

#### Compact Worker Context
```typescript
// Keep last 10 rounds (default)
compact_worker_context

// Or specify number of rounds to keep
compact_worker_context with keep_rounds=5

// Returns:
✓ Worker context has been compacted successfully.
Reason: Reduce context size
Kept: Last 10 rounds (20 messages)
Removed: 30 messages

Token Usage:
- Before: 45,000 tokens
- After: 18,000 tokens
- Saved: 27,000 tokens (60%)

💡 Worker still remembers the last 10 rounds of conversation.
```

**When to use**:
- Worker's context > 100k tokens (50% of limit)
- Starting a new sub-task within the same session
- Worker seems confused by old context
- Long-running sessions with many Worker interactions

### Session Resume
When resuming a session with `--continue` or `--resume`:
```bash
claude-master --continue "new instruction"
```

The system will:
1. Display a reminder that Worker context was NOT persisted
2. Restore Instructor's conversation history
3. Prompt Instructor to re-explain context to Worker

Example output:
```
⚠ 📋 Session Restored
  Worker context was NOT persisted - you need to re-explain the task to Worker
  Instructor context has been restored from session file
```

## Technical Details

### Token Counting
- Uses simple heuristic: ~4 characters per token
- Estimates tokens in messages, thinking blocks, and tool calls
- Tracks total conversation token usage

### Compaction Process
1. **Collect** all Instructor messages
2. **Send** to Claude with summarization prompt
3. **Generate** detailed summary including:
   - User requests and intents
   - Technical concepts and decisions
   - File names and code snippets
   - Errors and fixes
   - Current work and next steps
4. **Replace** conversation history with summary message
5. **Save** session with updated history

### Boundary Markers
System messages mark compaction points:
```typescript
{
  type: 'system',
  subtype: 'compact_boundary',
  content: 'Conversation compacted',
  timestamp: '2025-11-08T15:30:00.000Z',
  metadata: {
    trigger: 'manual' | 'auto',
    preTokens: 180000,
    postTokens: 8000
  }
}
```

### Session File Format
Session files (`.jsonl`) contain only Instructor messages:
```jsonl
{"type":"instructor-message","timestamp":"...","message":{...}}
{"type":"instructor-message","timestamp":"...","message":{...}}
{"type":"session-metadata","timestamp":"...","sessionId":"...","currentRound":10,...}
```

No Worker messages are included, keeping files smaller and focused.

## Benefits

### Token Efficiency
- Reduces 90%+ of historical token consumption
- Enables indefinitely long sessions
- Prevents hitting 200k token limit

### Context Quality
- Instructor maintains full awareness of project history
- Worker receives fresh, focused instructions
- No confusion from irrelevant historical context

### Session Size
- Session files remain manageable size
- Only essential Instructor context persisted
- Worker ephemeral context not stored

## Example Workflow

```bash
# Start new session
claude-master "Build a todo app"
# ... 50 rounds of conversation ...
# (Instructor memory: ~120k tokens)

# System auto-compacts at 160k tokens
# ⚠️  Conversation approaching token limit
# Current usage: 162,000 / 200,000 tokens (81%)
# Performing automatic compaction...
# ✓ Conversation compacted automatically
# Reduced from 162,000 to 9,500 tokens
# Saved 152,500 tokens (~94%)

# Continue working
# ... 100 more rounds ...

# Exit and resume later
^D

# Resume session
claude-master --continue "Add user authentication"
# ⚠ 📋 Session Restored
# Worker context was NOT persisted - you need to re-explain the task to Worker
# Instructor context has been restored from session file

# Instructor re-explains context to Worker
# ... work continues ...
```

## Configuration

No configuration needed - works automatically with sensible defaults:
- **Auto-compact threshold**: 160k tokens (80% of limit)
- **Summary max tokens**: 8,000 tokens
- **Compaction model**: Same as Instructor model

## System Prompt Updates

Instructor's system prompt now includes:
```
## Context Management

**Worker Context**: Worker's conversation history is NOT persisted between sessions. When resuming a session:
- You need to re-explain the task context to Worker
- Worker starts with a clean slate each time
- You are responsible for providing Worker with necessary background

**Your Context**: Your conversation history may be compacted when approaching token limits (160k+ tokens):
- User can trigger compaction with "[compact]" command
- System will auto-compact near 160k tokens
- After compaction, your history is replaced with a detailed summary
- You can manage Worker's context by starting fresh conversations when needed

**Note**: If Worker's context grows too large or becomes cluttered, you can choose to provide fresh instructions instead of continuing a long conversation thread.
```

## Comparison with Official Claude Code CLI

Our implementation follows the same pattern as the official `claude-code-cli`:
- Summarization-based compaction
- Detailed summary prompt preserving technical context
- Boundary markers for compaction points
- Token counting and automatic triggers

Differences:
- We only compact Instructor (not Worker)
- Worker context is never persisted
- Simpler token estimation (no tiktoken dependency)

## Future Enhancements

Possible improvements:
- Custom compaction prompts per project
- Configurable token thresholds
- Incremental summaries (partial compaction)
- Export conversation history before compaction
- Restore from pre-compaction state
