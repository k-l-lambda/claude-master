import Anthropic from '@anthropic-ai/sdk';
import { ClaudeClient } from './client.js';
import { Config, Message, InstructorResponse } from './types.js';
import { instructorTools } from './tools.js';

export class InstructorManager {
  private client: ClaudeClient;
  private config: Config;
  private conversationHistory: Message[] = [];
  private systemPrompt: string;

  constructor(config: Config, userSystemPrompt: string) {
    this.client = new ClaudeClient(config);
    this.config = config;
    this.systemPrompt = this.buildSystemPrompt(userSystemPrompt);
  }

  private buildSystemPrompt(userPrompt: string): string {
    return `You are the INSTRUCTOR in a dual-AI system. Your role is to:

1. Accept high-level tasks from the user
2. Use extended thinking to deeply analyze and plan the approach
3. Break down tasks and provide clear instructions to the WORKER AI
4. Review WORKER's responses and provide further guidance
5. Determine what model the WORKER should use for different tasks

${userPrompt}

IMPORTANT INSTRUCTIONS:
- You have access to file reading and git tools only - use them to understand the codebase
- You CANNOT write or edit files directly - instruct the WORKER to do so
- After seeing WORKER's response, respond in this format:

<instruction>
[Your instruction to the WORKER - be specific and clear]
</instruction>

<worker_model>
[Model to use: "opus", "sonnet", or "haiku". Default: sonnet]
</worker_model>

<continue>
[YES or NO - whether to continue the conversation]
</continue>

Use your thinking capability to deeply analyze the problem before giving instructions.`;
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

    const response = await this.client.streamMessage(
      this.conversationHistory,
      this.config.instructorModel,
      this.systemPrompt,
      instructorTools,
      true, // Use thinking
      (chunk, type) => {
        if (type === 'thinking' && onThinkingChunk) {
          onThinkingChunk(chunk);
        } else if (type === 'text' && onTextChunk) {
          onTextChunk(chunk);
        }
      }
    );

    // Extract text content from response
    let fullText = '';
    let thinking = '';

    for (const block of response.content) {
      if (block.type === 'thinking') {
        thinking = block.thinking || '';
      } else if (block.type === 'text') {
        fullText += block.text;
      }
    }

    this.conversationHistory.push({
      role: 'assistant',
      content: response.content,
    });

    return this.parseInstructorResponse(fullText, thinking);
  }

  async processWorkerResponse(
    workerResponse: string,
    onThinkingChunk?: (chunk: string) => void,
    onTextChunk?: (chunk: string) => void
  ): Promise<InstructorResponse> {
    this.conversationHistory.push({
      role: 'user',
      content: `WORKER's response:\n\n${workerResponse}`,
    });

    const response = await this.client.streamMessage(
      this.conversationHistory,
      this.config.instructorModel,
      this.systemPrompt,
      instructorTools,
      true, // Use thinking
      (chunk, type) => {
        if (type === 'thinking' && onThinkingChunk) {
          onThinkingChunk(chunk);
        } else if (type === 'text' && onTextChunk) {
          onTextChunk(chunk);
        }
      }
    );

    // Extract text content from response
    let fullText = '';
    let thinking = '';

    for (const block of response.content) {
      if (block.type === 'thinking') {
        thinking = block.thinking || '';
      } else if (block.type === 'text') {
        fullText += block.text;
      }
    }

    this.conversationHistory.push({
      role: 'assistant',
      content: response.content,
    });

    return this.parseInstructorResponse(fullText, thinking);
  }

  private parseInstructorResponse(text: string, thinking: string): InstructorResponse {
    const instructionMatch = text.match(/<instruction>([\s\S]*?)<\/instruction>/);
    const modelMatch = text.match(/<worker_model>([\s\S]*?)<\/worker_model>/);
    const continueMatch = text.match(/<continue>([\s\S]*?)<\/continue>/);

    let workerModel = this.config.workerModel;
    if (modelMatch) {
      const modelStr = modelMatch[1].trim().toLowerCase();
      if (modelStr.includes('opus')) {
        workerModel = 'claude-opus-4-1-20250805';
      } else if (modelStr.includes('haiku')) {
        workerModel = 'claude-3-5-haiku-20241022';
      } else {
        workerModel = 'claude-sonnet-4-5-20250929';
      }
    }

    return {
      thinking,
      instruction: instructionMatch ? instructionMatch[1].trim() : text,
      workerModel,
      shouldContinue: continueMatch
        ? continueMatch[1].trim().toUpperCase() === 'YES'
        : true,
    };
  }

  getConversationHistory(): Message[] {
    return [...this.conversationHistory];
  }
}
