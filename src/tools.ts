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
    name: 'compact_worker_context',
    description: 'Trim Worker\'s conversation history to keep only the most recent N rounds. Use this when Worker\'s context has grown too large (>100k tokens). This preserves recent context while reducing token usage. Default: keep last 10 rounds.',
    input_schema: {
      type: 'object',
      properties: {
        keep_rounds: {
          type: 'number',
          description: 'Number of recent rounds to keep (default: 10). Each round = 1 instruction + 1 response pair.',
        },
        reason: {
          type: 'string',
          description: 'Reason for compacting Worker context (optional, for logging)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_worker_context_size',
    description: 'Get the current size of Worker\'s conversation history in estimated tokens. Use this to monitor Worker\'s context usage and decide when to reset.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
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
