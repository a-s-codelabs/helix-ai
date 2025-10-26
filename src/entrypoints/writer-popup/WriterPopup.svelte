<script lang="ts">
  import { scale, slide } from 'svelte/transition';
  /*@ts-ignore */
  import Sparkles from '../telescope-ui/icons/Sparkles.svelte';
  import {
    writeContentStreaming,
    checkWriterAvailability,
    type WriterOptions,
  } from '../../lib/writerApiHelper';

  interface Props {
    targetElement: HTMLTextAreaElement | HTMLInputElement;
    onClose?: () => void;
    onDragStart?: (event: MouseEvent) => void;
  }

  let { targetElement, onClose, onDragStart }: Props = $props();

  // State
  let prompt = $state('');
  let context = $state('');
  let isGenerating = $state(false);
  let error = $state('');
  let showOptions = $state(false);
  let apiAvailable = $state<'available' | 'after-download' | 'unavailable'>(
    'unavailable'
  );

  // Writer options
  let tone = $state<'formal' | 'neutral' | 'casual'>('neutral');
  let length = $state<'short' | 'medium' | 'long'>('medium');
  let format = $state<'markdown' | 'plain-text'>('plain-text');
  let sharedContext = $state('');
  let outputLanguage = $state('');
  let expectedInputLanguages = $state('');
  let expectedContextLanguages = $state('');

  // Streaming control
  let abortController: AbortController | null = null;
  let streamedContent = $state('');

  // Input ref for auto-focus
  let promptInput: HTMLInputElement | null = null;

  // Check API availability on mount
  $effect(() => {
    checkWriterAvailability().then((availability) => {
      apiAvailable = availability;
      if (availability === 'unavailable') {
        error =
          'Writer API is not available. Please use Chrome 129+ with Built-in AI enabled.';
      } else if (availability === 'after-download') {
        error =
          'Writer API is downloading. Please wait and try again in a few moments.';
      }
    });
  });

  // Get context from existing text in the textarea
  $effect(() => {
    if (targetElement && targetElement.value) {
      context = targetElement.value;
    }
  });

  // Auto-focus prompt input on mount
  $effect(() => {
    if (promptInput) {
      promptInput.focus();
    }
  });

  async function handleGenerate() {
    if (!prompt.trim()) {
      error = 'Please enter a prompt';
      return;
    }

    isGenerating = true;
    error = '';
    streamedContent = '';

    // Create abort controller for stopping
    abortController = new AbortController();

    try {
      const options: WriterOptions = {
        tone,
        length,
        format,
        ...(sharedContext.trim() && { sharedContext: sharedContext.trim() }),
        ...(outputLanguage.trim() && { outputLanguage: outputLanguage.trim() }),
        ...(expectedInputLanguages.trim() && {
          expectedInputLanguages: expectedInputLanguages
            .split(',')
            .map((l) => l.trim())
            .filter(Boolean),
        }),
        ...(expectedContextLanguages.trim() && {
          expectedContextLanguages: expectedContextLanguages
            .split(',')
            .map((l) => l.trim())
            .filter(Boolean),
        }),
      };

      console.log('[Writer API] Generating with streaming:', {
        prompt: prompt.trim(),
        context: context.trim() || undefined,
        options,
      });

      // Stream the content
      const stream = writeContentStreaming(
        {
          prompt: prompt.trim(),
          context: context.trim() || undefined,
        },
        options
      );

      // Save initial value before generation
      const initialValue = targetElement?.value || '';
      const separator = initialValue ? '\n\n' : '';

      for await (const chunk of stream) {
        if (abortController?.signal.aborted) {
          console.log('[Writer API] Generation stopped by user');
          break;
        }

        // Handle both Chrome Stable (full text each time) and Canary (incremental chunks)
        // In Chrome stable, the writer always returns the entire text, so we replace.
        // In Canary, only the newly generated content is returned, so we accumulate.
        // @ts-ignore - Check if Writer API exists to determine behavior
        streamedContent = 'Writer' in self ? streamedContent + chunk : chunk;

        // Update target element in real-time
        if (targetElement) {
          // Combine initial value with accumulated streamed content
          targetElement.value = initialValue + separator + streamedContent;

          // Trigger input event so frameworks detect the change
          targetElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      console.log('[Writer API] Generated text:', streamedContent);
      console.log('[Writer API] Final textarea value:', targetElement?.value);

      // Ensure final content is in the textarea
      if (targetElement && streamedContent) {
        // Make sure the final value is set
        const finalValue = initialValue + separator + streamedContent;
        targetElement.value = finalValue;
        targetElement.dispatchEvent(new Event('input', { bubbles: true }));
        targetElement.dispatchEvent(new Event('change', { bubbles: true }));
        targetElement.focus();

        console.log('[Writer API] Final value set:', finalValue);
      }

      // Show success notification if not aborted
      if (!abortController?.signal.aborted && streamedContent) {
        showSuccessNotification();

        // Close the popup
        setTimeout(() => {
          onClose?.();
        }, 500);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[Writer API] Generation aborted');
      } else {
        console.error('[Writer API] Error generating content:', err);
        error =
          err instanceof Error ? err.message : 'Failed to generate content';
      }
    } finally {
      isGenerating = false;
      abortController = null;
    }
  }

  function handleStop() {
    if (abortController) {
      abortController.abort();
    }
  }

  function showSuccessNotification() {
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.textContent = '✓ Content generated!';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      z-index: 2147483647;
      animation: slideIn 0.3s ease-out;
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Remove after 2 seconds
    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => {
        notification.remove();
        style.remove();
      }, 300);
    }, 2000);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      // Stop generation if running
      if (isGenerating) {
        handleStop();
      }
      onClose?.();
    }
    // Ctrl/Cmd + Enter to generate
    if (
      event.key === 'Enter' &&
      (event.ctrlKey || event.metaKey) &&
      prompt.trim() &&
      !isGenerating
    ) {
      event.preventDefault();
      handleGenerate();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="writer-popup"
  transition:scale={{ duration: 150, start: 0.95 }}
  role="dialog"
  aria-label="AI Writer"
>
  <!-- Header with drag handle -->
  <div class="header" onmousedown={onDragStart} role="button" tabindex="0">
    <div class="header-left">
      <span class="icon">
        <Sparkles />
      </span>
      {#if isGenerating}
        <button
          type="button"
          class="header-action-btn stop"
          onclick={handleStop}
        >
          ■ Stop
        </button>
      {:else}
        <button
          type="button"
          class="header-action-btn generate"
          onclick={handleGenerate}
          disabled={!prompt.trim()}
        >
          Write
        </button>
      {/if}
    </div>
    <div class="header-right">
      <button
        class="header-btn"
        onclick={() => (showOptions = !showOptions)}
        type="button"
        aria-label="Options"
      >
        Options
      </button>
      <button
        class="header-btn close"
        onclick={() => onClose?.()}
        type="button"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  </div>

  {#if error}
    <div class="error-banner">{error}</div>
  {/if}

  <div class="content">
    <!-- Prompt input -->
    <div class="input-wrapper">
      <input
        type="text"
        bind:this={promptInput}
        bind:value={prompt}
        placeholder="Add Prompt here..."
        class="prompt-input"
        disabled={isGenerating}
      />
    </div>

    <!-- Options panel (expandable) -->
    {#if showOptions}
      <div class="options-panel" transition:slide={{ duration: 200 }}>
        <!-- Context -->
        <div class="field">
          <label for="context">Context (optional)</label>
          <textarea
            id="context"
            bind:value={context}
            placeholder="Add background information for this specific write..."
            rows="2"
            disabled={isGenerating}
          ></textarea>
        </div>

        <!-- Shared Context -->
        <div class="field">
          <label for="sharedContext">Shared Context (optional)</label>
          <textarea
            id="sharedContext"
            bind:value={sharedContext}
            placeholder="e.g., I'm a long-standing customer..."
            rows="2"
            disabled={isGenerating}
          ></textarea>
        </div>

        <!-- Tone, Length, Format -->
        <div class="field-row field-row-3">
          <div class="field">
            <label for="tone">Tone</label>
            <select id="tone" bind:value={tone} disabled={isGenerating}>
              <option value="formal">Formal</option>
              <option value="neutral">Neutral</option>
              <option value="casual">Casual</option>
            </select>
          </div>

          <div class="field">
            <label for="length">Length</label>
            <select id="length" bind:value={length} disabled={isGenerating}>
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </div>

          <div class="field">
            <label for="format">Format</label>
            <select id="format" bind:value={format} disabled={isGenerating}>
              <option value="plain-text">Plain Text</option>
              <option value="markdown">Markdown</option>
            </select>
          </div>
        </div>

        <!-- Languages Section -->
        <div class="section-header">Languages (BCP 47 tags)</div>

        <div class="field">
          <label for="outputLanguage">Output Language (optional)</label>
          <input
            type="text"
            id="outputLanguage"
            bind:value={outputLanguage}
            placeholder="e.g., en-US, es, fr-FR"
            disabled={isGenerating}
          />
        </div>

        <div class="field">
          <label for="expectedInputLanguages"
            >Expected Input Languages (optional)</label
          >
          <input
            type="text"
            id="expectedInputLanguages"
            bind:value={expectedInputLanguages}
            placeholder="e.g., en-US, es (comma-separated)"
            disabled={isGenerating}
          />
        </div>

        <div class="field">
          <label for="expectedContextLanguages"
            >Expected Context Languages (optional)</label
          >
          <input
            type="text"
            id="expectedContextLanguages"
            bind:value={expectedContextLanguages}
            placeholder="e.g., en-US, es (comma-separated)"
            disabled={isGenerating}
          />
        </div>

        <!-- Info Section -->
        <div class="info-section">
          <span class="info-label">Input Quota:</span>
          <span class="info-value">~6000 characters</span>
        </div>

        <!-- Keyboard shortcuts hint -->
        <div class="shortcuts-hint">
          <span class="shortcut"
            ><kbd>Ctrl</kbd>+<kbd>Enter</kbd> to generate</span
          >
          <span class="shortcut"><kbd>Esc</kbd> to exit</span>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .writer-popup {
    position: fixed;
    width: 360px;
    background: #18181b;
    border-radius: 12px;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.3),
      0 8px 10px -6px rgba(0, 0, 0, 0.2);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, sans-serif;
    font-size: 14px;
    color: #e4e4e7;
    overflow: hidden;
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #27272a;
    border-bottom: 1px solid #3f3f46;
    cursor: move;
    user-select: none;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #a78bfa;
  }

  .header-action-btn {
    padding: 6px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .header-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .header-action-btn.generate {
    background: #a78bfa;
    color: #18181b;
  }

  .header-action-btn.generate:hover:not(:disabled) {
    background: #c4b5fd;
  }

  .header-action-btn.generate:active:not(:disabled) {
    transform: scale(0.98);
  }

  .header-action-btn.stop {
    background: #dc2626;
    color: white;
  }

  .header-action-btn.stop:hover {
    background: #ef4444;
  }

  .header-action-btn.stop:active {
    transform: scale(0.98);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-btn {
    background: transparent;
    border: none;
    color: #a1a1aa;
    font-size: 13px;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .header-btn:hover {
    background: #3f3f46;
    color: #e4e4e7;
  }

  .header-btn.close {
    font-size: 18px;
    padding: 2px 6px;
  }

  /* Error banner */
  .error-banner {
    background: #7f1d1d;
    color: #fca5a5;
    padding: 8px 16px;
    font-size: 12px;
    border-bottom: 1px solid #991b1b;
  }

  /* Content */
  .content {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Prompt input */
  .input-wrapper {
    display: flex;
    flex-direction: column;
  }

  .prompt-input {
    width: 94%;
    padding: 8px 10px;
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 13px;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  .prompt-input::placeholder {
    color: #71717a;
  }

  .prompt-input:focus {
    outline: none;
    border-color: #a78bfa;
    background: #18181b;
  }

  .prompt-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Options panel */
  .options-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background: #27272a;
    border-radius: 6px;
    border: 1px solid #3f3f46;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .field-row-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
  }

  label {
    font-size: 12px;
    font-weight: 500;
    color: #a1a1aa;
  }

  input[type='text'] {
    width: 100%;
    padding: 8px 10px;
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    color: #e4e4e7;
    font-size: 13px;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  input[type='text']::placeholder {
    color: #71717a;
  }

  input[type='text']:focus {
    outline: none;
    border-color: #a78bfa;
  }

  input[type='text']:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  textarea,
  select {
    width: 100%;
    padding: 8px 10px;
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    color: #e4e4e7;
    font-size: 13px;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  textarea::placeholder {
    color: #71717a;
  }

  textarea:focus,
  select:focus {
    outline: none;
    border-color: #a78bfa;
  }

  textarea:disabled,
  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  textarea {
    resize: none;
    min-height: 60px;
    max-height: 120px;
    overflow-y: auto;
    width: 93%;
  }

  textarea::-webkit-scrollbar {
    width: 6px;
  }

  textarea::-webkit-scrollbar-track {
    background: transparent;
  }

  textarea::-webkit-scrollbar-thumb {
    background: #3f3f46;
    border-radius: 3px;
  }

  textarea::-webkit-scrollbar-thumb:hover {
    background: #52525b;
  }

  select {
    cursor: pointer;
  }

  /* Section header */
  .section-header {
    font-size: 12px;
    font-weight: 600;
    color: #a78bfa;
    margin-top: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid #3f3f46;
  }

  /* Info section */
  .info-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: #18181b;
    border-radius: 4px;
    border: 1px solid #3f3f46;
    font-size: 12px;
  }

  .info-label {
    color: #a1a1aa;
    font-weight: 500;
  }

  .info-value {
    color: #e4e4e7;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      monospace;
  }

  /* Keyboard shortcuts hint */
  .shortcuts-hint {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 8px;
    margin-top: 8px;
    border-top: 1px solid #3f3f46;
    font-size: 11px;
    color: #71717a;
  }

  .shortcut {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  kbd {
    display: inline-block;
    padding: 2px 6px;
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 3px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      monospace;
    font-size: 10px;
    line-height: 1;
    color: #a1a1aa;
    box-shadow: 0 1px 0 #3f3f46;
  }

  @media (max-width: 640px) {
    .writer-popup {
      width: 95vw;
      max-width: 360px;
    }

    .field-row,
    .field-row-3 {
      grid-template-columns: 1fr;
    }

    .header-action-btn {
      padding: 5px 12px;
      font-size: 12px;
    }
  }
</style>
