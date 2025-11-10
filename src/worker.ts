import { ClaudeClient } from './client.js';
import { Config, Message } from './types.js';
import { workerTools } from './tools.js';
import { ToolExecutor } from './tool-executor.js';

export class WorkerManager {
  private client: ClaudeClient;
  private conversationHistory: Message[] = [];
  private systemPrompt: string;
  private toolExecutor: ToolExecutor;

  /**
   * Sanitize response content blocks to remove streaming-specific fields
   * that should not be included in conversation history
   */
  private sanitizeContent(content: any[]): any[] {
    const cleaned = content.map(block => {
      if (block.type === 'tool_use') {
        // Remove partial_json and other streaming-specific fields
        const { partial_json, ...cleanBlock } = block;
        // Ensure input exists even if partial_json wasn't fully parsed
        if (!cleanBlock.input) {
          cleanBlock.input = {};
        }
        return cleanBlock;
      }
      return block;
    }).filter(block => {
      // Filter out empty text blocks
      if (block.type === 'text') {
        return block.text && block.text.trim().length > 0;
      }
      return true;
    });

    // Ensure we have at least some content
    if (cleaned.length === 0) {
      throw new Error('Cannot add message with empty content to conversation history');
    }

    return cleaned;
  }

  constructor(config: Config, workDir: string) {
    this.client = new ClaudeClient(config);
    // Pass allowed tool names to ToolExecutor
    const allowedToolNames = workerTools.map(t => t.name);
    // Git commands are permanently forbidden for Worker
    const permanentlyForbiddenTools = ['git_command'];
    this.toolExecutor = new ToolExecutor(workDir, allowedToolNames, permanentlyForbiddenTools);
    // Default system prompt - can be overridden via setSystemPrompt
    this.systemPrompt = 'You are a helpful AI assistant that follows instructions to implement tasks. You have access to tools for file operations and command execution.';
  }

  /**
   * Set Worker's system prompt dynamically
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * Reset Worker's context and call with fresh instruction
   * @param instruction Main instruction for Worker
   * @param systemPrompt Custom system prompt (optional, uses existing if not provided)
   * @param contextMessages Optional background context messages
   */
  async resetAndCall(
    instruction: string,
    model: string,
    systemPrompt?: string,
    contextMessages?: Message[],
    onTextChunk?: (chunk: string) => void,
    abortSignal?: AbortSignal
  ): Promise<string> {
    // Reset conversation history
    this.conversationHistory = [];

    // Update system prompt if provided
    if (systemPrompt) {
      this.systemPrompt = systemPrompt;
    }

    // Add context messages if provided
    if (contextMessages && contextMessages.length > 0) {
      this.conversationHistory.push(...contextMessages);
    }

    // Process the instruction with fresh context
    return await this.processInstruction(instruction, model, onTextChunk, abortSignal);
  }

