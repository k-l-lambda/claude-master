import Anthropic from '@anthropic-ai/sdk';

/**
 * Manages model name mappings from short names to full model IDs
 * Fetches available models from Anthropic API on initialization
 */
export class ModelManager {
  private modelMap: Map<string, string> = new Map();
  private fallbackMap: Map<string, string> = new Map([
    // Claude models
    ['opus', 'claude-opus-4-1-20250805'],
    ['sonnet', 'claude-sonnet-4-5-20250929'],
    ['haiku', 'claude-haiku-4-5-20251001'],

    // Qwen models
    // Note: Model names depend on the endpoint:
    // - OAuth (portal.qwen.ai): use 'coder-model'
    // - ModelScope (api-inference.modelscope.cn): use 'Qwen/Qwen2.5-Coder-32B-Instruct' format
    // - DashScope (dashscope.aliyuncs.com): use 'qwen-max', 'qwen-plus', 'qwen-turbo'
    ['qwen', 'coder-model'],  // For OAuth (default, recommended)
    ['qwen-max', 'qwen-max'],  // DashScope format
    ['qwen-plus', 'qwen-plus'],  // DashScope format
    ['qwen-turbo', 'qwen-turbo'],  // DashScope format
    ['coder-model', 'coder-model'],  // For OAuth
  ]);
  private initialized: boolean = false;

  /**
   * Initialize by fetching available models from API
   */
  async initialize(client: Anthropic): Promise<void> {
    try {
      console.log('[ModelManager] Fetching available models from API...');
      const models = client.models.list();

      // Find the latest model for each type
      let latestOpus: string | null = null;
      let latestSonnet: string | null = null;
      let latestHaiku: string | null = null;

      for await (const model of models) {
        const id = model.id;
        console.log('[ModelManager] Found model:', id, '-', model.display_name);

        // Match models by specific ID patterns (prioritize latest versions)
        // For Haiku: match haiku-4-5 > 3-5-haiku > 3-haiku
        if (!latestHaiku && (
          id.startsWith('claude-haiku-4-5') ||
          id.startsWith('claude-3-5-haiku') ||
          id.startsWith('claude-3-haiku')
        )) {
          latestHaiku = id;
          this.modelMap.set('haiku', id);
        }

        // For Sonnet: match sonnet-4-5 > sonnet-4 > 3-7-sonnet > 3-5-sonnet
        if (!latestSonnet && (
          id.startsWith('claude-sonnet-4-5') ||
          id.startsWith('claude-sonnet-4') ||
          id.startsWith('claude-3-7-sonnet') ||
          id.startsWith('claude-3-5-sonnet')
        )) {
          latestSonnet = id;
          this.modelMap.set('sonnet', id);
        }

        // For Opus: match opus-4-1 > opus-4
        if (!latestOpus && (
          id.startsWith('claude-opus-4-1') ||
          id.startsWith('claude-opus-4')
        )) {
          latestOpus = id;
          this.modelMap.set('opus', id);
        }

        // Stop if we found all three
        if (latestOpus && latestSonnet && latestHaiku) {
          break;
        }
      }

      console.log('[ModelManager] Model mapping:');
      console.log('  opus   ->', this.modelMap.get('opus') || 'NOT FOUND');
      console.log('  sonnet ->', this.modelMap.get('sonnet') || 'NOT FOUND');
      console.log('  haiku  ->', this.modelMap.get('haiku') || 'NOT FOUND');

      // Add Qwen models from fallback (since they're not in Anthropic API)
      this.modelMap.set('qwen', this.fallbackMap.get('qwen')!);
      this.modelMap.set('qwen-max', this.fallbackMap.get('qwen-max')!);
      this.modelMap.set('qwen-plus', this.fallbackMap.get('qwen-plus')!);
      this.modelMap.set('qwen-turbo', this.fallbackMap.get('qwen-turbo')!);
      this.modelMap.set('coder-model', this.fallbackMap.get('coder-model')!);

      console.log('  qwen   ->', this.modelMap.get('qwen'));
      console.log('  qwen-max ->', this.modelMap.get('qwen-max'));

      this.initialized = true;
    } catch (error) {
      console.warn('[ModelManager] Failed to fetch models from API, using fallback mapping');
      console.warn('[ModelManager] Error:', error instanceof Error ? error.message : String(error));

      // Use fallback mapping
      this.modelMap = new Map(this.fallbackMap);
      this.initialized = true;
    }
  }

  /**
   * Resolve a model name (short or full ID) to full model ID
   */
  resolve(modelName: string): string {
    // If it's already a full Claude model ID, return as-is
    if (modelName.startsWith('claude-')) {
      return modelName;
    }

    // If it's a full Qwen model ID (contains slash), return as-is
    // Note: Do NOT return early for simple "qwen" - it needs mapping!
    if (modelName.includes('/') || modelName.startsWith('Qwen/')) {
      return modelName;
    }

    // Try to resolve from fetched mapping (includes both Claude and Qwen)
    const resolved = this.modelMap.get(modelName.toLowerCase());
    if (resolved) {
      console.log(`[ModelManager] Resolved "${modelName}" → "${resolved}" from modelMap`);
      return resolved;
    }

    // Try fallback mapping
    const fallback = this.fallbackMap.get(modelName.toLowerCase());
    if (fallback) {
      console.warn(`[ModelManager] Using fallback for model "${modelName}": ${fallback}`);
      return fallback;
    }

    // Return as-is if not found
    console.warn(`[ModelManager] Unknown model name "${modelName}", using as-is`);
    return modelName;
  }

  /**
   * Detect which provider a model belongs to based on its name
   */
  detectProvider(modelName: string): 'claude' | 'qwen' {
    const resolved = this.resolve(modelName);

    // Check if it's a Qwen model
    if (this.isQwenModel(resolved)) {
      return 'qwen';
    }

    // Check if it's a Claude model
    if (resolved.startsWith('claude-')) {
      return 'claude';
    }

    // Default to Claude for unknown models
    return 'claude';
  }

  /**
   * Check if a model name is a Qwen model
   */
  private isQwenModel(modelName: string): boolean {
    const lowerName = modelName.toLowerCase();
    return (
      lowerName.includes('qwen') ||
      lowerName === 'coder-model' ||
      lowerName.startsWith('qwen-') ||
      lowerName.startsWith('qwen/') ||
      lowerName.includes('/qwen')
    );
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get all available model mappings
   */
  getAllMappings(): Map<string, string> {
    return new Map(this.modelMap);
  }
}
