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
   * Get the underlying Anthropic client instance
   */
  getClient(): Anthropic {
    return this.client;
  }

  /**
   * Generate mock response for debug mode
   */
  private generateMockResponse(model: string, useThinking: boolean, context?: 'instructor' | 'worker'): Anthropic.Message {
    // Determine if this is for Worker - Worker responses should never have "Tell worker:" or "DONE"
    const isWorker = context === 'worker';

    const instructorResponses = [
      // Correct format - using call_worker tool (would trigger tool execution)
      {
        weight: 3,
        text: 'I understand the task. Let me delegate this to Worker with appropriate context.',
        useTool: true,
        toolName: 'call_worker',
      },
      {
        weight: 3,
        text: 'I\'ll have Worker implement this feature. Setting up the context now.',
        useTool: true,
        toolName: 'call_worker',
      },
      {
        weight: 2,
        text: 'Good progress. Let me continue with Worker on the next steps.',
        useTool: true,
        toolName: 'tell_worker',
      },
      {
        weight: 2,
        text: 'Worker needs more guidance. Let me provide additional instructions.',
        useTool: true,
        toolName: 'tell_worker',
      },
      {
        weight: 1,
        text: 'I have a detailed system prompt file prepared. Let me use it for Worker.',
        useTool: true,
        toolName: 'call_worker_with_file',
      },
      // Task completion
      {
        weight: 0.1,
        text: 'Excellent work! All requirements have been fulfilled.\n\nDONE'
      },
      {
        weight: 0.1,
        text: 'The implementation is complete and tested. Task finished.\n\n**DONE**'
      },
      // Incorrect format - needs correction (doesn't use worker tools)
      {
        weight: 0.5,
        text: 'I think we should implement this feature using TypeScript. It would provide better type safety and maintainability.'
      },
      {
        weight: 0.5,
        text: 'This approach looks good. I\'m considering the best way to structure the code for optimal performance.'
      },
      {
        weight: 0.3,
        text: 'I\'ve reviewed the requirements. There are some edge cases to consider before proceeding with implementation.'
      },
    ];

    const workerResponses = [
      {
        weight: 3,
        text: 'I\'ve implemented the requested feature. Here\'s what I did:\n\n1. Created the main function\n2. Added error handling\n3. Wrote unit tests\n\nAll tests are passing and the implementation is ready.'
      },
      {
        weight: 3,
        text: 'Implementation complete! I\'ve added the functionality with the following approach:\n\n```typescript\nfunction processData(input: string): Result {\n  // Validation\n  if (!input) throw new Error(\'Invalid input\');\n  \n  // Processing logic\n  const result = transform(input);\n  return result;\n}\n```\n\nThe code is tested and working correctly.'
      },
      {
        weight: 2,
        text: 'Task completed successfully. I\'ve:\n- Implemented the core functionality\n- Added comprehensive error handling\n- Written test cases\n- Verified all edge cases work as expected\n\nThe feature is ready for use.'
      },
      {
        weight: 2,
        text: 'Done! The implementation is complete. I\'ve tested it with various inputs including edge cases, and everything works as expected. The code follows best practices and includes proper documentation.'
      },
      {
        weight: 2,
        text: 'Feature implemented and tested. Here\'s a summary:\n\n**Changes made:**\n- Added new module with requested functionality\n- Integrated with existing codebase\n- Added validation and error handling\n\n**Testing:**\n- Unit tests: ✓ Passing\n- Integration tests: ✓ Passing\n- Edge cases: ✓ Handled\n\nReady for review!'
      },
      {
        weight: 1,
        text: 'Implementation finished! I\'ve created a clean, efficient solution that handles all the requirements. The code is well-documented and includes error handling for common failure scenarios.'
      },
      {
        weight: 1,
        text: 'All set! I\'ve completed the implementation with:\n- Clean, maintainable code\n- Proper type safety\n- Comprehensive test coverage\n- Documentation\n\nThe feature is working correctly.'
      },
    ];

    const responses = isWorker ? workerResponses : instructorResponses;

    // Weighted random selection
    const totalWeight = responses.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;

    let selectedResponse = responses[0];
    for (const response of responses) {
      random -= response.weight;
      if (random <= 0) {
        selectedResponse = response;
        break;
      }
    }

    const content: Anthropic.ContentBlock[] = [];

    // Add thinking if requested
    if (useThinking) {
      content.push({
        type: 'thinking',
        thinking: 'Mock thinking: Analyzing the task requirements and determining the best approach. Considering which tools to use and how to delegate work to Worker effectively.',
      } as any);
    }

    // Add text content
    content.push({
      type: 'text',
      text: selectedResponse.text,
      citations: [],
    });

    // Add tool use if specified
    if ((selectedResponse as any).useTool && (selectedResponse as any).toolName) {
      const toolName = (selectedResponse as any).toolName;
      const toolId = 'toolu_mock_' + Date.now() + Math.random().toString(36).substring(7);

      let toolInput: any = {};
      if (toolName === 'call_worker') {
        toolInput = {
          system_prompt: 'You are a skilled developer. Implement the requested feature with clean, well-tested code.',
          instruction: 'Please implement the feature as discussed.',
          model: 'sonnet',
        };
      } else if (toolName === 'call_worker_with_file') {
        toolInput = {
          system_prompt_file: '/tmp/system_prompt.txt',
          instruction: 'Please implement the feature using the context provided.',
          model: 'sonnet',
        };
      } else if (toolName === 'tell_worker') {
        toolInput = {
          message: 'Continue with the implementation. Focus on edge cases and error handling.',
          model: 'sonnet',
        };
      }

      content.push({
        type: 'tool_use',
        id: toolId,
        name: toolName,
        input: toolInput,
      } as any);
    }

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
    console.log('[DEBUG] streamMockResponse called, context:', context);
    const response = this.generateMockResponse(model, useThinking, context);
    console.log('[DEBUG] Generated mock response with', response.content.length, 'content blocks');

    // Simulate streaming delay
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (const block of response.content) {
      console.log('[DEBUG] Processing block type:', block.type);
      if (block.type === 'thinking' && onChunk) {
        const thinking = (block as any).thinking || '';
        console.log('[DEBUG] Streaming thinking, length:', thinking.length);
        // Stream thinking in chunks
        for (let i = 0; i < thinking.length; i += 15) {
          await delay(20);
          onChunk(thinking.slice(i, i + 15), 'thinking');
        }
      } else if (block.type === 'text' && onChunk) {
        const text = block.text;
        console.log('[DEBUG] Streaming text, length:', text.length);
        // Stream text in chunks
        for (let i = 0; i < text.length; i += 8) {
          await delay(30);
          onChunk(text.slice(i, i + 8), 'text');
        }
      } else if (block.type === 'tool_use') {
        // Tool use blocks appear instantly (not streamed character by character)
        console.log('[DEBUG] Found tool_use block:', (block as any).name);
        await delay(50);
      }
    }

    console.log('[DEBUG] streamMockResponse completed');
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
      console.log('[DEBUG MODE] Context:', context);
      console.log('[DEBUG MODE] Model:', model);
      console.log('[DEBUG MODE] System prompt length:', systemPrompt.length);
      console.log('[DEBUG MODE] Messages count:', messages.length);
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
