/**
 * Unified AI Client Interface
 *
 * This module defines a unified interface for different AI providers (Claude, Qwen, etc.)
 * to enable seamless provider switching and multi-provider support in the orchestrator.
 */

/**
 * Unified AI Client Interface
 * All AI providers must implement this interface
 */
export interface AIClient {
  /**
   * Send a message and wait for complete response
   */
  sendMessage(params: SendMessageParams): Promise<AIMessage>;

  /**
   * Send a message with streaming response
   */
  streamMessage(params: StreamMessageParams): Promise<AIMessage>;

  /**
   * Get provider information and capabilities
   */
  getProviderInfo(): ProviderInfo;
}

/**
 * Parameters for sending a message
 */
export interface SendMessageParams {
  messages: Message[];
  model: string;
  systemPrompt?: string;
  tools?: Tool[];
  options?: MessageOptions;
}

/**
 * Parameters for streaming a message
 */
export interface StreamMessageParams extends SendMessageParams {
  onThinkingChunk?: (chunk: string) => void;
  onTextChunk?: (chunk: string) => void;
  abortSignal?: AbortSignal;
  context?: 'instructor' | 'worker';
}

/**
 * Message options
 */
export interface MessageOptions {
  useThinking?: boolean;
  thinkingBudget?: number;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Unified AI message response
 */
export interface AIMessage {
  id: string;
  role: 'assistant';
  content: ContentBlock[];
  model: string;
  stopReason: string | null;
  usage: TokenUsage;
  metadata?: Record<string, any>;
}

/**
 * Content block types
 */
export interface ContentBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  text?: string;
  thinking?: string;
  toolUse?: ToolUse;
  toolResult?: ToolResult;
}

/**
 * Tool use block
 */
export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, any>;
}

/**
 * Tool result block
 */
export interface ToolResult {
  toolUseId: string;
  content: string;
  isError?: boolean;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Provider information
 */
export interface ProviderInfo {
  name: string;
  version: string;
  capabilities: ProviderCapabilities;
}

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  supportsThinking: boolean;
  supportsToolCalling: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  maxTokens: number;
  contextWindow: number;
}

/**
 * Message types (compatible with existing codebase)
 */
export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

/**
 * Tool definition (compatible with Anthropic format)
 */
export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Chunk type for streaming
 */
export type ChunkType = 'thinking' | 'text' | 'tool_use';
