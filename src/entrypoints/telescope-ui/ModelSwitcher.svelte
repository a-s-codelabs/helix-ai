<script lang="ts">
  import { multiModelStore, AVAILABLE_MODELS } from "@/lib/multiModelStore";
  import type { ModelConfig } from "@/lib/multiModelStore";

  let activeModel = $state<string | null>(null);
  let enabledModels = $state<string[]>([]);
  let modelResponses = $state<Record<string, any>>({});

  $effect(() => {
    const unsubscribe = multiModelStore.subscribe((state) => {
      activeModel = state.activeModel;
      enabledModels = state.enabledModels;
      modelResponses = state.modelResponses;
    });
    return unsubscribe;
  });

  function handleModelSwitch(modelId: string) {
    multiModelStore.setActiveModel(modelId);
  }

  function getModelConfig(modelId: string): ModelConfig | undefined {
    return AVAILABLE_MODELS.find((m) => m.id === modelId);
  }

  function getModelStatus(modelId: string): "idle" | "loading" | "streaming" | "error" {
    const state = modelResponses[modelId];
    if (!state) return "idle";
    if (state.error) return "error";
    if (state.isStreaming) return "streaming";
    if (state.isLoading) return "loading";
    return "idle";
  }
</script>

<div class="model-switcher">
  {#each enabledModels as modelId}
    {@const model = getModelConfig(modelId)}
    {@const status = getModelStatus(modelId)}
    {#if model}
      <button
        class="model-tab"
        class:active={activeModel === modelId}
        class:loading={status === "loading"}
        class:streaming={status === "streaming"}
        class:error={status === "error"}
        onclick={() => handleModelSwitch(modelId)}
        title={model.name}
        aria-label={model.name}
      >
        <span class="model-name">{model.name}</span>
        {#if status === "loading"}
          <span class="status-indicator loading">⏳</span>
        {:else if status === "streaming"}
          <span class="status-indicator streaming">●</span>
        {:else if status === "error"}
          <span class="status-indicator error">⚠</span>
        {/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  .model-switcher {
    display: flex;
    gap: 4px;
    padding: 8px;
    background: #1a1a1a;
    border-bottom: 1px solid #2a2a2a;
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: #555 #2a2a2a;
  }

  .model-switcher::-webkit-scrollbar {
    height: 4px;
  }

  .model-switcher::-webkit-scrollbar-track {
    background: #2a2a2a;
    border-radius: 2px;
  }

  .model-switcher::-webkit-scrollbar-thumb {
    background: #555;
    border-radius: 2px;
  }

  .model-switcher::-webkit-scrollbar-thumb:hover {
    background: #666;
  }

  .model-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #262832;
    border: 1px solid #404040;
    border-radius: 16px;
    color: #d1d5db;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
    outline: none;
  }

  .model-tab:hover {
    background: #2f3542;
    border-color: #555;
    color: #fff;
  }

  .model-tab:active {
    transform: scale(0.98);
  }

  .model-tab.active {
    background: #4177f1;
    border-color: #4177f1;
    color: #fff;
  }

  .model-tab.loading {
    border-color: #fbbf24;
  }

  .model-tab.streaming {
    border-color: #10b981;
  }

  .model-tab.error {
    border-color: #ef4444;
  }

  .model-name {
    font-family: "Sora", sans-serif;
  }

  .status-indicator {
    font-size: 10px;
    line-height: 1;
    animation: pulse 2s infinite;
  }

  .status-indicator.loading {
    animation: spin 1s linear infinite;
  }

  .status-indicator.streaming {
    color: #10b981;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .status-indicator.error {
    color: #ef4444;
    animation: none;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 400px) {
    .model-tab {
      padding: 5px 10px;
      font-size: 12px;
    }

    .model-name {
      font-size: 11px;
    }
  }
</style>

