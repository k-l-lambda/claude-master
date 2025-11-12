/**
 * Tool Converter Interface
 *
 * Provides interfaces for converting tools and messages between
 * unified format and provider-specific formats.
 */

import { Tool, Message } from './types.js';

/**
 * Tool Converter Interface
 * Converts tools between unified format and provider-specific format
 */
export interface ToolConverter {
  /**
   * Convert tools from unified format to provider-specific format
   */
  toProviderFormat(tools: Tool[]): any[];

  /**
   * Convert tools from provider-specific format to unified format
   */
  fromProviderFormat(tools: any[]): Tool[];
}

/**
 * Message Converter Interface
 * Converts messages between unified format and provider-specific format
 */
export interface MessageConverter {
  /**
   * Convert messages from unified format to provider-specific format
   */
  toProviderFormat(messages: Message[], systemPrompt?: string): any[];

  /**
   * Convert messages from provider-specific format to unified format
   */
  fromProviderFormat(messages: any[]): Message[];
}
