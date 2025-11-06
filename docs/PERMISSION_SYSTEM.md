# Permission System

## Overview
The system implements a dynamic permission-based tool access control where Worker has limited permissions by default, and Instructor can grant **some** additional permissions as needed. However, certain critical tools like `git_command` are **permanently forbidden** for Worker and cannot be granted under any circumstances.

## Tool Permissions

### Instructor Tools (Full Access)
The Instructor has access to all tools including sensitive operations:
- `read_file` - Read file contents
- `write_file` - Write/create files
- `edit_file` - Edit existing files
- `glob_files` - Find files by pattern
- `grep_search` - Search in files
- **`bash_command`** - Execute bash commands (ls, find, tree, etc.)
- **`git_command`** - Execute git operations (**PERMANENTLY FORBIDDEN for Worker**)
- **`grant_worker_permission`** - Grant Worker permission to use a restricted tool (except permanently forbidden ones)
- **`revoke_worker_permission`** - Revoke Worker's permission to use a tool

### Worker Tools (Limited Access by Default)
The Worker has access to most tools except git:
- `read_file` - Read file contents
- `write_file` - Write/create files
- `edit_file` - Edit existing files
- `glob_files` - Find files by pattern
- `grep_search` - Search in files
- `bash_command` - Execute safe bash commands (non-git, non-destructive)
- `web_search` - Search the web for information

### Permanently Forbidden Tools (Cannot Be Granted)
These tools are **permanently forbidden** for Worker and **cannot be granted** even by Instructor:
- **`git_command`** - Git operations are reserved exclusively for Instructor
  - Worker cannot perform git operations under any circumstances
  - If Worker needs git information, it must ask Instructor to perform the operation
  - Attempting to grant this permission will result in an error

### Dynamically Grantable Tools
Instructor can grant Worker access to other tools that are not in Worker's default set and not permanently forbidden. This provides flexibility for specific workflows while maintaining security for critical operations.

## Dynamic Permission Granting

### Feature: Instructor Can Grant Some Permissions

The Instructor can dynamically grant Worker access to **certain** restricted tools during a session. However, permanently forbidden tools like `git_command` cannot be granted.

### How to Grant Permission

**Instructor uses the `grant_worker_permission` tool:**

```typescript
{
  name: 'grant_worker_permission',
  input: {
    tool_name: 'some_tool',  // NOT git_command
    reason: 'Worker needs this for automated workflow'
  }
}
```

**Success Result:**
```
✓ Permission granted: Worker can now use "some_tool".
  Reason: Worker needs this for automated workflow
  Worker's current permissions: read_file, write_file, ..., some_tool
```

**If attempting to grant git_command:**
```
❌ Permission denied: Tool "git_command" is permanently forbidden
   for Worker due to security restrictions. This tool can only be
   used by the Instructor.

   Permanently forbidden tools: git_command
```

### How to Revoke Permission

**Instructor uses the `revoke_worker_permission` tool:**

```typescript
{
  name: 'revoke_worker_permission',
  input: {
    tool_name: 'git_command'
  }
}
```

**Result:**
```
✓ Permission revoked: Worker can no longer use "git_command".
  Worker's current permissions: read_file, write_file, edit_file,
  glob_files, grep_search, bash_command, web_search
```

## Permission Handling

### When Worker Needs Unauthorized Tool

When Worker attempts to use a tool it doesn't have permission for (e.g., `git_command`), the system will:

1. **Intercept the tool call** before execution
2. **Return a permission denied error** with a clear message
3. **Inform Worker** that only Instructor has this permission
4. **Suggest** that Worker asks Instructor to perform the operation

### Example Flow with Permanent Prohibition

**Scenario 1: Worker requests git access, Instructor attempts to grant (BLOCKED)**

```
Worker: [Attempts to use git_command tool]

Tool Result (Error):
  'Permission denied: Tool "git_command" is not available.
   This tool requires elevated permissions that only the
   Instructor has. Please ask the Instructor to perform
   this operation.'

Worker → Instructor:
  "I need to check git status to see what files have changed,
   but I don't have permission to use git commands.
   Could you either check the git status for me, or grant me
   permission to use git commands?"

Instructor: [Thinks about the request]
  "I'll try to grant Worker git permission for this workflow."

Instructor: [Attempts to use grant_worker_permission tool]
  tool_name: "git_command"
  reason: "Worker needs git access"

System (Error):
  ❌ Permission denied: Tool "git_command" is permanently forbidden
     for Worker due to security restrictions. This tool can only be
     used by the Instructor.

     Permanently forbidden tools: git_command

Instructor: [Receives error, understands git is permanently forbidden]
  "I cannot grant you git permissions as they are permanently restricted
   for security reasons. Let me check the git status for you."

Instructor: [Uses git_command tool directly]
  command: "status"

Instructor:
  "Tell worker: The git status shows these files have changed: ..."

Worker: "Thank you! I'll proceed with that information."
```

