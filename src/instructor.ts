import Anthropic from '@anthropic-ai/sdk';
import { ClaudeClient } from './client.js';
import { Config, Message, InstructorResponse } from './types.js';
import { instructorTools } from './tools.js';
import { ToolExecutor } from './tool-executor.js';

export class InstructorManager {
  private client: ClaudeClient;
  private config: Config;
  private conversationHistory: Message[] = [];
  private systemPrompt: string;
  private toolExecutor: ToolExecutor;
  private workerToolExecutor: ToolExecutor | null = null;

  constructor(config: Config, userInstruction: string, workDir: string) {
    this.client = new ClaudeClient(config);
    this.config = config;
    // Pass allowed tool names to ToolExecutor
    const allowedToolNames = instructorTools.map(t => t.name);
    // Instructor has no permanently forbidden tools (empty array)
    this.toolExecutor = new ToolExecutor(workDir, allowedToolNames, []);

    // Instructor's role: understand the task and orchestrate the Worker
    this.systemPrompt = `${userInstruction}

You are the Instructor AI. Your role is to:
1. Read and understand task requirements (you have file reading tools)
2. Plan and break down tasks
3. Instruct the Worker AI to execute specific implementation actions
4. Review Worker's responses and provide next instructions
5. Decide which model the Worker should use (opus/sonnet/haiku)

You have access to file reading, writing, and git tools to understand the task and manage the project.
The Worker will handle the actual implementation details.

When you want the Worker to do something, use the format:
"Tell worker: [your instruction here]"

When the task is complete, respond with "DONE" to end the session.

You can specify which model the Worker should use by including:
- "use opus" or "model: opus" for claude-opus-4-1-20250805
- "use sonnet" or "model: sonnet" for claude-sonnet-4-5-20250929
- "use haiku" or "model: haiku" for claude-3-5-haiku-20241022`;
  }

