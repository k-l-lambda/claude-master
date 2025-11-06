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
    name: 'git_command',
    description: 'Execute git commands',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Git command to execute (e.g., "status", "log", "diff")',
        },
      },
      required: ['command'],
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
    name: 'bash_command',
    description: 'Execute safe bash commands (non-git, non-destructive)',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Bash command to execute',
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
