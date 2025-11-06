import { ClaudeClient } from './client.js';
import { Config, Message } from './types.js';
import { workerTools } from './tools.js';
import { ToolExecutor } from './tool-executor.js';

export class WorkerManager {
  private client: ClaudeClient;
  private conversationHistory: Message[] = [];
  private systemPrompt: string;
  private toolExecutor: ToolExecutor;

  constructor(config: Config, workDir: string) {
    this.client = new ClaudeClient(config);
    // Pass allowed tool names to ToolExecutor
    const allowedToolNames = workerTools.map(t => t.name);
    // Git commands are permanently forbidden for Worker
    const permanentlyForbiddenTools = ['git_command'];
    this.toolExecutor = new ToolExecutor(workDir, allowedToolNames, permanentlyForbiddenTools);
    // Simple default - Instructor can override by instructing Worker
    this.systemPrompt = 'You are a helpful AI assistant that follows instructions to implement tasks. You have access to tools for file operations and command execution.';
  }

  async processInstruction(
    instruction: string,
    model: string,
    onTextChunk?: (chunk: string) => void,
    abortSignal?: AbortSignal
  ): Promise<string> {
    this.conversationHistory.push({
      role: 'user',
      content: instruction,
    });

    // Agentic loop: keep calling API until we get a non-tool response
    let maxIterations = 10; // Prevent infinite loops
    let iteration = 0;
    let finalText = '';

    while (iteration < maxIterations) {
      iteration++;

      const response = await this.client.streamMessage(
        this.conversationHistory,
        model,
        this.systemPrompt,
        workerTools,
        false, // No thinking for worker
        (chunk, type) => {
          if (type === 'text' && onTextChunk) {
            onTextChunk(chunk);
          }
        },
        abortSignal
      );

      // Check if there are any tool uses
      const toolUses = response.content.filter(block => block.type === 'tool_use');

      if (toolUses.length === 0) {
        // No more tools to execute, extract final text
        for (const block of response.content) {
          if (block.type === 'text') {
            finalText += block.text;
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
        const result = await this.toolExecutor.executeTool(toolUse);
        toolResults.push(result);
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
          finalText += block.text;
          if (onTextChunk) {
            onTextChunk(block.text);
          }
        }
      }
    }

    if (iteration >= maxIterations) {
      finalText += '\n\n[Warning: Reached maximum tool execution iterations]';
    }

    return finalText;
  }

  getConversationHistory(): Message[] {
    return [...this.conversationHistory];
  }

  reset(): void {
    this.conversationHistory = [];
  }

  getToolExecutor(): ToolExecutor {
    return this.toolExecutor;
  }
}
