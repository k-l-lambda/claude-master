/**
 * Qwen Client
 *
 * Client for Qwen API using OpenAI-compatible interface
 */

import OpenAI from 'openai';
import {
  AIClient,
  AIMessage,
  SendMessageParams,
  StreamMessageParams,
  ProviderInfo,
  ContentBlock as AIContentBlock,
} from './ai-client/types.js';
import { Config, Tool } from './types.js';
import { loadCredentials, checkExistingCredentials } from '../tests/qwen-oauth-helper.mjs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Helper function to format OAuth resource URL to proper endpoint
 */
function formatOAuthEndpoint(resourceUrl: string): string {
  if (!resourceUrl) return '';

  const suffix = '/v1';
  // Normalize the URL: add protocol if missing, ensure /v1 suffix
  const normalizedUrl = resourceUrl.startsWith('http')
    ? resourceUrl
    : `https://${resourceUrl}`;

  return normalizedUrl.endsWith(suffix)
    ? normalizedUrl
    : `${normalizedUrl}${suffix}`;
}

export class QwenClient implements AIClient {
  private client: OpenAI;
  private config: Config;

  constructor(config: Config) {
    this.config = config;

    // Try to load OAuth credentials first (synchronous check)
    let oauthCreds: any = null;
    try {
      const credFile = path.join(os.homedir(), '.qwen', 'oauth_creds.json');
      if (fs.existsSync(credFile)) {
        const credData = fs.readFileSync(credFile, 'utf-8');
        oauthCreds = JSON.parse(credData);

        // Check if token is expired
        if (oauthCreds.expiry_date && Date.now() >= oauthCreds.expiry_date) {
          console.warn('[QwenClient] OAuth token expired');
          oauthCreds = null;
        }
      }
    } catch (error: any) {
      console.warn('[QwenClient] Failed to load OAuth credentials:', error.message);
    }

    // Initialize client with API key or OAuth credentials
    // Priority: qwen-specific > general API key > environment variables > OAuth
    const apiKey = config.qwenApiKey
      || config.apiKey  // Use general API key if qwen-specific not set
      || process.env.QWEN_API_KEY
      || process.env.OPENAI_API_KEY
      || oauthCreds?.access_token;  // Fall back to OAuth token

    // For base URL, prioritize Qwen-specific settings over general settings
    // DO NOT use config.baseURL (which is for Anthropic) for Qwen
    const baseURL = config.qwenBaseUrl
      || process.env.QWEN_BASE_URL
      || process.env.OPENAI_BASE_URL
      || (oauthCreds?.resource_url ? formatOAuthEndpoint(oauthCreds.resource_url) : null)
      || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

    if (!apiKey) {
      console.error('[QwenClient] ERROR: No API key or OAuth credentials found!');
      console.error('');
      console.error('You have two options:');
      console.error('');
      console.error('Option 1: Use OAuth (Recommended - Free access)');
      console.error('  Run: node tests/qwen-oauth-helper.mjs');
      console.error('');
      console.error('Option 2: Use API Key');
      console.error('  Set QWEN_API_KEY or OPENAI_API_KEY environment variable');
      console.error('  Or use --qwen-api-key command line option');
    }

    this.client = new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL: baseURL,
    });
  }

  /**
   * Send message (non-streaming)
   */
  async sendMessage(params: SendMessageParams): Promise<AIMessage> {
    const messages = this.convertMessages(params.messages, params.systemPrompt);

    const response = await this.client.chat.completions.create({
      model: params.model,
      messages: messages,
      tools: params.tools ? this.convertTools(params.tools) : undefined,
      temperature: params.options?.temperature || 0,
      max_tokens: params.options?.maxTokens || 8192,
    });

    return this.convertToAIMessage(response);
  }

  /**
   * Send message with streaming
   */
  async streamMessage(params: StreamMessageParams): Promise<AIMessage> {
    const messages = this.convertMessages(params.messages, params.systemPrompt);

    const stream = await this.client.chat.completions.create({
      model: params.model,
      messages: messages,
      tools: params.tools ? this.convertTools(params.tools) : undefined,
      temperature: params.options?.temperature || 0,
      max_tokens: params.options?.maxTokens || 8192,
      stream: true,
    });

    const contentBlocks: AIContentBlock[] = [];
    let currentText = '';
    let currentToolCalls: Array<OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall> = [];
    let usage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };

    for await (const chunk of stream) {
      if (params.abortSignal?.aborted) {
        break;
      }

      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta;

      // Handle text content
      if (delta.content) {
        currentText += delta.content;
        if (params.onTextChunk) {
          params.onTextChunk(delta.content);
        }
      }

      // Handle tool calls
      if (delta.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          const index = toolCall.index;
          if (!currentToolCalls[index]) {
            currentToolCalls[index] = {
              index,
              id: toolCall.id || '',
              type: 'function',
              function: { name: '', arguments: '' },
            };
          }

          if (toolCall.function?.name) {
            currentToolCalls[index].function!.name = toolCall.function.name;
          }
          if (toolCall.function?.arguments) {
            currentToolCalls[index].function!.arguments += toolCall.function.arguments;
          }
        }
      }
    }

    // Add text content block if any
    if (currentText) {
      contentBlocks.push({
        type: 'text',
        text: currentText,
      });
    }

    // Add tool use blocks
    for (const toolCall of currentToolCalls) {
      if (toolCall && toolCall.function) {
        try {
          const input = JSON.parse(toolCall.function.arguments || '{}');
          contentBlocks.push({
            type: 'tool_use',
            toolUse: {
              id: toolCall.id || '',
              name: toolCall.function.name || '',
              input: input,
            },
          });
        } catch (e) {
          console.error('Failed to parse tool arguments:', e);
        }
      }
    }

    return {
      id: 'qwen-' + Date.now(),
      role: 'assistant',
      content: contentBlocks,
      model: params.model,
      stopReason: 'end_turn',
      usage,
    };
  }

  /**
   * Get provider information
   */
  getProviderInfo(): ProviderInfo {
    return {
      name: 'qwen',
      version: '1.0.0',
      capabilities: {
        supportsThinking: false,  // Qwen doesn't have thinking feature
        supportsToolCalling: true,
        supportsStreaming: true,
        supportsVision: true,
        maxTokens: 8192,
        contextWindow: 32000,
      },
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Convert unified messages to OpenAI format
   */
  private convertMessages(
    messages: import('./ai-client/types.js').Message[],
    systemPrompt?: string
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const result: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // Add system prompt as first message
    if (systemPrompt) {
      result.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // Convert messages
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        result.push({
          role: msg.role,
          content: msg.content,
        });
      } else {
        // Handle complex content (with blocks)
        const textParts: string[] = [];
        const toolResults: AIContentBlock[] = [];

        for (const block of msg.content) {
          if (block.type === 'text' && block.text) {
            textParts.push(block.text);
          } else if (block.type === 'tool_result') {
            toolResults.push(block);
          }
        }

        // Add text message if any
        if (textParts.length > 0) {
          result.push({
            role: msg.role,
            content: textParts.join('\n'),
          });
        }

        // Add tool result messages
        for (const toolResult of toolResults) {
          if (toolResult.toolResult) {
            result.push({
              role: 'tool',
              tool_call_id: toolResult.toolResult.toolUseId,
              content: toolResult.toolResult.content,
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Convert unified tools to OpenAI format
   */
  private convertTools(tools: Tool[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  /**
   * Convert OpenAI response to unified AIMessage format
   */
  private convertToAIMessage(response: OpenAI.Chat.ChatCompletion): AIMessage {
    const choice = response.choices[0];
    const content: AIContentBlock[] = [];

    // Add text content
    if (choice.message.content) {
      content.push({
        type: 'text',
        text: choice.message.content,
      });
    }

    // Add tool calls
    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: 'tool_use',
          toolUse: {
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments),
          },
        });
      }
    }

    return {
      id: response.id,
      role: 'assistant',
      content,
      model: response.model,
      stopReason: choice.finish_reason,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }
}
