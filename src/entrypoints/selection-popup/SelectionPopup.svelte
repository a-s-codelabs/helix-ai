<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import type { SelectionAction } from './types';

  interface Props {
    x: number;
    y: number;
    onAction: (action: SelectionAction) => void;
    onClose?: () => void;
  }

  let { x, y, onAction, onClose }: Props = $props();

  const actions: Array<{ id: SelectionAction; icon: string; label: string }> = [
    { id: 'summarise', icon: '📝', label: 'Summarise' },
    { id: 'translate', icon: '🌐', label: 'Translate' },
    { id: 'addToChat', icon: '💬', label: 'Add to Chat' },
  ];

  function handleAction(action: SelectionAction) {
    onAction(action);
    onClose?.();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose?.();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="selection-popup"
  style:left="{x}px"
  style:top="{y}px"
  transition:scale={{ duration: 150, start: 0.9 }}
  role="menu"
  aria-label="Text selection actions"
>
  <div class="popup-arrow"></div>
  <div class="popup-content">
    {#each actions as action (action.id)}
      <button
        class="action-button"
        onclick={() => handleAction(action.id)}
        type="button"
        aria-label={action.label}
      >
        <span class="action-icon">{action.icon}</span>
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

  .popup-content {
    display: flex;
    gap: 4px;
    padding: 6px;
    background: rgba(17, 24, 39, 0.95);
    border-radius: 10px;
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