  async processInstruction(
    instruction: string,
    model: string,
    onTextChunk?: (chunk: string) => void,
    abortSignal?: AbortSignal
  ): Promise<string> {
    // Validate instruction is not empty
    if (!instruction || instruction.trim().length === 0) {
      throw new Error('Cannot process empty instruction');
    }

    this.conversationHistory.push({
      role: 'user',
      content: instruction,
    });

    // Agentic loop: keep calling API until we get a non-tool response
    let maxIterations = 50; // Prevent infinite loops
    let iteration = 0;
    let finalText = '';

    try {
      while (iteration < maxIterations) {
        iteration++;

        // Filter tools based on current permissions
        const allowedToolNames = this.toolExecutor.getAllowedTools();
        const filteredTools = workerTools.filter(tool => allowedToolNames.includes(tool.name));

        const response = await this.client.streamMessage(
          this.conversationHistory,
          model,
          this.systemPrompt,
          filteredTools,
          false, // No thinking for worker
          (chunk, type) => {
            if (type === 'text' && onTextChunk) {
              onTextChunk(chunk);
            }
          },
          abortSignal,
          'worker'
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
          content: this.sanitizeContent(response.content),
        });

        break;
      }

      // Execute tools and collect results
      const toolResults: any[] = [];
      for (const toolUse of toolUses) {
        // Log tool execution with parameters
        const { Display } = await import('./display.js');

        // Format tool parameters (same logic as Instructor)
        let paramsStr = '';
        if (toolUse.input && Object.keys(toolUse.input).length > 0) {
          const paramParts: string[] = [];
          for (const [key, value] of Object.entries(toolUse.input)) {
            let valueStr: string;
            if (typeof value === 'string') {
              // Truncate long strings: keep head and tail
              if (value.length > 100) {
                const head = value.substring(0, 20).replace(/\n/g, " ");
                const tail = value.substring(value.length - 20).replace(/\n/g, " ");
                valueStr = `"${head}...${tail}"`;
              } else {
                valueStr = `"${value}"`;
              }
            } else {
              valueStr = JSON.stringify(value);
            }
            paramParts.push(`${key}=${valueStr}`);
          }
          paramsStr = ` (${paramParts.join(', ')})`;
        }

        Display.system(`🔧 ${toolUse.name}${paramsStr}`);

        const result = await this.toolExecutor.executeTool(toolUse);
        toolResults.push(result);
      }

      // Add assistant message with tool uses to history
      this.conversationHistory.push({
        role: 'assistant',
        content: this.sanitizeContent(response.content),
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
    } catch (error: any) {
      // Handle various API errors gracefully - return error message to Instructor instead of throwing

      // Check for context too long error
      if (error.status === 400 && error.message?.includes('too long')) {
        const { TokenCounter } = await import('./token-counter.js');
        const tokenCount = TokenCounter.countConversationTokens(this.conversationHistory);

        return `[ERROR: Worker context is too long]

Worker's conversation history has grown too large for the model to process.
- Current size: ~${tokenCount.toLocaleString()} tokens
- Model limit: 200,000 tokens

This happened because Worker has accumulated too much conversation history across multiple rounds.

REQUIRED ACTION:
Please use the compact_worker_context tool to trim Worker's history, then retry the instruction.

Example:
1. compact_worker_context(keep_rounds=10, reason="Context too long error")
2. Re-send the same instruction to Worker

Note: This is not a system error - it's a signal that Worker's context needs management.`;
      }

      // Handle rate limiting errors
      if (error.status === 429) {
        return `[ERROR: Rate limit exceeded]

The API rate limit has been exceeded.
- Error: ${error.message || 'Too many requests'}

SUGGESTED ACTIONS:
1. Wait a moment before retrying
2. If this persists, consider using a lower-tier model (haiku instead of sonnet)
3. Check your API usage and limits

This is a temporary error - please retry after a short delay.`;
      }

      // Handle authentication errors
      if (error.status === 401 || error.status === 403) {
        return `[ERROR: Authentication failed]

There's an issue with API authentication.
- Status: ${error.status}
- Error: ${error.message || 'Unauthorized'}

REQUIRED ACTIONS:
1. Check that ANTHROPIC_AUTH_TOKEN is correctly set
2. Verify the API key has not expired
3. Ensure the API key has proper permissions

This requires user intervention to fix the configuration.`;
      }

      // Handle timeout/abort errors
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return `[ERROR: Worker operation was aborted]

The Worker's operation was interrupted or timed out.
- This could be due to inactivity timeout or user interruption

SUGGESTED ACTIONS:
1. If this was a timeout, consider increasing worker timeout: set_worker_timeout(timeout_seconds=180)
2. Retry the instruction
3. If the task is too complex, break it into smaller steps

This is a recoverable error - you can retry or adjust the approach.`;
      }

      // Handle other API errors (500, network issues, etc.)
      const errorMessage = error.message || String(error);
      const errorStatus = error.status ? `Status ${error.status}` : 'Unknown status';

      return `[ERROR: Worker encountered an API error]

An unexpected error occurred while processing the instruction.
- ${errorStatus}
- Error: ${errorMessage}

SUGGESTED ACTIONS:
1. Retry the same instruction (transient errors often resolve on retry)
2. If it persists, try breaking down the task into smaller steps
3. Check if there are any API service issues

Error details:
${JSON.stringify({ status: error.status, message: errorMessage, type: error.name }, null, 2)}

This may be a temporary issue - consider retrying or adjusting the approach.`;
    }
  }

  getConversationHistory(): Message[] {
    return [...this.conversationHistory];
  }

  restoreConversationHistory(messages: Message[]): void {
    this.conversationHistory = [...messages];
  }

  reset(): void {
    this.conversationHistory = [];
  }

  resetConversationHistory(): void {
    this.reset();
  }

  getToolExecutor(): ToolExecutor {
    return this.toolExecutor;
  }
}
