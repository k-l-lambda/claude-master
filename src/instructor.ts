import Anthropic from '@anthropic-ai/sdk';
import { ClaudeClient } from './client.js';
import { Config, Message, InstructorResponse } from './types.js';
import { instructorTools } from './tools.js';
import { ToolExecutor } from './tool-executor.js';
import { WorkerManager } from './worker.js';

export class InstructorManager {
  private client: ClaudeClient;
  private config: Config;
  private conversationHistory: Message[] = [];
  private systemPrompt: string;
  private toolExecutor: ToolExecutor;
  private workerToolExecutor: ToolExecutor | null = null;
  private workerManager: WorkerManager | null = null;

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
- "use haiku" or "model: haiku" for claude-3-5-haiku-20241022

## Context Management

**Worker Context**: Worker's conversation history is NOT persisted between sessions. When resuming a session:
- You need to re-explain the task context to Worker
- Worker starts with a clean slate each time
- You are responsible for providing Worker with necessary background

**Managing Worker Context During a Session**:
You can manage Worker's context using these tools:
- get_worker_context_size: Check how many tokens Worker's history is using
- compact_worker_context: Trim Worker's history to keep only the most recent N rounds (default: 10)
  - Use when Worker's context > 100k tokens (50% of limit)
  - This keeps recent context while reducing token usage
  - Worker will still remember the last N rounds of conversation
  - Example: compact_worker_context with keep_rounds=5 keeps last 5 rounds only

**Your Context**: Your conversation history may be compacted when approaching token limits (50k+ tokens):
- User can trigger compaction with "[compact]" command
- System will auto-compact near 50k tokens (25% of 200k limit)
- After compaction, your history is replaced with a detailed summary
- You can manage Worker's context by trimming when needed

**Note**: If Worker's context grows too large or becomes cluttered, use compact_worker_context to trim old context while preserving recent conversation.`;
  }

  async processUserInput(
    userMessage: string,
    onThinkingChunk?: (chunk: string) => void,
    onTextChunk?: (chunk: string) => void,
    abortSignal?: AbortSignal
  ): Promise<InstructorResponse> {
    // Validate message is not empty
    if (!userMessage || userMessage.trim().length === 0) {
      throw new Error('Cannot process empty user message');
    }

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
    // Validate response is not empty
    if (!workerResponse || workerResponse.trim().length === 0) {
      throw new Error('Cannot process empty worker response');
    }

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
    let maxIterations = 50;
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
        abortSignal,
        'instructor'
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
          content: this.sanitizeContent(response.content),
        });

        break;
      }

      // Execute tools and collect results
      const toolResults: any[] = [];
      for (const toolUse of toolUses) {
        // Log tool execution with parameters
        const { Display } = await import('./display.js');

        // Format tool parameters
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

        // Handle special permission management tools
        if (toolUse.name === 'grant_worker_permission' || toolUse.name === 'revoke_worker_permission') {
          const result = await this.handlePermissionTool(toolUse);
          toolResults.push(result);
        }
        // Handle Worker context management tools
        else if (toolUse.name === 'compact_worker_context' || toolUse.name === 'get_worker_context_size') {
          const result = await this.handleWorkerContextTool(toolUse);
          toolResults.push(result);
        }
        else {
          const result = await this.toolExecutor.executeTool(toolUse);
          toolResults.push(result);
        }
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
    // Check if Instructor is done - look for DONE as a standalone statement AT THE END
    // Allow for markdown formatting like **DONE**, _DONE_, or plain DONE
    // DONE must appear at the END of response, not at the beginning
    const trimmedText = text.trim();
    const lastLine = trimmedText.split('\n').slice(-3).join('\n'); // Check last 3 lines

    // Match DONE only when it's:
    // - Formatted: **DONE**, __DONE__, _DONE_ (anywhere in last 3 lines)
    // - Or standalone: DONE at the very end, optionally followed by markdown code fence
    // Use (?:^|\n) to match start-of-string OR after newline, ensuring it's on last line
    // Allow optional ``` after DONE (for markdown code blocks)
    const isDone = /\*\*DONE\*\*|__DONE__|_DONE__|(?:^|\n)\s*DONE[\s.!]*$/.test(lastLine);

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

    // If no instruction and not done, it means we need to prompt Instructor to continue
    const needsCorrection = !isDone && instruction.length === 0 && text.trim().length > 0;

    // Continue if not done AND has instruction (normal flow)
    // Note: needsCorrection doesn't set shouldContinue=true because correction
    // is handled separately by orchestrator - it will prompt and get new response
    const shouldContinue = !isDone;

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

  restoreConversationHistory(messages: Message[]): void {
    this.conversationHistory = [...messages];
  }

  setWorkerToolExecutor(workerToolExecutor: ToolExecutor, workerManager?: WorkerManager): void {
    this.workerToolExecutor = workerToolExecutor;
    if (workerManager) {
      this.workerManager = workerManager;
    }
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

  /**
   * Handle Worker context management tools
   */
  private async handleWorkerContextTool(toolUse: any): Promise<any> {
    try {
      if (!this.workerManager) {
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: 'Error: Worker manager not initialized. Cannot manage Worker context.',
          is_error: true,
        };
      }

      if (toolUse.name === 'compact_worker_context') {
        // Import TokenCounter here to avoid circular dependencies
        const { TokenCounter } = await import('./token-counter.js');

        const keepRounds = toolUse.input.keep_rounds || 10;
        const reason = toolUse.input.reason || 'Reduce context size';

        const messages = this.workerManager.getConversationHistory();
        const oldSize = TokenCounter.countConversationTokens(messages);
        const oldCount = messages.length;

        // Count actual rounds: count user messages that are instructions (string content)
        // Each round starts with a user instruction (string), not tool_result (array)
        let roundCount = 0;
        const roundStartIndices: number[] = [];

        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          if (msg.role === 'user' && typeof msg.content === 'string') {
            // This is an instruction, not a tool_result
            roundCount++;
            roundStartIndices.push(i);
          }
        }

        if (roundCount <= keepRounds) {
          return {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `ℹ️  Worker context is already small (${roundCount} rounds, ${messages.length} messages).
No compaction needed.
Current size: ${oldSize.toLocaleString()} tokens (estimated)`,
          };
        }

        // Keep messages from the (roundCount - keepRounds)th round onwards
        const keepFromIndex = roundStartIndices[roundCount - keepRounds];
        const trimmedMessages = messages.slice(keepFromIndex);
        this.workerManager.restoreConversationHistory(trimmedMessages);

        const newSize = TokenCounter.countConversationTokens(trimmedMessages);
        const newCount = trimmedMessages.length;
        const savedTokens = oldSize - newSize;
        const savedPercentage = Math.round((savedTokens / oldSize) * 100);

        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `✓ Worker context has been compacted successfully.
Reason: ${reason}
Kept: Last ${keepRounds} rounds (${newCount} messages)
Removed: ${oldCount - newCount} messages from ${roundCount - keepRounds} old rounds

Token Usage:
- Before: ${oldSize.toLocaleString()} tokens
- After: ${newSize.toLocaleString()} tokens
- Saved: ${savedTokens.toLocaleString()} tokens (${savedPercentage}%)

💡 Worker still remembers the last ${keepRounds} rounds of conversation.`,
        };
      } else if (toolUse.name === 'get_worker_context_size') {
        const { TokenCounter } = await import('./token-counter.js');

        const messages = this.workerManager.getConversationHistory();
        const usage = TokenCounter.formatTokenUsage(messages);
        const messageCount = messages.length;

        // Count actual rounds: count user messages that are instructions (string content)
        let roundCount = 0;
        for (const msg of messages) {
          if (msg.role === 'user' && typeof msg.content === 'string') {
            roundCount++;
          }
        }

        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Worker Context Size:
- Rounds: ${roundCount} (${messageCount} messages total)
- Token usage: ${usage}

💡 Recommendation:
- Consider compacting if > 100k tokens (50% of limit)
- Must compact if approaching 160k tokens (80% of limit)
- Use compact_worker_context to trim to recent rounds`,
        };
      }

      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: 'Unknown Worker context tool',
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
