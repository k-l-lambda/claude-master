/**
 * Claude Client Adapter
 *
 * Adapts ClaudeClient to implement the AIClient interface while maintaining
 * backward compatibility with existing code.
 */

import {
  AIClient,
  AIMessage,
  SendMessageParams,
  StreamMessageParams,
  ProviderInfo,
  ContentBlock as AIContentBlock,
} from './ai-client/types.js';
import { ClaudeClient } from './client.js';
import { Config } from './types.js';
import Anthropic from '@anthropic-ai/sdk';

export class ClaudeClientAdapter implements AIClient {
  private claudeClient: ClaudeClient;

  constructor(config: Config) {
    this.claudeClient = new ClaudeClient(config);
  }

  /**
   * Get the underlying Claude client for backward compatibility
   */
  getClient(): Anthropic {
    return this.claudeClient.getClient();
  }

  /**
   * Send message using unified AIClient interface
   */
  async sendMessage(params: SendMessageParams): Promise<AIMessage> {
    const messages = params.messages.map(m => ({
      role: m.role,
      content: m.content as any,
    }));

    const response = await this.claudeClient.sendMessage(
      messages,
      params.model,
      params.systemPrompt || '',
      params.tools,
      params.options?.useThinking || false
    );

    return this.convertToAIMessage(response);
  }

  /**
   * Stream message using unified AIClient interface
   */
  async streamMessage(params: StreamMessageParams): Promise<AIMessage> {
    const messages = params.messages.map(m => ({
      role: m.role,
      content: m.content as any,
    }));

    const response = await this.claudeClient.streamMessage(
      messages,
      params.model,
      params.systemPrompt || '',
      params.tools,
      params.options?.useThinking || false,
      (chunk, type) => {
        if (type === 'thinking' && params.onThinkingChunk) {
          params.onThinkingChunk(chunk);
        } else if (type === 'text' && params.onTextChunk) {
          params.onTextChunk(chunk);
        }
      },
      params.abortSignal,
      params.context
    );

    return this.convertToAIMessage(response);
  }

  /**
   * Get provider information
   */
  getProviderInfo(): ProviderInfo {
    return {
      name: 'claude',
      version: '1.0.0',
      capabilities: {
        supportsThinking: true,
        supportsToolCalling: true,
        supportsStreaming: true,
        supportsVision: true,
        maxTokens: 8192,
        contextWindow: 200000,
      },
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Convert Anthropic message to unified AIMessage format
   */
  private convertToAIMessage(anthropicMsg: Anthropic.Message): AIMessage {
    return {
      id: anthropicMsg.id,
      role: 'assistant',
      content: this.convertContentBlocks(anthropicMsg.content),
      model: anthropicMsg.model,
      stopReason: anthropicMsg.stop_reason,
      usage: {
        inputTokens: anthropicMsg.usage.input_tokens,
        outputTokens: anthropicMsg.usage.output_tokens,
        totalTokens: anthropicMsg.usage.input_tokens + anthropicMsg.usage.output_tokens,
      },
    };
  }

  /**
   * Convert Anthropic content blocks to unified format
   */
  private convertContentBlocks(content: Anthropic.ContentBlock[]): AIContentBlock[] {
    return content.map(block => {
      switch (block.type) {
        case 'text':
          return { type: 'text', text: block.text };
        case 'thinking':
          return { type: 'thinking', thinking: (block as any).thinking };
        case 'tool_use':
          return {
            type: 'tool_use',
            toolUse: {
              id: block.id,
              name: block.name,
              input: block.input as Record<string, any>,
            },
          };
        default:
          return { type: 'text', text: '' };
      }
    });
  }
}
