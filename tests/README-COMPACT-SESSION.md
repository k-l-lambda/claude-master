# Session Compaction Script

This script demonstrates the conversation compaction functionality by compressing an existing session file.

## Script: `compact-session.mjs`

Reads a session JSONL file, sends the instructor messages to Claude API for summarization, and saves the compacted result.

## Usage

```bash
node tests/compact-session.mjs [input-session.jsonl] [output-session.jsonl]
```

**Default paths:**
- Input: `tests/session1.jsonl`
- Output: `tests/session1-compacted.jsonl`

## Example

```bash
# Compact session1.jsonl
node tests/compact-session.mjs tests/session1.jsonl tests/session1-compacted.jsonl
```

## Requirements

- `ANTHROPIC_AUTH_TOKEN` environment variable must be set
- API access to Claude (will make actual API call)
- Takes ~10-20 seconds to complete

## Output

The script creates a compacted session file with:
1. **Compacted instructor message** - Single user message containing comprehensive summary
2. **Boundary marker** - System message marking compaction point with statistics
3. **Updated metadata** - Session metadata with compaction info

## Example Results

**Original session (session1.jsonl):**
- 309 messages
- 66,771 tokens (33% of 200k limit)

**Compacted session (session1-compacted.jsonl):**
- 1 message
- 2,235 tokens (1% of 200k limit)
- **Saved: 64,536 tokens (97% reduction)**

## Verification

Count tokens in the compacted session:

```bash
node /tmp/count-tokens.mjs tests/session1-compacted.jsonl
```

Expected output:
```
Session File Analysis
============================================================
File: tests/session1-compacted.jsonl
Total lines: 3
Instructor messages: 1
Estimated tokens: 2,235
Token usage: 2,235 / 200,000 (1%)
```

## What Gets Summarized

The compaction process creates a comprehensive summary with 9 sections:

1. **Primary Request and Intent** - Overall goals and context
2. **Key Technical Concepts** - Technologies and domain knowledge
3. **Files and Code Sections** - Important files with code snippets
4. **Errors and Fixes** - Problems encountered and solutions
5. **Problem Solving** - Challenges and decision-making
6. **All User Messages** - Complete list of user requests
7. **Pending Tasks** - Incomplete work and follow-ups
8. **Current Work** - Most recent actions and changes
9. **Optional Next Step** - Logical next action

## Notes

- The compacted session can be loaded with `--continue` to resume from the summary
- Worker context is always ephemeral and not included in compaction
- The summary preserves all critical context needed to continue the work
- Original session file is not modified - compacted version is saved separately
