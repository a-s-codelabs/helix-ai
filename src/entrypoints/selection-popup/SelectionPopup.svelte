<script lang="ts">
  import { scale } from 'svelte/transition';
  import type { SelectionAction } from './types';
  import Summarise from '../telescope-ui/icons/Summarise.svelte';
  import Translate from '../telescope-ui/icons/Translate.svelte';
  import AddToChat from '../telescope-ui/icons/AddToChat.svelte';
  import { sidePanelUtils } from '../../lib/sidePanelStore';

  interface Props {
    x: number;
    y: number;
    isAtTop?: boolean;
    onAction: (action: SelectionAction) => void;
    onClose?: () => void;
  }

  let { x, y, isAtTop = false, onAction, onClose }: Props = $props();

  const actions: Array<{ id: SelectionAction; icon: any; label: string }> = [
    { id: 'addToChat', icon: AddToChat, label: 'Add to Chat' },
    { id: 'summarise', icon: Summarise, label: 'Summarise' },
    { id: 'translate', icon: Translate, label: 'Translate' },
  ];

  // Helper to grab selected text from the document
  function getSelectedText(): string {
    return (window.getSelection?.() || document.getSelection?.())?.toString() || '';
  }

  async function handleAction(action: SelectionAction) {
    const selectedText = getSelectedText();

    switch (action) {
      case 'addToChat':
        // Pass action to parent handler which will add the text from store
        onAction(action);
        onClose?.();
        break;
      case 'summarise': {
        // Handle summarise directly with the selected text
        const success = await sidePanelUtils.moveToSidePanel({
          messages: [
            {
              id: Date.now(),
              type: 'user',
              content: selectedText,
              timestamp: new Date(),
            },
          ],
          isStreaming: false,
          streamingMessageId: null,
          inputValue: "",
          inputImageAttached: [],
          searchIndex: 1,
          totalResults: 0,
          currentState: 'ask',
          source: 'append',
          timestamp: Date.now(),
        });
        onClose?.();
        break;
      }
      case 'translate':
        // Pass action to parent handler which will add the text from store
        onAction(action);
        onClose?.();
        break;
    }
  }
  //   onAction(action);
  //   onClose?.();
  // }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose?.();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="selection-popup"
  class:at-top={isAtTop}
  style:left="{x}px"
  style:top="{y}px"
  transition:scale={{ duration: 150, start: 0.9 }}
  role="menu"
  aria-label="Text selection actions"
>
  {#if !isAtTop}
    <div class="popup-arrow"></div>
  {:else}
    <div class="popup-arrow popup-arrow-inverted"></div>
  {/if}
  <div class="popup-content">
    {#each actions as action (action.id)}
      <button
        class="action-button"
        onclick={() => handleAction(action.id)}
        type="button"
        aria-label={action.label}
      >
        <span class="action-icon">
          <!-- svelte-ignore svelte_component_deprecated -->
          <svelte:component this={action.icon} />
        </span>
        <span class="action-label">{action.label}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .selection-popup {
    position: fixed;
    z-index: 2147483647;
    transform: translate(-50%, -100%);
    margin-top: -12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, sans-serif;
    font-size: 14px;
  }

  .selection-popup.at-top {
    transform: translate(-50%, 0);
    margin-top: 0;
  }

  .popup-arrow {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid rgba(17, 24, 39, 0.95);
  }

  .popup-arrow-inverted {
    bottom: auto;
    top: -6px;
    border-top: none;
    border-bottom: 6px solid rgba(17, 24, 39, 0.95);
  }

  .popup-content {
    display: flex;
    gap: 4px;
    padding: 6px;
    background: rgba(17, 24, 39, 0.95);
    border-radius: 32px;
    box-shadow:
      0 10px 25px -5px rgba(0, 0, 0, 0.3),
      0 8px 10px -6px rgba(0, 0, 0, 0.2),
      0 0 0 1px rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: transparent;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 500;
    outline: none;
  }

  .action-button:hover {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .action-button:active {
    transform: scale(0.95);
    background: rgba(59, 130, 246, 0.25);
  }

  .action-button:focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  .action-icon {
    font-size: 16px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: #2B2E39;
    border-radius: 50%;
    padding: 4px;
  }

  .action-label {
    line-height: 1;
  }

  @media (max-width: 640px) {
    .action-label {
      display: none;
    }

    .action-button {
      padding: 8px;
    }

    .popup-content {
      gap: 2px;
    }
  }
</style>