  async processUserInput(
    userMessage: string,
    onThinkingChunk?: (chunk: string) => void,
    onTextChunk?: (chunk: string) => void,
    abortSignal?: AbortSignal
  ): Promise<InstructorResponse> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    return await this.executeWithTools(onThinkingChunk, onTextChunk, abortSignal);
  }

  async processWorkerResponse(
    workerResponse: string,
    onThinkingChunk?: (chunk: string) => void,
    onTextChunk?: (chunk: string) => void,
    abortSignal?: AbortSignal
  ): Promise<InstructorResponse> {
    this.conversationHistory.push({
      role: 'user',
      content: `Worker says: ${workerResponse}`,
    });

    return await this.executeWithTools(onThinkingChunk, onTextChunk, abortSignal);
  }

  private async executeWithTools(
    onThinkingChunk?: (chunk: string) => void,
    onTextChunk?: (chunk: string) => void,
    abortSignal?: AbortSignal
  ): Promise<InstructorResponse> {
    // Agentic loop: keep calling API until we get a non-tool response
    let maxIterations = 10;
    let iteration = 0;
    let fullText = '';
    let thinking = '';

    while (iteration < maxIterations) {
      iteration++;

      const response = await this.client.streamMessage(
        this.conversationHistory,
        this.config.instructorModel,
        this.systemPrompt,
        instructorTools,
        this.config.useThinking ?? false,
        (chunk, type) => {
          if (type === 'thinking' && onThinkingChunk) {
            onThinkingChunk(chunk);
          } else if (type === 'text' && onTextChunk) {
            onTextChunk(chunk);
          }
        },
        abortSignal
      );

      // Extract thinking
      for (const block of response.content) {
        if (block.type === 'thinking') {
          thinking = block.thinking || '';
        }
      }

      // Check if there are any tool uses
      const toolUses = response.content.filter(block => block.type === 'tool_use');

      if (toolUses.length === 0) {
        // No more tools to execute, extract final text
        for (const block of response.content) {
          if (block.type === 'text') {
            fullText += block.text;
          }
        }

        this.conversationHistory.push({
          role: 'assistant',
          content: response.content,
        });

        break;
      }

      // Execute tools and collect results
      const toolResults: any[] = [];
      for (const toolUse of toolUses) {
        // Handle special permission management tools
        if (toolUse.name === 'grant_worker_permission' || toolUse.name === 'revoke_worker_permission') {
          const result = await this.handlePermissionTool(toolUse);
          toolResults.push(result);
        } else {
          const result = await this.toolExecutor.executeTool(toolUse);
          toolResults.push(result);
        }
      }

      // Add assistant message with tool uses to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content,
      });

      // Add user message with tool results to history
      this.conversationHistory.push({
        role: 'user',
        content: toolResults,
      });

      // Extract any text that was in this response
      for (const block of response.content) {
        if (block.type === 'text') {
          fullText += block.text;
          if (onTextChunk) {
            onTextChunk(block.text);
          }
        }
      }
    }

    if (iteration >= maxIterations) {
      fullText += '\n\n[Warning: Reached maximum tool execution iterations]';
    }

    return this.parseInstructorResponse(fullText, thinking);
  }

  private parseInstructorResponse(text: string, thinking: string): InstructorResponse {
    // Check if Instructor is done - look for DONE in the last part of the response
    // Allow for markdown formatting like **DONE**, _DONE_, or plain DONE
    // Allow some punctuation and whitespace after DONE
    const trimmedText = text.trim();
    const lastLine = trimmedText.split('\n').slice(-3).join('\n'); // Check last 3 lines
    const isDone = /\*\*DONE\*\*|__DONE__|_DONE_|\bDONE\b/i.test(lastLine);

    // Extract instruction and model from "Tell worker" directive
    // Supports multiple formats:
    // - "Tell worker: instruction"
    // - "Tell worker (use sonnet): instruction"
    // - "Tell worker (model: opus): instruction"
    let instruction = '';
    let workerModel = this.config.workerModel;

    // Try to match "Tell worker" with optional model specification in parentheses
    const tellWorkerWithModelMatch = text.match(/tell\s+worker\s*\((?:use\s+)?(?:model:\s*)?(\w+)\)\s*:\s*([\s\S]*)/i);
    const tellWorkerSimpleMatch = text.match(/tell\s+worker:\s*([\s\S]*)/i);

    if (tellWorkerWithModelMatch) {
      // Format: "Tell worker (use sonnet): instruction" or "Tell worker (model: opus): instruction"
      const modelName = tellWorkerWithModelMatch[1].toLowerCase();
      instruction = tellWorkerWithModelMatch[2].trim();

      // Map model name to full model ID
      if (modelName === 'opus') {
        workerModel = 'claude-opus-4-1-20250805';
      } else if (modelName === 'haiku') {
        workerModel = 'claude-3-5-haiku-20241022';
      } else if (modelName === 'sonnet') {
        workerModel = 'claude-sonnet-4-5-20250929';
      }
    } else if (tellWorkerSimpleMatch) {
      // Format: "Tell worker: instruction"
      instruction = tellWorkerSimpleMatch[1].trim();

      // Check for model hints in the instruction text itself
      // Look for patterns like "use sonnet", "model: opus", etc.
      if (instruction.toLowerCase().includes('use opus') || instruction.toLowerCase().includes('model: opus')) {
        workerModel = 'claude-opus-4-1-20250805';
      } else if (instruction.toLowerCase().includes('use haiku') || instruction.toLowerCase().includes('model: haiku')) {
        workerModel = 'claude-3-5-haiku-20241022';
      } else if (instruction.toLowerCase().includes('use sonnet') || instruction.toLowerCase().includes('model: sonnet')) {
        workerModel = 'claude-sonnet-4-5-20250929';
      }
    } else {
      // No "Tell worker" directive found
      if (!isDone) {
        // Instructor didn't say "tell worker" and didn't say "DONE"
        // This means the instruction is incomplete
        instruction = ''; // Don't send to worker
      } else {
        // DONE was said, so we're finished
        instruction = '';
      }
    }

    // Continue if not done and there's an instruction
    const shouldContinue = !isDone && instruction.length > 0;

    // If no instruction and not done, it means we need to prompt Instructor to continue
    const needsCorrection = !isDone && instruction.length === 0 && text.trim().length > 0;

    return {
      thinking,
      instruction,
      workerModel,
      shouldContinue,
      needsCorrection,
    };
  }

  getConversationHistory(): Message[] {
    return [...this.conversationHistory];
  }

  setWorkerToolExecutor(workerToolExecutor: ToolExecutor): void {
    this.workerToolExecutor = workerToolExecutor;
  }

  private async handlePermissionTool(toolUse: any): Promise<any> {
    try {
      if (!this.workerToolExecutor) {
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: 'Error: Worker ToolExecutor not initialized. Cannot manage permissions.',
          is_error: true,
        };
      }

      const toolName = toolUse.input.tool_name;

      if (toolUse.name === 'grant_worker_permission') {
        // Check if tool is permanently forbidden for Worker
        if (this.workerToolExecutor.isPermanentlyForbidden(toolName)) {
          return {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `❌ Permission denied: Tool "${toolName}" is permanently forbidden for Worker due to security restrictions. This tool can only be used by the Instructor.\n\nPermanently forbidden tools: ${this.workerToolExecutor.getPermanentlyForbiddenTools().join(', ')}`,
            is_error: true,
          };
        }

        this.workerToolExecutor.grantPermission(toolName);
        const reason = toolUse.input.reason || 'No reason provided';
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `✓ Permission granted: Worker can now use "${toolName}". Reason: ${reason}\nWorker's current permissions: ${this.workerToolExecutor.getAllowedTools().join(', ')}`,
        };
      } else if (toolUse.name === 'revoke_worker_permission') {
        this.workerToolExecutor.revokePermission(toolName);
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `✓ Permission revoked: Worker can no longer use "${toolName}".\nWorker's current permissions: ${this.workerToolExecutor.getAllowedTools().join(', ')}`,
        };
      }

      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: 'Unknown permission tool',
        is_error: true,
      };
    } catch (error) {
      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: error instanceof Error ? error.message : String(error),
        is_error: true,
      };
    }
  }
}
