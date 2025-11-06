# Instructor-Worker Communication Protocol

## Overview

The Instructor can communicate with the Worker using various formats for sending instructions and specifying which model the Worker should use.

## Supported Formats

### 1. Simple Format
```
Tell worker: [instruction here]
```

The Worker will use the default model specified in configuration.

**Example:**
```
Tell worker: Please create a new TypeScript file with a simple function.
```

---

### 2. Model in Parentheses (Recommended)
```
Tell worker (use [model]): [instruction here]
Tell worker (model: [model]): [instruction here]
```

The model is specified in parentheses right after "Tell worker". Supported models:
- `sonnet` - claude-sonnet-4-5-20250929 (default, balanced)
- `opus` - claude-opus-4-1-20250805 (most capable, slower)
- `haiku` - claude-3-5-haiku-20241022 (fastest, lighter tasks)

**Examples:**
```
Tell worker (use sonnet): Implement the database schema with proper types.
Tell worker (use haiku): Run npm test and show me the output.
Tell worker (model: opus): Design and implement a complex algorithm for...
```

---

### 3. Model Inline
```
Tell worker: [instruction]. Use [model] for this task.
```

The model is specified within the instruction text.

**Examples:**
```
Tell worker: Create a comprehensive API client library. Use sonnet for this task.
Tell worker: Run a quick test. Use haiku.
```

---

### 4. Implicit Format (No "Tell worker")
```
[instruction text with optional model mention]
```

If you don't use "Tell worker:", the entire response is sent to the Worker.

**Examples:**
```
Please implement the user authentication module. Use opus for this complex task.
```

---

## Model Selection Guidelines

### When to use Sonnet (Default)
- Most general tasks
- Good balance of capability and speed
- Code implementation
- Architecture design
- Testing

### When to use Opus
- Very complex architectural decisions
- Advanced algorithms
- Critical security implementations
- Complex refactoring
- Deep code analysis

### When to use Haiku
- Quick commands (npm install, run tests)
- Simple file operations
- Documentation updates
- Code formatting
- Trivial tasks

---

## Completion Signal

When the task is complete, respond with:
```
**DONE**
```

Or any of these variants:
- `DONE`
- `_DONE_`
- `__DONE__`

The system will detect DONE in the last 3 lines of your response (case-insensitive).

---

## Examples in Practice

### Example 1: Multi-step Project
```
I'll guide the Worker through building a todo app step by step.

Tell worker (use sonnet): Initialize a new TypeScript project with the following setup:
1. Run npm init -y
2. Install TypeScript and Jest
3. Create tsconfig.json
4. Set up the basic folder structure
```

### Example 2: Quick Task
```
Tell worker (use haiku): Run the tests and show me if they all pass.
```

### Example 3: Complex Design
```
Tell worker (model: opus): Design and implement a robust retry mechanism with exponential backoff for the HTTP client library. Include:
- Configurable max retries
- Backoff strategy (exponential with jitter)
- Retry conditions (network errors, 5xx responses)
- Request timeout handling
- Comprehensive tests
```

### Example 4: Task Completion
```
Great work! All features are implemented and tests are passing.

**DONE**
```

---

## Implementation Notes

The parsing logic in `src/instructor.ts`:

1. **Priority Order:**
   - First tries to match `Tell worker (model): instruction` format
   - Then tries simple `Tell worker: instruction` format
   - Falls back to sending entire response

2. **Model Detection:**
   - Extracts model from parentheses if present
   - Otherwise searches for "use [model]" or "model: [model]" in text
   - Defaults to config.workerModel if no model specified

3. **Case Insensitive:**
   - All matching is case-insensitive
   - "tell worker", "Tell Worker", "TELL WORKER" all work

4. **Flexible Spacing:**
   - Extra spaces are handled gracefully
   - `Tell worker:`, `Tell  worker  :`, `Tell worker :` all work
