import { Message } from './types.js';

/**
 * Simple token estimator
 * Uses a rough heuristic: ~4 characters per token for text
 * More accurate counting would require the tiktoken library
 */
export class TokenCounter {
  /**
   * Estimate tokens in a string
   */
  static estimateTokens(text: string): number {
    // Rough estimate: 4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate tokens in message content
   */
  static estimateContentTokens(content: string | any[]): number {
    if (typeof content === 'string') {
      return this.estimateTokens(content);
    }

    let total = 0;
    for (const block of content) {
      if (block.type === 'text') {
        total += this.estimateTokens(block.text);
      } else if (block.type === 'thinking') {
        total += this.estimateTokens(block.thinking);
      } else if (block.type === 'tool_use') {
        total += this.estimateTokens(JSON.stringify(block.input));
      } else if (block.type === 'tool_result') {
        // Handle tool_result blocks (from user messages)
        if (typeof block.content === 'string') {
          total += this.estimateTokens(block.content);
        } else if (Array.isArray(block.content)) {
          for (const item of block.content) {
            if (item.type === 'text') {
              total += this.estimateTokens(item.text);
            } else if (item.type === 'image') {
              // Images consume significant tokens, rough estimate
              total += 1000;
            }
          }
        }
      }
    }
    return total;
  }

  /**
   * Calculate total tokens in conversation history
   */
  static countConversationTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
      // Role overhead (~5 tokens per message)
      total += 5;
      total += this.estimateContentTokens(msg.content);
    }
    return total;
  }

  /**
   * Check if conversation is approaching token limit
   * @param messages Conversation messages
   * @param limit Token limit (default: 200000 for Claude)
   * @param threshold Warning threshold percentage (default: 0.25 = 25%)
   */
  static shouldCompact(
    messages: Message[],
    limit: number = 200000,
    threshold: number = 0.25
  ): boolean {
    const tokens = this.countConversationTokens(messages);
    return tokens >= limit * threshold;
  }

  /**
   * Get formatted token usage string
   */
  static formatTokenUsage(messages: Message[], limit: number = 200000): string {
    const tokens = this.countConversationTokens(messages);
    const percentage = Math.round((tokens / limit) * 100);
    return `${tokens.toLocaleString()} / ${limit.toLocaleString()} tokens (${percentage}%)`;
  }
}
