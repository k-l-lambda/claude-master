import Anthropic from '@anthropic-ai/sdk';
import { ClaudeClient } from './client.js';
import { Config, Message } from './types.js';
import { workerTools } from './tools.js';

export class WorkerManager {
  private client: ClaudeClient;
  private config: Config;
  private conversationHistory: Message[] = [];
  private systemPrompt: string;

  constructor(config: Config) {
    this.client = new ClaudeClient(config);
    this.config = config;
    // Simple default - Instructor can override by instructing Worker
    this.systemPrompt = 'You are a helpful AI assistant that follows instructions to implement tasks.';
  }

  async processInstruction(
    instruction: string,
    model: string,
    onTextChunk?: (chunk: string) => void
  ): Promise<string> {
    this.conversationHistory.push({
      role: 'user',
      content: instruction,
    });

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
      }
    );

    // Extract text content from response
    let fullText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        fullText += block.text;
      }
    }

    this.conversationHistory.push({
      role: 'assistant',
      content: response.content,
    });

    return fullText;
  }

  getConversationHistory(): Message[] {
    return [...this.conversationHistory];
  }

  reset(): void {
    this.conversationHistory = [];
  }
}
