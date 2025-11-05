import Anthropic from '@anthropic-ai/sdk';
import { Config, Message, Tool } from './types.js';

export class ClaudeClient {
  private client: Anthropic;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.client = new Anthropic({
      authToken: config.authToken,
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  async sendMessage(
    messages: Message[],
    model: string,
    systemPrompt: string,
    tools?: Tool[],
    useThinking: boolean = false
  ): Promise<Anthropic.Message> {
    const params: Anthropic.MessageCreateParams = {
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content,
      })),
    };

    if (tools && tools.length > 0) {
      params.tools = tools;
    }

    if (useThinking) {
      params.thinking = {
        type: 'enabled',
        budget_tokens: 10000,
      };
    }

    return await this.client.messages.create(params);
  }

  async streamMessage(
    messages: Message[],
    model: string,
    systemPrompt: string,
    tools?: Tool[],
    useThinking: boolean = false,
    onChunk?: (chunk: string, type: 'thinking' | 'text') => void
  ): Promise<Anthropic.Message> {
    const params: Anthropic.MessageCreateParams = {
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content,
      })),
    };

    if (tools && tools.length > 0) {
      params.tools = tools;
    }

    if (useThinking) {
      params.thinking = {
        type: 'enabled',
        budget_tokens: 10000,
      };
    }

    const stream = await this.client.messages.create({
      ...params,
      stream: true,
    });

    // Build the complete message from stream events
    let messageData: any = {
      id: '',
      type: 'message',
      role: 'assistant',
      content: [],
      model: model,
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    };

    const contentBlocks: Map<number, any> = new Map();

    for await (const event of stream) {
      if (event.type === 'message_start') {
        messageData = { ...messageData, ...event.message };
      } else if (event.type === 'content_block_start') {
        contentBlocks.set(event.index, event.content_block);
      } else if (event.type === 'content_block_delta') {
        const block = contentBlocks.get(event.index);
        if (event.delta.type === 'thinking_delta') {
          if (block) {
            block.thinking = (block.thinking || '') + (event.delta.thinking || '');
          }
          if (onChunk) {
            onChunk(event.delta.thinking || '', 'thinking');
          }
        } else if (event.delta.type === 'text_delta') {
          if (block) {
            block.text = (block.text || '') + event.delta.text;
          }
          if (onChunk) {
            onChunk(event.delta.text, 'text');
          }
        }
      } else if (event.type === 'message_delta') {
        if (event.delta.stop_reason) {
          messageData.stop_reason = event.delta.stop_reason;
        }
        if (event.delta.stop_sequence) {
          messageData.stop_sequence = event.delta.stop_sequence;
        }
        if (event.usage) {
          messageData.usage = {
            ...messageData.usage!,
            output_tokens: event.usage.output_tokens,
          };
        }
      }
    }

    // Convert map to array
    messageData.content = Array.from(contentBlocks.values());

    return messageData as Anthropic.Message;
  }
}
