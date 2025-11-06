import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';
import { execSync } from 'child_process';

export interface ToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

export interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export class ToolExecutor {
  private workDir: string;

  constructor(workDir: string) {
    this.workDir = workDir;
  }

  async executeTool(toolUse: ToolUse): Promise<ToolResult> {
    console.log(`[ToolExecutor] Executing tool: ${toolUse.name}`);
    console.log(`[ToolExecutor] Full toolUse object:`, JSON.stringify(toolUse, null, 2));
    console.log(`[ToolExecutor] Input:`, JSON.stringify(toolUse.input, null, 2));

    try {
      let result: string;

      switch (toolUse.name) {
        case 'read_file':
          result = await this.readFile(toolUse.input);
          break;
        case 'write_file':
          result = await this.writeFile(toolUse.input);
          break;
        case 'edit_file':
          result = await this.editFile(toolUse.input);
          break;
        case 'glob_files':
          result = await this.globFiles(toolUse.input);
          break;
        case 'grep_search':
          result = await this.grepSearch(toolUse.input);
          break;
        case 'git_command':
          result = await this.gitCommand(toolUse.input);
          break;
        case 'bash_command':
          result = await this.bashCommand(toolUse.input);
          break;
        default:
          throw new Error(`Unknown tool: ${toolUse.name}`);
      }

      console.log(`[ToolExecutor] Result: ${result.substring(0, 200)}...`);

      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      };
    } catch (error) {
      console.error(`[ToolExecutor] Error:`, error);
      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: error instanceof Error ? error.message : String(error),
        is_error: true,
      };
    }
  }

  private async readFile(input: any): Promise<string> {
    if (!input.file_path) {
      throw new Error('Missing required parameter: file_path');
    }

    const filePath = resolve(this.workDir, input.file_path);

    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Handle offset and limit if provided
    if (input.offset !== undefined || input.limit !== undefined) {
      const offset = input.offset || 0;
      const limit = input.limit || lines.length;
      const selectedLines = lines.slice(offset, offset + limit);

      // Add line numbers
      return selectedLines
        .map((line, idx) => `${offset + idx + 1}→${line}`)
        .join('\n');
    }

    return content;
  }

  private async writeFile(input: any): Promise<string> {
    if (!input.file_path) {
      throw new Error('Missing required parameter: file_path');
    }
    if (!input.content) {
      throw new Error('Missing required parameter: content');
    }

    const filePath = resolve(this.workDir, input.file_path);
    writeFileSync(filePath, input.content, 'utf-8');
    return `File written successfully: ${filePath}`;
  }

  private async editFile(input: any): Promise<string> {
    if (!input.file_path) {
      throw new Error('Missing required parameter: file_path');
    }
    if (!input.old_string) {
      throw new Error('Missing required parameter: old_string');
    }
    if (!input.new_string) {
      throw new Error('Missing required parameter: new_string');
    }

    const filePath = resolve(this.workDir, input.file_path);

    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    let content = readFileSync(filePath, 'utf-8');
    const oldString = input.old_string;
    const newString = input.new_string;
    const replaceAll = input.replace_all || false;

    if (replaceAll) {
      content = content.split(oldString).join(newString);
    } else {
      const index = content.indexOf(oldString);
      if (index === -1) {
        throw new Error(`String not found in file: ${oldString}`);
      }
      content = content.substring(0, index) + newString + content.substring(index + oldString.length);
    }

    writeFileSync(filePath, content, 'utf-8');
    return `File edited successfully: ${filePath}`;
  }

  private async globFiles(input: any): Promise<string> {
    if (!input.pattern) {
      throw new Error('Missing required parameter: pattern');
    }

    const pattern = input.pattern;
    const searchPath = input.path ? resolve(this.workDir, input.path) : this.workDir;

    const files = await glob(pattern, {
      cwd: searchPath,
      absolute: false,
    });

    if (files.length === 0) {
      return `No files found matching pattern: ${pattern}`;
    }

    return files.join('\n');
  }

  private async grepSearch(input: any): Promise<string> {
    const pattern = input.pattern;
    const searchPath = input.path ? resolve(this.workDir, input.path) : this.workDir;
    const globPattern = input.glob || '**/*';
    const outputMode = input.output_mode || 'files_with_matches';

    try {
      // Use grep command for searching
      let grepCmd = `grep -r "${pattern}" ${searchPath}`;

      if (outputMode === 'files_with_matches') {
        grepCmd += ' -l';
      } else if (outputMode === 'count') {
        grepCmd += ' -c';
      }

      const result = execSync(grepCmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      return result || 'No matches found';
    } catch (error: any) {
      if (error.status === 1) {
        return 'No matches found';
      }
      throw error;
    }
  }

  private async gitCommand(input: any): Promise<string> {
    const command = input.command;

    try {
      const result = execSync(`git ${command}`, {
        cwd: this.workDir,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      });
      return result || 'Command executed successfully';
    } catch (error: any) {
      throw new Error(`Git command failed: ${error.message}`);
    }
  }

  private async bashCommand(input: any): Promise<string> {
    const command = input.command;

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
      });
      return result || 'Command executed successfully';
    } catch (error: any) {
      throw new Error(`Bash command failed: ${error.message}`);
    }
  }
}
