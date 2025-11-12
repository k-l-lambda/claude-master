/**
 * Claude Tool Converter
 *
 * Converts tools between unified format and Claude (Anthropic) format
 */

import { Tool } from '../types.js';
import { ToolConverter, MessageConverter } from './tool-converter.js';
import type { Message } from './types.js';
import Anthropic from '@anthropic-ai/sdk';

export class ClaudeToolConverter implements ToolConverter {
  /**
   * Convert tools from unified format to Claude format
   * Since our unified format is based on Anthropic's format, no conversion needed
   */
  toProviderFormat(tools: Tool[]): Anthropic.Tool[] {
    return tools as Anthropic.Tool[];
  }

  /**
   * Convert tools from Claude format to unified format
   */
  fromProviderFormat(tools: Anthropic.Tool[]): Tool[] {
    return tools as Tool[];
  }
}

export class ClaudeMessageConverter implements MessageConverter {
  /**
   * Convert messages from unified format to Claude format
   */
  toProviderFormat(messages: Message[], systemPrompt?: string): Anthropic.MessageParam[] {
    return messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content,
    }));
  }

  /**
   * Convert messages from Claude format to unified format
   */
  fromProviderFormat(messages: Anthropic.MessageParam[]): Message[] {
    return messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
  }
}
