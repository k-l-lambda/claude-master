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
  private workerTimeoutSetter: ((timeoutMs: number) => void) | null = null;

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
3. Execute tasks with Worker AI using worker tools
4. Review Worker's responses and call Worker again as needed
5. Manage Worker's context and system prompt for each call

You have access to file reading, writing, and git tools to understand the task and manage the project.
Worker handles the actual implementation details based on your instructions.

## Calling Worker

You have three tools to work with Worker:

### 1. call_worker(system_prompt, instruction, model?)
Resets Worker's context completely and starts fresh with a new system prompt and instruction.
Use when:
- Starting a new task
- Worker's context is cluttered or too large
- You need Worker to focus on a completely new task

Example:
\`\`\`
call_worker(
  system_prompt='You are a backend developer working on a Node.js API. Focus on security best practices and clean code.',
  instruction='Implement user authentication with JWT tokens',
  model='haiku'
)
\`\`\`

### 2. call_worker_with_file(system_prompt_file, instruction, model?)
Like call_worker, but loads the system prompt from a file. Useful when you have complex system prompts saved.
Use when:
- You have a detailed system prompt prepared in a file
- You want to reuse the same system prompt across multiple calls

Example:
\`\`\`
call_worker_with_file(
  system_prompt_file='/path/to/system_prompt.txt',
  instruction='Implement user authentication with JWT tokens',
  model='haiku'
)
\`\`\`

### 3. tell_worker(message, model?)
Continues Worker's existing conversation without resetting context. Worker maintains its history.
Use when:
- Iterating on current task
- Worker needs follow-up instructions
- Building upon Worker's previous work

Example:
\`\`\`
tell_worker(
  message='Add rate limiting to prevent brute force attacks',
  model='haiku'
)
\`\`\`

## Worker Context Strategy
- **call_worker / call_worker_with_file**: Clears Worker's memory - use when starting new tasks
- **tell_worker**: Maintains Worker's context - use for iterative work
- You control Worker's entire context through your choice of tools

## Other Tools
- **set_worker_timeout**: Adjust Worker's inactivity timeout (default 60s, range 30-600s)
  - Use longer timeout (120-300s) for complex tasks requiring more thinking time

## Task Completion
When the task is complete, respond with "DONE" to end the session.

## Handling Worker Errors
If Worker returns a message starting with "[ERROR: ...]":
- Analyze the error message carefully (contains diagnostic info and suggested actions)
- Follow the suggested actions in the error message
- Most errors are recoverable - retry after taking corrective action
- Authentication errors require user intervention

## Your Context Management
Your conversation history may be compacted when approaching token limits (50k+ tokens):
- User can trigger compaction with "[compact]" command
- System will auto-compact near 50k tokens (25% of 200k limit)
- After compaction, your history is replaced with a detailed summary

## Session Resumption
Worker's conversation history is NOT persisted between sessions. When resuming:
- Use instruction_only mode to provide fresh context
- Worker starts with a clean slate each session
- You are responsible for re-establishing context as needed`;
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

    // Add Worker's response directly to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: `Worker's response:\n${workerResponse}`,
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

    try {
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
      let usedWorkerTool = false; // Track if worker tool was used

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
        // Handle call_worker tool
        else if (toolUse.name === 'call_worker') {
          const result = await this.handleCallWorkerTool(toolUse);
          toolResults.push(result);
          usedWorkerTool = true; // Worker tool used - should end Instructor's turn
        }
        // Handle call_worker_with_file tool
        else if (toolUse.name === 'call_worker_with_file') {
          const result = await this.handleCallWorkerWithFileTool(toolUse);
          toolResults.push(result);
          usedWorkerTool = true; // Worker tool used - should end Instructor's turn
        }
        // Handle tell_worker tool
        else if (toolUse.name === 'tell_worker') {
          const result = await this.handleTellWorkerTool(toolUse);
          toolResults.push(result);
          usedWorkerTool = true; // Worker tool used - should end Instructor's turn
        }
        // Handle set_worker_timeout tool
        else if (toolUse.name === 'set_worker_timeout') {
          const result = await this.handleWorkerTimeoutTool(toolUse);
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

      // If a worker tool was used, end Instructor's turn
      // Control should pass to Worker
      if (usedWorkerTool) {
        break;
      }
    }

    if (iteration >= maxIterations) {
      fullText += '\n\n[Warning: Reached maximum tool execution iterations]';
    }

    return this.parseInstructorResponse(fullText, thinking);
    } catch (error: any) {
      // Handle Instructor context too long error
      if (error.status === 400 && error.message?.includes('too long')) {
        const { TokenCounter } = await import('./token-counter.js');
        const tokenCount = TokenCounter.countConversationTokens(this.conversationHistory);

        // Throw a special error that orchestrator will catch and trigger compaction
        const compactionError = new Error('INSTRUCTOR_CONTEXT_TOO_LONG');
        (compactionError as any).tokenCount = tokenCount;
        throw compactionError;
      }

      // For other errors, re-throw (these should be handled by orchestrator)
      throw error;
    }
  }

  private parseInstructorResponse(text: string, thinking: string): InstructorResponse {
    // Check if Instructor is done - look for DONE as a standalone statement AT THE END
    const trimmedText = text.trim();
    const lastLine = trimmedText.split('\n').slice(-3).join('\n'); // Check last 3 lines
    const isDone = /\*\*DONE\*\*|__DONE__|_DONE__|(?:^|\n)\s*DONE[\s.!]*$/.test(lastLine);

    const shouldContinue = !isDone;

    // Check if Instructor used worker tools when it should continue
    let needsCorrection = false;
    if (shouldContinue) {
      const callWorkerParams = this.getCallWorkerParams();
      if (!callWorkerParams) {
        // Instructor should continue but didn't use call_worker, call_worker_with_file, or tell_worker
        needsCorrection = true;
      }
    }

    return {
      thinking,
      callWorker: undefined,  // Will be extracted by orchestrator from tool results
      shouldContinue,
      needsCorrection,
    };
  }

  getConversationHistory(): Message[] {
    return [...this.conversationHistory];
  }

  /**
   * Extract call_worker parameters from most recent conversation
   * Looks through recent conversation history for call_worker tool results
   */
  getCallWorkerParams(): import('./types.js').CallWorkerParams | null {
    // Search backwards through conversation history for call_worker tool result
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      const msg = this.conversationHistory[i];

      // Look for user messages (tool results)
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          // Tool results have type 'tool_result' and content property
          if ((block as any).type === 'tool_result' && typeof (block as any).content === 'string') {
            try {
              const parsed = JSON.parse((block as any).content);
              if (parsed._call_worker_params) {
                return parsed._call_worker_params;
              }
            } catch (e) {
              // Not JSON or doesn't contain call_worker_params
              continue;
            }
          }
        }
      }

      // Stop searching once we hit an assistant message without tools
      if (msg.role === 'assistant') {
        break;
      }
    }

    return null;
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

  setWorkerTimeoutSetter(setter: (timeoutMs: number) => void): void {
    this.workerTimeoutSetter = setter;
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
  /**
   * Handle call_worker tool - resets Worker context with inline system prompt
   */
  private async handleCallWorkerTool(toolUse: any): Promise<any> {
    try {
      const input = toolUse.input as any;

      // Return tool result indicating call_worker was invoked
      // The actual Worker call will be handled by orchestrator
      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify({
          _call_worker_params: {
            tool_name: 'call_worker',
            system_prompt: input.system_prompt,
            instruction: input.instruction,
            model: input.model,
          }
        }),
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
   * Handle call_worker_with_file tool - resets Worker context with system prompt from file
   */
  private async handleCallWorkerWithFileTool(toolUse: any): Promise<any> {
    try {
      const input = toolUse.input as any;

      // Read system prompt from file
      const fs = await import('fs/promises');
      let systemPrompt: string;
      try {
        systemPrompt = await fs.readFile(input.system_prompt_file, 'utf-8');
      } catch (error) {
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Error reading system prompt file: ${error instanceof Error ? error.message : String(error)}`,
          is_error: true,
        };
      }

      // Return tool result indicating call_worker_with_file was invoked
      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify({
          _call_worker_params: {
            tool_name: 'call_worker_with_file',
            system_prompt: systemPrompt,
            instruction: input.instruction,
            model: input.model,
          }
        }),
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
   * Handle tell_worker tool - continues Worker's existing conversation
   */
  private async handleTellWorkerTool(toolUse: any): Promise<any> {
    try {
      const input = toolUse.input as any;

      // Return tool result indicating tell_worker was invoked
      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify({
          _call_worker_params: {
            tool_name: 'tell_worker',
            message: input.message,
            model: input.model,
          }
        }),
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
   * Handle set_worker_timeout tool
   */
  private async handleWorkerTimeoutTool(toolUse: any): Promise<any> {
    try {
      if (!this.workerTimeoutSetter) {
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: 'Error: Worker timeout setter not initialized.',
          is_error: true,
        };
      }

      const timeoutSeconds = toolUse.input.timeout_seconds;
      const reason = toolUse.input.reason || 'No reason provided';

      // Validate timeout range
      if (timeoutSeconds < 30 || timeoutSeconds > 600) {
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `❌ Invalid timeout: ${timeoutSeconds}s. Timeout must be between 30 and 600 seconds.`,
          is_error: true,
        };
      }

      // Set the timeout
      const timeoutMs = timeoutSeconds * 1000;
      this.workerTimeoutSetter(timeoutMs);

      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: `✓ Worker timeout set to ${timeoutSeconds} seconds (${Math.floor(timeoutSeconds / 60)}m ${timeoutSeconds % 60}s)
Reason: ${reason}

💡 Worker will abort if it doesn't output any token for ${timeoutSeconds} seconds.
- Default: 60s (good for most tasks)
- Complex tasks: 120-300s
- Simple tasks: 30-60s`,
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
