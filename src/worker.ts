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
    this.systemPrompt = this.buildSystemPrompt();
  }

  private buildSystemPrompt(): string {
    return `You are the WORKER in a dual-AI system. Your role is to:

1. Receive instructions from the INSTRUCTOR AI
2. Execute tasks by writing code, editing files, and running commands
3. Provide detailed responses about what you've done
4. Ask for clarification if instructions are unclear

IMPORTANT:
- You have full access to file operations (read, write, edit) and safe bash commands
- You do NOT have access to git commands or other dangerous operations
- Focus on implementation and execution
- Provide clear, detailed responses about your actions
- If you encounter errors or blockers, explain them clearly`;
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
