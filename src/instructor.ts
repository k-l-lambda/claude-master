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

  constructor(config: Config, userInstruction: string, workDir: string) {
    this.client = new ClaudeClient(config);
    this.config = config;
    this.toolExecutor = new ToolExecutor(workDir);

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
    onTextChunk?: (chunk: string) => void
  ): Promise<InstructorResponse> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    return await this.executeWithTools(onThinkingChunk, onTextChunk);
  }

  async processWorkerResponse(
    workerResponse: string,
    onThinkingChunk?: (chunk: string) => void,
    onTextChunk?: (chunk: string) => void
  ): Promise<InstructorResponse> {
    this.conversationHistory.push({
      role: 'user',
      content: `Worker says: ${workerResponse}`,
    });

    return await this.executeWithTools(onThinkingChunk, onTextChunk);
  }

  private async executeWithTools(
    onThinkingChunk?: (chunk: string) => void,
    onTextChunk?: (chunk: string) => void
  ): Promise<InstructorResponse> {
    // Agentic loop: keep calling API until we get a non-tool response
    let maxIterations = 10;
    let iteration = 0;
    let fullText = '';
    let thinking = '';

    while (iteration < maxIterations) {
      iteration++;
      console.log(`[Instructor] Iteration ${iteration}`);

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
        }
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
        console.log(`[Instructor] Executing tool: ${toolUse.name}`);
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
	console.log("instructor response:", text);
    // Check if Instructor is done - must be standalone "DONE" or at end of sentence
    const isDone = /\bDONE\b\s*$/i.test(text.trim()) || text.trim().toUpperCase() === 'DONE';
	console.log("isDone:", isDone);

    // Extract instruction after "Tell worker:" (case insensitive)
    const tellWorkerMatch = text.match(/tell\s+worker:\s*([\s\S]*)/i);
    let instruction = '';

    if (tellWorkerMatch) {
      // Only send text after "Tell worker:"
      instruction = tellWorkerMatch[1].trim();
    } else {
      // Send entire response to Worker
      instruction = text.trim();
    }

    // Check for model hints (optional, can be anywhere in the response)
    let workerModel = this.config.workerModel;
    if (text.toLowerCase().includes('use opus') || text.toLowerCase().includes('model: opus')) {
      workerModel = 'claude-opus-4-1-20250805';
    } else if (text.toLowerCase().includes('use haiku') || text.toLowerCase().includes('model: haiku')) {
      workerModel = 'claude-3-5-haiku-20241022';
    } else if (text.toLowerCase().includes('use sonnet') || text.toLowerCase().includes('model: sonnet')) {
      workerModel = 'claude-sonnet-4-5-20250929';
    }

    // Continue if not done and there's an instruction
    const shouldContinue = !isDone && instruction.length > 0;

    return {
      thinking,
      instruction,
      workerModel,
      shouldContinue,
    };
  }

  getConversationHistory(): Message[] {
    return [...this.conversationHistory];
  }
}
