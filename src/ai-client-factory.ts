/**
 * AI Client Factory
 *
 * Creates AIClient instances based on provider configuration
 */

import { AIClient } from './ai-client/types.js';
import { ClaudeClientAdapter } from './claude-client-adapter.js';
import { QwenClient } from './qwen-client.js';
import { Config } from './types.js';

export class AIClientFactory {
  /**
   * Create an AIClient instance based on provider configuration
   *
   * @param config - Configuration object
   * @param role - Role of the client (instructor or worker)
   * @returns AIClient instance
   */
  static createClient(config: Config, role: 'instructor' | 'worker'): AIClient {
    // Determine provider: role-specific > general > default (claude)
    let provider: 'claude' | 'qwen';

    if (role === 'instructor' && config.instructorProvider) {
      provider = config.instructorProvider;
    } else if (role === 'worker' && config.workerProvider) {
      provider = config.workerProvider;
    } else if (config.provider) {
      provider = config.provider;
    } else {
      provider = 'claude'; // Default
    }

    switch (provider) {
      case 'claude':
        return new ClaudeClientAdapter(config);
      case 'qwen':
        return new QwenClient(config);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Check if provider is available (has required credentials)
   */
  static isProviderAvailable(provider: 'claude' | 'qwen', config: Config): boolean {
    switch (provider) {
      case 'claude':
        return !!(config.authToken || config.apiKey || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY);
      case 'qwen':
        return !!(config.qwenApiKey || process.env.QWEN_API_KEY || process.env.OPENAI_API_KEY);
      default:
        return false;
    }
  }

  /**
   * Get provider name for a role
   */
  static getProviderForRole(config: Config, role: 'instructor' | 'worker'): 'claude' | 'qwen' {
    if (role === 'instructor' && config.instructorProvider) {
      return config.instructorProvider;
    } else if (role === 'worker' && config.workerProvider) {
      return config.workerProvider;
    } else if (config.provider) {
      return config.provider;
    } else {
      return 'claude'; // Default
    }
  }
}
