import { globalStorage } from './globalStorage';

export type FeatureConfig = {
  floatingTelescopeEnabled: boolean;
  selectionTelescopeEnabled: boolean;
  writerTelescopeEnabled: boolean;
};

/**
 * Get feature configuration from storage
 * Defaults to enabled if not set
 */
export async function getFeatureConfig(): Promise<FeatureConfig> {
  try {
    const config = await globalStorage().get('config');
    if (config && typeof config === 'object') {
      const typedConfig = config as any;
      return {
        floatingTelescopeEnabled: typedConfig.floatingTelescopeEnabled ?? true,
        selectionTelescopeEnabled:
          typedConfig.selectionTelescopeEnabled ?? true,
        writerTelescopeEnabled: typedConfig.writerTelescopeEnabled ?? true,
      };
    }
  } catch (error) {
    console.error('Error loading feature config:', error);
  }
  // Default to enabled
  return {
    floatingTelescopeEnabled: true,
    selectionTelescopeEnabled: true,
    writerTelescopeEnabled: true,
  };
}
