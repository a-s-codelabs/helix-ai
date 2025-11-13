<script lang="ts">
  import TelescopeMessageContainer from "./TelescopeMessageContainer.svelte";
  import ModelSwitcher from "./ModelSwitcher.svelte";
  import { multiModelStore } from "@/lib/multiModelStore";
  import type { Message } from "./type";

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

  const currentModelState = $derived(activeModel ? modelResponses[activeModel] : null);
  const currentMessages = $derived(currentModelState?.messages || []);
  const isStreaming = $derived(currentModelState?.isStreaming || false);
  const streamingMessageId = $derived(currentModelState?.streamingMessageId || null);
</script>

<div class="multi-model-container">
  <ModelSwitcher />
  {#if activeModel && currentModelState}
    <div class="model-content">
      <TelescopeMessageContainer
        messages={currentMessages}
        {isStreaming}
        {streamingMessageId}
      />
    </div>
  {:else if enabledModels.length > 0}
    <div class="empty-state">
      <p>Select a model to view responses</p>
    </div>
  {/if}
</div>

<style>
  .multi-model-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .model-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: #888;
    font-size: 14px;
    text-align: center;
  }

  :global(.sidepanel-layout) .multi-model-container {
    height: 100%;
  }
</style>

