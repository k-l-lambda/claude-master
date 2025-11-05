import Anthropic from '@anthropic-ai/sdk';
import { ClaudeClient } from './client.js';
import { Config, Message, InstructorResponse } from './types.js';
import { instructorTools } from './tools.js';

export class InstructorManager {
  private client: ClaudeClient;
  private config: Config;
  private conversationHistory: Message[] = [];
  private systemPrompt: string;

  constructor(config: Config, userInstruction: string) {
    this.client = new ClaudeClient(config);
    this.config = config;
    this.systemPrompt = userInstruction;
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
      content: `Worker says: ${workerResponse}`,
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
    // Check if Instructor is done
    const isDone = text.trim().toUpperCase().includes('DONE');

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

    return {
      thinking,
      instruction,
      workerModel,
      shouldContinue: !isDone && instruction.length > 0,
    };
  }

  getConversationHistory(): Message[] {
    return [...this.conversationHistory];
  }
}
