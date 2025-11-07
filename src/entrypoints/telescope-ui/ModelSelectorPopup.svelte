<script lang="ts">
  import { multiModelStore, AVAILABLE_MODELS, type ModelConfig } from '@/lib/multiModelStore';
  import { globalStorage } from '@/lib/globalStorage';
  import CloseIcon from './icons/Close.svelte';

  let {
    anchorEl,
    onClose,
  }: {
    anchorEl: HTMLElement | null;
    onClose?: () => void;
  } = $props();

  let enabledModels = $state<string[]>([]);
  let popupElement = $state<HTMLDivElement | null>(null);

  const storage = globalStorage();

  // Load saved enabled models
  $effect(() => {
    (async () => {
      try {
        const saved = await storage.get('enabledModels');
        if (saved && Array.isArray(saved)) {
          enabledModels = saved;
        } else {
          // Default to all models
          enabledModels = AVAILABLE_MODELS.map((m) => m.id);
        }
      } catch (error) {
        console.error('Failed to load enabled models:', error);
        enabledModels = AVAILABLE_MODELS.map((m) => m.id);
      }
    })();
  });

  function toggleModel(modelId: string) {
    if (enabledModels.includes(modelId)) {
      enabledModels = enabledModels.filter((id) => id !== modelId);
    } else {
      enabledModels = [...enabledModels, modelId];
    }
  }

  async function handleSave() {
    try {
      await storage.set('enabledModels', enabledModels);
      // Update the store's enabled models
      multiModelStore.setEnabledModels(enabledModels);
      onClose?.();
    } catch (error) {
      console.error('Failed to save enabled models:', error);
    }
  }

  function handleClose() {
    onClose?.();
  }

  function getModelConfig(modelId: string): ModelConfig | undefined {
    return AVAILABLE_MODELS.find((m) => m.id === modelId);
  }

  function getProviderModels(provider: 'openai' | 'gemini'): ModelConfig[] {
    return AVAILABLE_MODELS.filter((m) => m.provider === provider);
  }

  // Position popup relative to anchor (above the button, ensuring it stays within viewport)
  $effect(() => {
    if (!popupElement || !anchorEl) return;

    const updatePosition = () => {
      if (!popupElement || !anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const padding = 16; // Minimum padding from viewport edges

      // Get actual popup dimensions
      const popupHeight = popupElement.offsetHeight || 400;
      const popupWidth = popupElement.offsetWidth || 320;

      const spaceAbove = rect.top;
      const spaceBelow = viewportHeight - rect.bottom;

      let topPosition: number;
      let maxHeight: string;

      // Always try to position above first
      if (spaceAbove >= popupHeight + padding || spaceAbove > spaceBelow) {
        // Position above the button
        topPosition = rect.top - popupHeight - 8;

        // Ensure it doesn't go off-screen at the top
        if (topPosition < padding) {
          topPosition = padding;
          // Adjust max-height to fit available space
          const availableHeight = rect.top - padding - 8;
          maxHeight = `${Math.max(200, availableHeight)}px`;
        } else {
          maxHeight = '80vh';
        }
      } else {
        // Not enough space above, position below
        topPosition = rect.bottom + 8;

        // Ensure it doesn't go off-screen at the bottom
        const maxBottom = viewportHeight - padding;
        const popupBottom = topPosition + popupHeight;
        if (popupBottom > maxBottom) {
          // Adjust max-height to fit available space
          const availableHeight = maxBottom - topPosition;
          maxHeight = `${Math.max(200, availableHeight)}px`;
        } else {
          maxHeight = '80vh';
        }
      }

      // Handle horizontal positioning
      let leftPosition = rect.left;
      const popupRight = leftPosition + popupWidth;

      // Ensure it doesn't go off-screen on the right
      if (popupRight > viewportWidth - padding) {
        leftPosition = viewportWidth - popupWidth - padding;
      }

      // Ensure it doesn't go off-screen on the left
      if (leftPosition < padding) {
        leftPosition = padding;
      }

      popupElement.style.top = `${topPosition}px`;
      popupElement.style.left = `${leftPosition}px`;
      popupElement.style.maxHeight = maxHeight;
      popupElement.style.bottom = 'auto';
    };

    // Wait for popup to render, then position it
    const timeoutId = setTimeout(() => {
      updatePosition();
      // Update again after a short delay to ensure accurate height calculation
      setTimeout(updatePosition, 10);
    }, 0);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  });
</script>

<div
  class="model-selector-popup"
  bind:this={popupElement}
  role="dialog"
  aria-label="Select AI Models"
>
  <div class="popup-header">
    <h3 class="popup-title">Select AI Models</h3>
    <button
      class="close-button"
      onclick={handleClose}
      title="Close"
      aria-label="Close"
    >
      <CloseIcon />
    </button>
  </div>

  <div class="popup-content">
    <div class="provider-section">
      <h4 class="provider-title">OpenAI Models</h4>
      <div class="model-list">
        {#each getProviderModels('openai') as model}
          <label class="model-item">
            <input
              type="checkbox"
              checked={enabledModels.includes(model.id)}
              onchange={() => toggleModel(model.id)}
            />
            <span class="model-name">{model.name}</span>
          </label>
        {/each}
      </div>
    </div>

    <div class="provider-section">
      <h4 class="provider-title">Gemini Models</h4>
      <div class="model-list">
        {#each getProviderModels('gemini') as model}
          <label class="model-item">
            <input
              type="checkbox"
              checked={enabledModels.includes(model.id)}
              onchange={() => toggleModel(model.id)}
            />
            <span class="model-name">{model.name}</span>
          </label>
        {/each}
      </div>
    </div>
  </div>

  <div class="popup-footer">
    <button class="save-button" onclick={handleSave} disabled={enabledModels.length === 0}>
      Save ({enabledModels.length} selected)
    </button>
  </div>
</div>

<style>
  .model-selector-popup {
    position: fixed;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 12px;
    padding: 0;
    z-index: 1200;
    min-width: 320px;
    max-width: 400px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    max-height: 80vh;
    overflow: hidden;
  }

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #374151;
  }

  .popup-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    font-family: 'Sora', sans-serif;
  }

  .close-button {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: #374151;
    color: #ffffff;
  }

  .popup-content {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
  }

  .provider-section {
    margin-bottom: 24px;
  }

  .provider-section:last-child {
    margin-bottom: 0;
  }

  .provider-title {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: #d1d5db;
    font-family: 'Sora', sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .model-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .model-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: #262832;
    border: 1px solid #374151;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
  }

  .model-item:hover {
    background: #2f3542;
    border-color: #4b5563;
  }

  .model-item input[type='checkbox'] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #4177f1;
  }

  .model-name {
    font-size: 14px;
    color: #e5e7eb;
    font-family: 'Sora', sans-serif;
    font-weight: 500;
  }

  .popup-footer {
    padding: 16px 20px;
    border-top: 1px solid #374151;
    display: flex;
    justify-content: flex-end;
  }

  .save-button {
    background: #4177f1;
    color: #ffffff;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'Sora', sans-serif;
  }

  .save-button:hover:not(:disabled) {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .save-button:disabled {
    background: #374151;
    color: #6b7280;
    cursor: not-allowed;
    transform: none;
  }

  .popup-content::-webkit-scrollbar {
    width: 6px;
  }

  .popup-content::-webkit-scrollbar-track {
    background: #1f2937;
  }

  .popup-content::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 3px;
  }

  .popup-content::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
  }
</style>

