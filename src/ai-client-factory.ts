/**
 * AI Client Factory
 *
 * Creates AIClient instances based on model name (auto-detects provider)
 */

import { AIClient } from './ai-client/types.js';
import { ClaudeClientAdapter } from './claude-client-adapter.js';
import { QwenClient } from './qwen-client.js';
import { Config } from './types.js';
import { ModelManager } from './model-manager.js';

export class AIClientFactory {
  /**
   * Create an AIClient instance based on model name
   * Automatically detects provider from model name
   *
   * @param config - Configuration object
   * @param modelName - Model name (e.g., 'qwen', 'sonnet', 'qwen-max', 'claude-sonnet-4-5-20250929')
   * @param modelManager - ModelManager instance for provider detection
   * @returns AIClient instance
   */
  static createClient(
    config: Config,
    modelName: string,
    modelManager: ModelManager
  ): AIClient {
    // Detect provider from model name
    const provider = modelManager.detectProvider(modelName);

    console.log(`[AIClientFactory] Model "${modelName}" -> Provider: ${provider}`);

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
}
