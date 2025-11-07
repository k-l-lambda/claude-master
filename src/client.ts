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

  /**
   * Generate mock response for debug mode
   */
  private generateMockResponse(model: string, useThinking: boolean, context?: 'instructor' | 'worker'): Anthropic.Message {
    // Determine if this is for Worker - Worker responses should never have "Tell worker:" or "DONE"
    const isWorker = context === 'worker';

    const instructorResponses = [
      // Correct format - with "Tell worker"
      {
        weight: 3,
        text: 'I understand the task. Let me instruct the Worker to proceed.\n\nTell worker: Please implement the requested feature.'
      },
      {
        weight: 3,
        text: 'Let me analyze this. The Worker should handle the implementation.\n\nTell worker: Create a function to solve this problem.'
      },
      {
        weight: 0.1,
        text: 'This looks good. The task is complete.\n\nDONE.\n'
      },
      {
        weight: 0.1,
        text: 'All requirements have been satisfied.\n\n**DONE**'
      },
      // Incorrect format - needs correction
      {
        weight: 0.5,
        text: 'I think we should implement this feature using TypeScript. It would be better for type safety.'
      },
      {
        weight: 0.5,
        text: 'This is a good approach. Let me think about how to proceed with the implementation.'
      },
      {
        weight: 0.5,
        text: 'I\'ve reviewed the code and it looks mostly correct, but there might be some edge cases to consider.'
      },
      // With code blocks
      {
        weight: 0.1,
        text: 'Here\'s how to run it:\n```bash\nnpm start\n```\n\nDONE!'
      },
    ];

    const workerResponses = [
      {
        weight: 3,
        text: 'I\'ve implemented the feature as requested. The code is working correctly.'
      },
      {
        weight: 3,
        text: 'The function has been created. Here\'s what I did:\n\n```typescript\nfunction solve() {\n  // Implementation\n  return result;\n}\n```\n\nAll tests are passing.'
      },
      {
        weight: 2,
        text: 'Task completed successfully. I\'ve added the requested functionality and verified it works as expected.'
      },
      {
        weight: 2,
        text: 'Implementation complete. The feature is ready and I\'ve tested it with various inputs.'
      },
      {
        weight: 1,
        text: 'Done! The changes have been implemented and are working correctly.'
      },
    ];

    const responses = isWorker ? workerResponses : instructorResponses;

    // Weighted random selection
    const totalWeight = responses.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;

    let selectedText = responses[0].text;
    for (const response of responses) {
      random -= response.weight;
      if (random <= 0) {
        selectedText = response.text;
        break;
      }
    }

    const content: Anthropic.ContentBlock[] = [];

    // Add thinking if requested
    if (useThinking) {
      content.push({
        type: 'thinking',
        thinking: 'Mock thinking: Analyzing the request and determining the appropriate response format.',
      } as any);
    }

    // Add text content
    content.push({
      type: 'text',
      text: selectedText,
      citations: [],
    });

    return {
      id: 'mock-msg-' + Date.now(),
      type: 'message',
      role: 'assistant',
      content,
      model,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      } as any,
    };
  }

  /**
   * Simulate streaming for mock response
   */
  private async streamMockResponse(
    model: string,
    useThinking: boolean,
    onChunk?: (chunk: string, type: 'thinking' | 'text') => void,
    context?: 'instructor' | 'worker'
  ): Promise<Anthropic.Message> {
    const response = this.generateMockResponse(model, useThinking, context);

    // Simulate streaming delay
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (const block of response.content) {
      if (block.type === 'thinking' && onChunk) {
        const thinking = (block as any).thinking || '';
        // Stream thinking in chunks
        for (let i = 0; i < thinking.length; i += 10) {
          await delay(20);
          onChunk(thinking.slice(i, i + 10), 'thinking');
        }
      } else if (block.type === 'text' && onChunk) {
        const text = block.text;
        // Stream text in chunks
        for (let i = 0; i < text.length; i += 5) {
          await delay(30);
          onChunk(text.slice(i, i + 5), 'text');
        }
      }
    }

    return response;
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
    onChunk?: (chunk: string, type: 'thinking' | 'text') => void,
    abortSignal?: AbortSignal,
    context?: 'instructor' | 'worker'
  ): Promise<Anthropic.Message> {
    // Debug mode: return mock response
    if (this.config.debugMode) {
      console.log('[DEBUG MODE] Generating mock response instead of calling API');
      return await this.streamMockResponse(model, useThinking, onChunk, context);
    }

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

    const stream = await this.client.messages.create(
      {
        ...params,
        stream: true,
      },
      abortSignal ? { signal: abortSignal } : undefined
    );

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
        } else if (event.delta.type === 'input_json_delta') {
          // Handle tool_use input accumulation
          if (block) {
            block.partial_json = (block.partial_json || '') + event.delta.partial_json;
          }
        }
      } else if (event.type === 'content_block_stop') {
        // Finalize tool_use input
        const block = contentBlocks.get(event.index);
        if (block && block.type === 'tool_use' && block.partial_json) {
          try {
            block.input = JSON.parse(block.partial_json);
            delete block.partial_json; // Clean up temporary field
          } catch (e) {
            // Failed to parse tool input JSON, use empty object
            block.input = {};
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
