import { Tool } from './types.js';

// Tools for Instructor (file reading, writing, and git)
export const instructorTools: Tool[] = [
  {
    name: 'read_file',
    description: 'Read contents of a file from the filesystem',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file to read',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file to write',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['file_path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Edit a file by replacing old string with new string',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file to edit',
        },
        old_string: {
          type: 'string',
          description: 'Text to replace',
        },
        new_string: {
          type: 'string',
          description: 'Text to replace with',
        },
        replace_all: {
          type: 'boolean',
          description: 'Replace all occurrences',
        },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'glob_files',
    description: 'Find files matching a glob pattern',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern like "**/*.ts"',
        },
        path: {
          type: 'string',
          description: 'Directory to search in',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'grep_search',
    description: 'Search for text patterns in files',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regular expression pattern to search for',
        },
        path: {
          type: 'string',
          description: 'File or directory to search in',
        },
        glob: {
          type: 'string',
          description: 'Glob pattern to filter files',
        },
      },
      required: ['pattern'],
    },
  },
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
  },
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
        timeout: {
          type: 'number',
          description: 'Timeout in seconds (default: 30). Use higher values for operations like large clones or fetches.',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'bash_command',
    description: 'Execute bash commands for file system exploration (ls, find, tree, etc.) and other safe operations',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Bash command to execute (e.g., "ls -la", "find . -name *.ts", "tree -L 2")',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in seconds (default: 30). Use higher values for long-running commands like builds or tests.',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'grant_worker_permission',
    description: 'Grant Worker permission to use a restricted tool. Use this when Worker needs access to tools like git_command that are normally restricted.',
    input_schema: {
      type: 'object',
      properties: {
        tool_name: {
          type: 'string',
          description: 'Name of the tool to grant permission for (e.g., "git_command")',
        },
        reason: {
          type: 'string',
          description: 'Reason for granting this permission (optional)',
        },
      },
      required: ['tool_name'],
    },
  },
  {
    name: 'revoke_worker_permission',
    description: 'Revoke Worker permission to use a tool. Use this to remove previously granted permissions.',
    input_schema: {
      type: 'object',
      properties: {
        tool_name: {
          type: 'string',
          description: 'Name of the tool to revoke permission for',
        },
      },
      required: ['tool_name'],
    },
  },
  {
    name: 'call_worker',
    description: 'Reset Worker\'s context and execute a task with fresh system prompt and instruction. Use this to start new tasks or when Worker\'s context is cluttered.',
    input_schema: {
      type: 'object',
      properties: {
        system_prompt: {
          type: 'string',
          description: 'System prompt defining Worker\'s role and context (inline text).',
        },
        instruction: {
          type: 'string',
          description: 'The instruction/task for Worker to execute.',
        },
        model: {
          type: 'string',
          enum: ['opus', 'sonnet', 'haiku'],
          description: 'Which Claude model Worker should use (default: config default). opus=most capable, sonnet=balanced, haiku=fast.',
        },
      },
      required: ['system_prompt', 'instruction'],
    },
  },
  {
    name: 'call_worker_with_file',
    description: 'Reset Worker\'s context and execute a task with system prompt loaded from a file. Use this when you have a complex system prompt saved in a file.',
    input_schema: {
      type: 'object',
      properties: {
        system_prompt_file: {
          type: 'string',
          description: 'Path to file containing the system prompt for Worker.',
        },
        instruction: {
          type: 'string',
          description: 'The instruction/task for Worker to execute.',
        },
        model: {
          type: 'string',
          enum: ['opus', 'sonnet', 'haiku'],
          description: 'Which Claude model Worker should use (default: config default). opus=most capable, sonnet=balanced, haiku=fast.',
        },
      },
      required: ['system_prompt_file', 'instruction'],
    },
  },
  {
    name: 'tell_worker',
    description: 'Send a message to Worker continuing the existing conversation. Worker maintains its context from previous rounds. Use this for iterative work building on previous interactions.',
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message to send to Worker (continues existing conversation).',
        },
        model: {
          type: 'string',
          enum: ['opus', 'sonnet', 'haiku'],
          description: 'Which Claude model Worker should use (default: config default). opus=most capable, sonnet=balanced, haiku=fast.',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'set_worker_timeout',
    description: 'Set Worker\'s inactivity timeout in seconds. Worker will abort if it doesn\'t output any token for this duration. Default: 60 seconds. Use longer timeout (120-300s) for complex tasks that need more thinking time.',
    input_schema: {
      type: 'object',
      properties: {
        timeout_seconds: {
          type: 'number',
          description: 'Timeout in seconds (e.g., 60, 120, 180, 300). Must be between 30 and 600.',
        },
        reason: {
          type: 'string',
          description: 'Reason for changing timeout (optional, for logging)',
        },
      },
      required: ['timeout_seconds'],
    },
  },
];

// Full tools for Worker (all except git and dangerous commands)
export const workerTools: Tool[] = [
  {
    name: 'read_file',
    description: 'Read contents of a file from the filesystem',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file to read',
        },
        offset: {
          type: 'number',
          description: 'Line number to start reading from',
        },
        limit: {
          type: 'number',
          description: 'Number of lines to read',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file to write',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['file_path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Edit a file by replacing old string with new string',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file to edit',
        },
        old_string: {
          type: 'string',
          description: 'Text to replace',
        },
        new_string: {
          type: 'string',
          description: 'Text to replace with',
        },
        replace_all: {
          type: 'boolean',
          description: 'Replace all occurrences',
        },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'glob_files',
    description: 'Find files matching a glob pattern',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern like "**/*.ts"',
        },
        path: {
          type: 'string',
          description: 'Directory to search in',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'grep_search',
    description: 'Search for text patterns in files',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regular expression pattern to search for',
        },
        path: {
          type: 'string',
          description: 'File or directory to search in',
        },
        glob: {
          type: 'string',
          description: 'Glob pattern to filter files',
        },
        output_mode: {
          type: 'string',
          description: 'Output mode: content, files_with_matches, or count',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'git_status',
    description: 'Execute read-only git commands to inspect repository state (status, log, diff, show, branch, remote, etc.)',
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
  },
  {
    name: 'bash_command',
    description: 'Execute safe bash commands (non-git, non-destructive)',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Bash command to execute',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in seconds (default: 30). Use higher values for long-running commands like builds or tests.',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'web_search',
    description: 'Search the web for information using a search engine',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query string',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
        },
      },
      required: ['query'],
    },
  },
];
