import Anthropic from '@anthropic-ai/sdk';

/**
 * Manages model name mappings from short names to full model IDs
 * Fetches available models from Anthropic API on initialization
 */
export class ModelManager {
  private modelMap: Map<string, string> = new Map();
  private fallbackMap: Map<string, string> = new Map([
    ['opus', 'claude-opus-4-1-20250805'],
    ['sonnet', 'claude-sonnet-4-5-20250929'],
    ['haiku', 'claude-haiku-4-5-20251001'],
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

        // Match models by ID pattern (most recent first in API response)
        if (!latestOpus && id.includes('opus')) {
          latestOpus = id;
          this.modelMap.set('opus', id);
        }
        if (!latestSonnet && id.includes('sonnet')) {
          latestSonnet = id;
          this.modelMap.set('sonnet', id);
        }
        if (!latestHaiku && id.includes('haiku')) {
          latestHaiku = id;
          this.modelMap.set('haiku', id);
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
    // If it's already a full model ID, return as-is
    if (modelName.startsWith('claude-')) {
      return modelName;
    }

    // Try to resolve from fetched mapping
    const resolved = this.modelMap.get(modelName.toLowerCase());
    if (resolved) {
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