**Scenario 2: Worker needs git info, Instructor provides it directly (CORRECT FLOW)**

```
Worker: "I need to check git status to see what files changed."

Instructor: [Uses git_command directly instead of granting permission]
  [Uses git_command tool to check status]
  "Tell worker: The following files have changed: src/foo.ts, src/bar.ts"

Worker: "Thanks! I'll update those files accordingly."
```

## Implementation Details

### ToolExecutor API

```typescript
class ToolExecutor {
  constructor(
    workDir: string,
    allowedTools: string[],
    permanentlyForbiddenTools: string[] = []
  )

  // Grant permission to use a tool
  // Throws error if tool is permanently forbidden
  grantPermission(toolName: string): void

  // Revoke permission to use a tool
  revokePermission(toolName: string): void

  // Check if a tool is allowed
  hasPermission(toolName: string): boolean

  // Check if a tool is permanently forbidden
  isPermanentlyForbidden(toolName: string): boolean

  // Get list of all allowed tools
  getAllowedTools(): string[]

  // Get list of permanently forbidden tools
  getPermanentlyForbiddenTools(): string[]

  // Execute a tool (checks permission first)
  async executeTool(toolUse: ToolUse): Promise<ToolResult>
}
```

### Worker Setup (with permanent prohibition)

```typescript
constructor(config: Config, workDir: string) {
  const allowedToolNames = workerTools.map(t => t.name);
  // Git commands are permanently forbidden for Worker
  const permanentlyForbiddenTools = ['git_command'];
  this.toolExecutor = new ToolExecutor(
    workDir,
    allowedToolNames,
    permanentlyForbiddenTools
  );
}
```

### Instructor Setup (no prohibition)

```typescript
constructor(config: Config, userInstruction: string, workDir: string) {
  const allowedToolNames = instructorTools.map(t => t.name);
  // Instructor has no permanently forbidden tools
  this.toolExecutor = new ToolExecutor(workDir, allowedToolNames, []);
}
```

### Permission Check in ToolExecutor
```typescript
async executeTool(toolUse: ToolUse): Promise<ToolResult> {
  // Check if tool is allowed
  if (!this.allowedTools.has(toolUse.name)) {
    return {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: `Permission denied: Tool "${toolUse.name}" is not available...`,
      is_error: true,
    };
  }

  // ... execute tool
}
```

### Permission Management in InstructorManager

```typescript
// Set reference to Worker's ToolExecutor
setWorkerToolExecutor(workerToolExecutor: ToolExecutor): void

// Handle grant/revoke permission tools
private async handlePermissionTool(toolUse: any): Promise<any> {
  const toolName = toolUse.input.tool_name;

  if (toolUse.name === 'grant_worker_permission') {
    // Check if tool is permanently forbidden for Worker
    if (this.workerToolExecutor.isPermanentlyForbidden(toolName)) {
      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: `❌ Permission denied: Tool "${toolName}" is permanently
                 forbidden for Worker due to security restrictions...`,
        is_error: true,
      };
    }

    this.workerToolExecutor.grantPermission(toolName);
    // Return success message with current permissions
  } else if (toolUse.name === 'revoke_worker_permission') {
    this.workerToolExecutor.revokePermission(toolName);
    // Return success message
  }
}
```

### Orchestrator Setup

```typescript
constructor(config: Config, workDir: string) {
  this.instructor = new InstructorManager(config, '', workDir);
  this.worker = new WorkerManager(config, workDir);

  // Link Worker's ToolExecutor to Instructor for permission management
  this.instructor.setWorkerToolExecutor(this.worker.getToolExecutor());
}
```

## Benefits

1. **Security**: Prevents Worker from executing privileged operations by default
2. **Hard Limits**: Git operations are **permanently protected** and cannot be bypassed
3. **Flexibility**: Instructor can grant permissions for other tools dynamically when needed
4. **Clear Communication**: Permission errors guide Worker to ask Instructor
5. **Granular Control**: Grant/revoke individual tool permissions (except permanently forbidden ones)
6. **Separation of Concerns**:
   - Worker: Implementation and coding
   - Instructor: Project management, git operations, and permission decisions
7. **Graceful Degradation**: System doesn't crash, just returns error message
8. **Auditable**: All permission changes and denials are logged in conversation
9. **Context-Aware**: Instructor can grant permissions based on current task needs
10. **Defense in Depth**: Multiple layers prevent unauthorized git access

## Adding New Tools

### To add a permanently forbidden tool (never available to Worker):

1. Add tool definition to `instructorTools` in `src/tools.ts`
2. Add tool implementation in `src/tool-executor.ts`
3. Do NOT add to `workerTools`
4. Add tool name to `permanentlyForbiddenTools` array in Worker constructor

Worker will be permanently blocked from using it, even if Instructor tries to grant it.

### To add a dynamically grantable tool:

1. Add tool definition to `instructorTools` in `src/tools.ts`
2. Add tool implementation in `src/tool-executor.ts`
3. Do NOT add to `workerTools` (restricted by default)
4. Do NOT add to `permanentlyForbiddenTools` (can be granted)

Instructor can grant this tool to Worker when needed using `grant_worker_permission`.

### To add a tool available to both by default:

1. Add tool definition to both `instructorTools` and `workerTools`
2. Add tool implementation in `src/tool-executor.ts`

Both Worker and Instructor can use it from the start.

## Error Handling

The permission system returns errors in the same format as other tool errors:

```typescript
{
  type: 'tool_result',
  tool_use_id: string,
  content: string,  // Error message
  is_error: true    // Indicates this is an error
}
```

This allows the AI to:
- Understand the error
- Explain to Instructor what permission is needed
- Request help from Instructor
- Continue with alternative approaches

## Best Practices

1. **Worker should gracefully handle permission errors** and report to Instructor
2. **Instructor should evaluate** whether Worker truly needs the permission
3. **Never attempt to grant git_command** - it's permanently forbidden for Worker
4. **Grant permissions temporarily** for other tools - revoke when task is complete
5. **Provide reason** when granting permissions for audit trail
6. **Git operations stay with Instructor** - this is a hard security boundary
7. **Worker can suggest** what it needs, but Instructor makes the decision
8. **Security-sensitive operations** should be added to permanently forbidden list
9. **Document why** permissions were granted in the conversation

## Use Cases

### Git Operations (Permanently Forbidden)

❌ **NEVER grant git_command:**
```
Instructor attempts: grant_worker_permission("git_command")
Result: ❌ Error - permanently forbidden
```

✅ **Instead, Instructor performs git operations:**
```
Worker: "I need to check git status"
Instructor: [Uses git_command directly]
            "Tell worker: Files changed: ..."
```

### Other Restricted Tools (Can Be Granted)

✅ **Grant permission when:**
- Worker needs to automate a repetitive task
- The task requires Worker to have full control over a workflow
- Trust has been established through conversation
- The operation is well-understood and low-risk
- **The tool is NOT permanently forbidden**

❌ **Don't grant permission when:**
- One-time operation (Instructor can do it directly)
- High-risk operation
- Worker doesn't understand what permission is needed
- The tool is permanently forbidden (like git_command)

### Example Scenarios

**Scenario A: Worker needs git info (Standard Pattern)**
```
Worker: "I need to check git status to see what files changed."

Instructor: [Uses git_command directly - cannot and should not grant]
  [Uses git_command tool: "status"]
  "Tell worker: These files have changed: src/foo.ts, src/bar.ts"

Worker: "Thanks! I'll update those files."
```

**Scenario B: Instructor incorrectly tries to grant git (Blocked)**
```
Worker: "Can I have git permission to automate commits?"

Instructor: [Attempts to grant]
  [Uses grant_worker_permission: tool_name="git_command"]

System: ❌ Permission denied - permanently forbidden

Instructor: "I cannot grant git permissions as they are permanently
            restricted. I'll handle git operations myself."
```

## Future Enhancements

Potential improvements:
1. ~~Dynamic permission granting during runtime~~ ✅ **IMPLEMENTED**
2. ~~Permanent prohibition for critical tools~~ ✅ **IMPLEMENTED**
3. Time-limited permissions (auto-revoke after duration)
4. Permission request/approval workflow with user confirmation
5. Audit log export of all permission changes
6. Configurable permission levels (read-only, read-write, admin)
7. User confirmation for certain Instructor operations
8. Permission presets for common scenarios
9. Additional permanently forbidden tools based on use cases

## Summary

The permission system provides a secure, flexible framework with **hard security boundaries**:

- **Worker operates with limited permissions by default**
- **Git operations are permanently forbidden for Worker** - cannot be bypassed
- **Instructor can grant some other permissions when needed**
- **Permissions can be revoked when no longer required**
- **All permission changes are logged and auditable**
- **Multiple layers of defense protect critical operations**
- **Clear error messages guide proper workflow**

This creates a balance between security and flexibility, with **absolute protection** for critical operations like git commands while allowing adaptation for other workflows.
