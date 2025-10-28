<script lang="ts">
  import { scale, slide } from 'svelte/transition';
  /*@ts-ignore */
  // import Sparkles from '../telescope-ui/icons/Sparkles.svelte';
  /*@ts-ignore */
  import Helix from '../telescope-ui/icons/Helix.svelte';
  /*@ts-ignore */
  import Settings from '../telescope-ui/icons/Settings.svelte';
  /*@ts-ignore */
  import Send from '../telescope-ui/icons/Send.svelte';
  import {
    writeContentStreaming,
    checkWriterAvailability,
    rewriteContentStreaming,
    checkRewriterAvailability,
    type WriterOptions,
    type RewriterOptions,
  } from '../../lib/writerApiHelper';

  interface Props {
    targetElement: HTMLTextAreaElement | HTMLInputElement;
    onClose?: () => void;
    onDragStart?: (event: MouseEvent) => void;
  }

  let { targetElement, onClose, onDragStart }: Props = $props();

  // Mode
  type Mode = 'writer' | 'rewriter';
  let mode = $state<Mode>('writer');

  // State
  let prompt = $state('');
  let context = $state('');
  let isGenerating = $state(false);
  let error = $state('');
  let showOptions = $state(false);
  let showLanguages = $state(false);
  let apiAvailable = $state<'available' | 'after-download' | 'unavailable'>(
    'unavailable'
  );

  // Selection tracking for rewriter mode
  let selectionStart = $state<number | null>(null);
  let selectionEnd = $state<number | null>(null);
  let textBeforeSelection = $state('');
  let textAfterSelection = $state('');

  // Writer options
  let writerTone = $state<'formal' | 'neutral' | 'casual'>('neutral');
  let writerLength = $state<'short' | 'medium' | 'long'>('medium');
  let writerFormat = $state<'markdown' | 'plain-text'>('plain-text');

  // Rewriter options
  let rewriterTone = $state<'as-is' | 'more-formal' | 'more-casual'>('as-is');
  let rewriterLength = $state<'as-is' | 'shorter' | 'longer'>('as-is');
  let rewriterFormat = $state<'as-is' | 'markdown' | 'plain-text'>('as-is');

  // Common options
  let outputLanguage = $state('en');

  // Language checkboxes
  let inputLangs = $state({
    en: false,
    fr: false,
    ja: false,
    pt: false,
    es: false,
  });

  let contextLangs = $state({
    en: false,
    fr: false,
    ja: false,
    pt: false,
    es: false,
  });

  // Streaming control
  let abortController: AbortController | null = null;
  let streamedContent = $state('');

  // Check API availability based on mode
  $effect(() => {
    const checkAvailability = async () => {
      const availability =
        mode === 'writer'
          ? await checkWriterAvailability()
          : await checkRewriterAvailability();

      apiAvailable = availability;

      const apiName = mode === 'writer' ? 'Writer' : 'Rewriter';

      if (availability === 'unavailable') {
        error = `${apiName} API is not available. Please use Chrome 129+ with Built-in AI enabled.`;
      } else if (availability === 'after-download') {
        error = `${apiName} API is downloading. Please wait and try again in a few moments.`;
      } else {
        error = '';
      }
    };

    checkAvailability();
  });

  // Get context from existing text in the textarea
  // For rewriter mode, also capture selected text if any
  $effect(() => {
    if (targetElement && targetElement.value) {
      context = targetElement.value;
    }

    // In rewriter mode, check for selected text
    if (mode === 'rewriter' && targetElement) {
      const start = targetElement.selectionStart || 0;
      const end = targetElement.selectionEnd || 0;

      if (start !== end) {
        // User has selected text
        const selectedText = targetElement.value.substring(start, end);
        prompt = selectedText;
        selectionStart = start;
        selectionEnd = end;
        textBeforeSelection = targetElement.value.substring(0, start);
        textAfterSelection = targetElement.value.substring(end);
      } else {
        // No selection, use entire text
        selectionStart = null;
        selectionEnd = null;
        textBeforeSelection = '';
        textAfterSelection = '';
      }
    }
  });

  // Auto-focus prompt input on mount and mode change
  $effect(() => {
    setTimeout(() => {
      const input = document.querySelector('.prompt-input') as HTMLInputElement;
      const textarea = document.querySelector('.prompt-textarea') as HTMLTextAreaElement;
      if (mode === 'writer' && input) {
        input.focus();
      } else if (mode === 'rewriter' && textarea) {
        textarea.focus();
      }
    }, 0);
  });

  async function handleGenerate() {
    if (!prompt.trim()) {
      error = mode === 'writer' ? 'Please enter a prompt' : 'Please enter text to rewrite';
      return;
    }

    isGenerating = true;
    error = '';
    streamedContent = '';

    // Create abort controller for stopping
    abortController = new AbortController();

    try {
      // Convert checkbox states to language arrays
      const selectedInputLangs = Object.entries(inputLangs)
        .filter(([_, checked]) => checked)
        .map(([lang]) => lang);

      const selectedContextLangs = Object.entries(contextLangs)
        .filter(([_, checked]) => checked)
        .map(([lang]) => lang);

      if (mode === 'writer') {
        // Writer mode
        const options: WriterOptions = {
          tone: writerTone,
          length: writerLength,
          format: writerFormat,
          ...(context.trim() && { sharedContext: context.trim() }),
          ...(outputLanguage && outputLanguage !== '' && { outputLanguage }),
          ...(selectedInputLangs.length > 0 && {
            expectedInputLanguages: selectedInputLangs,
          }),
          ...(selectedContextLangs.length > 0 && {
            expectedContextLanguages: selectedContextLangs,
          }),
        };

        console.log('[Writer API] Generating with streaming:', {
          prompt: prompt.trim(),
          options,
        });

        // Stream the content
        const stream = writeContentStreaming(
          {
            prompt: prompt.trim(),
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
          // @ts-ignore - Check if Writer API exists to determine behavior
          streamedContent = 'Writer' in self ? streamedContent + chunk : chunk;

          // Update target element in real-time
          if (targetElement) {
            targetElement.value = initialValue + separator + streamedContent;
            targetElement.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }

        console.log('[Writer API] Generated text:', streamedContent);
      } else {
        // Rewriter mode
        const options: RewriterOptions = {
          tone: rewriterTone,
          length: rewriterLength,
          format: rewriterFormat,
          ...(context.trim() && { sharedContext: context.trim() }),
          ...(outputLanguage && outputLanguage !== '' && { outputLanguage }),
          ...(selectedInputLangs.length > 0 && {
            expectedInputLanguages: selectedInputLangs,
          }),
          ...(selectedContextLangs.length > 0 && {
            expectedContextLanguages: selectedContextLangs,
          }),
        };

        console.log('[Rewriter API] Rewriting with streaming:', {
          text: prompt.trim(),
          options,
        });

        // Stream the content
        const stream = rewriteContentStreaming(
          {
            text: prompt.trim(),
          },
          options
        );

        for await (const chunk of stream) {
          if (abortController?.signal.aborted) {
            console.log('[Rewriter API] Rewriting stopped by user');
            break;
          }

          // Handle both Chrome Stable (full text each time) and Canary (incremental chunks)
          // @ts-ignore - Check if Rewriter API exists to determine behavior
          streamedContent = 'Rewriter' in self ? streamedContent + chunk : chunk;

          // Update target element in real-time
          if (targetElement) {
            if (selectionStart !== null && selectionEnd !== null) {
              // Replace only selected text
              targetElement.value = textBeforeSelection + streamedContent + textAfterSelection;

              // Set cursor at the end of the rewritten content
              const newCursorPosition = textBeforeSelection.length + streamedContent.length;
              targetElement.setSelectionRange(newCursorPosition, newCursorPosition);
            } else {
              // Replace entire content
              targetElement.value = streamedContent;
            }
            targetElement.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }

        console.log('[Rewriter API] Rewritten text:', streamedContent);
      }

      // Finalize and ensure all events are dispatched
      if (targetElement && streamedContent) {
        if (mode === 'writer') {
          // For writer, the final value is already set during streaming
          // Just ensure the change event is dispatched
          targetElement.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          // For rewriter, the content is already replaced during streaming
          // Supports rewriting only selected text or entire content
          targetElement.dispatchEvent(new Event('change', { bubbles: true }));
        }

        targetElement.focus();
        console.log(`[${mode === 'writer' ? 'Writer' : 'Rewriter'} API] Final value set:`, targetElement.value);
      }

      // Show success notification if not aborted
      if (!abortController?.signal.aborted && streamedContent) {
        showSuccessNotification(mode === 'writer' ? 'Content generated!' : 'Content rewritten!');

        // Close the popup
        setTimeout(() => {
          onClose?.();
        }, 500);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log(`[${mode === 'writer' ? 'Writer' : 'Rewriter'} API] Generation aborted`);
      } else {
        console.error(`[${mode === 'writer' ? 'Writer' : 'Rewriter'} API] Error:`, err);
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

  function showSuccessNotification(message: string = '✓ Content generated!') {
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.textContent = message;
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

  function handleResetOptions() {
    // Reset writer options
    writerTone = 'neutral';
    writerLength = 'medium';
    writerFormat = 'plain-text';

    // Reset rewriter options
    rewriterTone = 'as-is';
    rewriterLength = 'as-is';
    rewriterFormat = 'as-is';

    // Reset common options
    outputLanguage = 'en';
    inputLangs = {
      en: false,
      fr: false,
      ja: false,
      pt: false,
      es: false,
    };
    contextLangs = {
      en: false,
      fr: false,
      ja: false,
      pt: false,
      es: false,
    };
    context = '';
  }

  function handleWriterMode() {
    mode = 'writer';
  }

  function handleRewriterMode() {
    mode = 'rewriter';
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
        <Helix />
      </span>
      <button
        class="header-btn mode-btn writer-btn"
        onclick={handleWriterMode}
        type="button"
        aria-label="Writer mode"
        disabled={isGenerating}
        class:active={mode === 'writer'}
      >
        Writer
      </button>
      <button
        class="header-btn mode-btn rewriter-btn"
        onclick={handleRewriterMode}
        type="button"
        aria-label="Rewriter mode"
        disabled={isGenerating}
        class:active={mode === 'rewriter'}
      >
        Rewriter
      </button>
      <button
        class="header-btn mode-btn proofreader-btn"
        onclick={handleProofreaderMode}
        type="button"
        aria-label="Proofreader mode"
        disabled={isGenerating}
        class:active={mode === 'proofreader'}
      >
        Proofreader
      </button>
    </div>
    
    <div class="header-right">
      {#if isGenerating}
        <button
          type="button"
          class="header-action-btn stop"
          onclick={handleStop}
        >
          Stop
        </button>
      {:else}
        <button
          type="button"
          class="header-action-btn generate"
          onclick={handleGenerate}
          disabled={!prompt.trim()}
        >
          <Send />
        </button>
      {/if}

      <!-- <button
        class="header-btn"
        onclick={() => (showOptions = !showOptions)}
        type="button"
        aria-label="Options"
      >
        Options
      </button> -->
      <button
        class="header-btn close"
        onclick={() => onClose?.()}
        type="button"
        aria-label="Close"
        title="Close"
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
      <textarea
        type="text"
        bind:value={prompt}
        placeholder={`Add prompt to ${
          mode === 'writer' ? 'write' : 'rewrite'
        } here...`}
        class="prompt-textarea"
        rows="3"
        disabled={isGenerating}
      />
      {#if selectionStart !== null && selectionEnd !== null}
        <div class="selection-info">
          ✓ Rewriting selected text only ({selectionEnd - selectionStart} chars)
        </div>
      {/if}

      <button
        class="prompt-settings-btn"
        type="button"
        aria-label="Prompt options"
        onclick={() => (showOptions = !showOptions)}
        title="Options"
      >
        <Settings />
      </button>
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
            placeholder="Add background information... e.g., I'm a long-standing customer..."
            rows="3"
            disabled={isGenerating}
          />
        </div>

        <!-- Tone, Length, Format -->
        <div class="field-row field-row-3">
          <div class="field">
            <label for="tone">Tone</label>
            {#if mode === 'writer'}
              <select id="tone" bind:value={writerTone} disabled={isGenerating}>
                <option value="formal">Formal</option>
                <option value="neutral">Neutral</option>
                <option value="casual">Casual</option>
              </select>
            {:else}
              <select
                id="tone"
                bind:value={rewriterTone}
                disabled={isGenerating}
              >
                <option value="as-is">As-Is</option>
                <option value="more-formal">More Formal</option>
                <option value="more-casual">More Casual</option>
              </select>
            {/if}
          </div>

          <div class="field">
            <label for="length">Length</label>
            {#if mode === 'writer'}
              <select
                id="length"
                bind:value={writerLength}
                disabled={isGenerating}
              >
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            {:else}
              <select
                id="length"
                bind:value={rewriterLength}
                disabled={isGenerating}
              >
                <option value="as-is">As-Is</option>
                <option value="shorter">Shorter</option>
                <option value="longer">Longer</option>
              </select>
            {/if}
          </div>

          <div class="field">
            <label for="format">Format</label>
            {#if mode === 'writer'}
              <select
                id="format"
                bind:value={writerFormat}
                disabled={isGenerating}
              >
                <option value="plain-text">Plain Text</option>
                <option value="markdown">Markdown</option>
              </select>
            {:else}
              <select
                id="format"
                bind:value={rewriterFormat}
                disabled={isGenerating}
              >
                <option value="as-is">As-Is</option>
                <option value="plain-text">Plain Text</option>
                <option value="markdown">Markdown</option>
              </select>
            {/if}
          </div>
        </div>

        <div class="field">
          <!-- Output Language -->
          <label for="outputLanguage">Output Language</label>
          <select
            id="outputLanguage"
            bind:value={outputLanguage}
            disabled={isGenerating}
          >
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="ja">Japanese</option>
            <option value="pt">Portuguese</option>
            <option value="es">Spanish</option>
          </select>
        </div>

        <!-- Input Quota Info -->
        <!-- <div class="info-section">
          <span class="info-label">Input Quota:</span>
          <span class="info-value">~6000 characters</span>
        </div> -->

        <!-- Languages Section (Collapsible) -->
        <!-- <button
          type="button"
          class="section-toggle"
          onclick={() => (showLanguages = !showLanguages)}
        >
          <span class="toggle-icon">{showLanguages ? '▼' : '▶'}</span>
          Languages (optional)
        </button> -->

        <!-- {#if showLanguages}
          <div class="languages-panel" transition:slide={{ duration: 200 }}> -->

        <!-- Expected Input Languages -->
        <!-- <div class="field">
              <fieldset class="checkbox-fieldset">
                <legend>Expected Input Languages</legend>
                <div class="checkbox-group">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={inputLangs.en}
                    disabled={isGenerating}
                  />
                  <span>English</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={inputLangs.fr}
                    disabled={isGenerating}
                  />
                  <span>French</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={inputLangs.ja}
                    disabled={isGenerating}
                  />
                  <span>Japanese</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={inputLangs.pt}
                    disabled={isGenerating}
                  />
                  <span>Portuguese</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={inputLangs.es}
                    disabled={isGenerating}
                  />
                  <span>Spanish</span>
                </label>
              </div>
              </fieldset>
            </div> -->

        <!-- Expected Context Languages -->
        <!-- <div class="field">
              <fieldset class="checkbox-fieldset">
                <legend>Expected Context Languages</legend>
                <div class="checkbox-group">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={contextLangs.en}
                    disabled={isGenerating}
                  />
                  <span>English</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={contextLangs.fr}
                    disabled={isGenerating}
                  />
                  <span>French</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={contextLangs.ja}
                    disabled={isGenerating}
                  />
                  <span>Japanese</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={contextLangs.pt}
                    disabled={isGenerating}
                  />
                  <span>Portuguese</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={contextLangs.es}
                    disabled={isGenerating}
                  />
                  <span>Spanish</span>
                </label>
              </div>
              </fieldset>
            </div> -->
        <!-- </div> -->
        <!-- {/if} -->

        <!-- Reset Button -->
        <!-- <button
          type="button"
          class="reset-btn"
          onclick={handleResetOptions}
          disabled={isGenerating}
        >
          Reset Options
        </button> -->

        <!-- Keyboard shortcuts hint -->
        <!-- <div class="shortcuts-hint">
          <span class="shortcut"
            ><kbd>Ctrl</kbd>+<kbd>Enter</kbd> to generate</span
          >
          <span class="shortcut"><kbd>Esc</kbd> to exit</span>
        </div> -->
      </div>
    {/if}


  </div>
</div>

<style>
  .writer-popup {
    position: fixed;
    width: 410px;
    background: #18181b;
    border-radius: 8px;
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
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #3b82f6;
  }

  .header-action-btn {
    padding: 6px 16px;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .header-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .header-action-btn.generate {
    background: #3b82f6;
    color: white;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
    align-self: center;
  }

  .header-action-btn.generate :global(svg) {
    width: 14px;
    height: 14px;
  }

  .header-action-btn.generate:hover:not(:disabled) {
    /* Use a faded version of #3b82f6 (blue-500), e.g. 80% opacity */
    background: #3b82f6cc;
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
    font-size: 14px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .header-btn:hover {
    background: #3f3f46;
    color: #e4e4e7;
  }

  .header-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .header-btn.mode-btn {
    background: #3f3f46;
    color: #e4e4e7;
    font-weight: 500;
    margin-right: 4px;
  }

  .header-btn.mode-btn:hover:not(:disabled) {
    background: #52525b;
  }

  .header-btn.mode-btn.active {
    background: #3b82f6;
    color: #ffffff;
  }

  .header-btn.mode-btn.active:hover:not(:disabled) {
    background: #3b82f6cc;
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
    overflow: auto;
    overscroll-behavior: none;
    max-height: 50vh;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    /* Make scrollbar thin in Firefox */
    scrollbar-width: thin;
    scrollbar-color: #52525b transparent;
  }

  /* Prompt input */
  .input-wrapper {
    display: flex;
    flex-direction: column;
  }

  .prompt-input-container {
    position: relative;
    width: 100%;
  }

  .prompt-input {
    width: 94%;
    padding: 8px 10px;
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    color: #e4e4e7;
    font-size: 13px;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  /* .prompt-input.has-icon {
    padding-right: 36px;
  } */

  .prompt-settings-btn {
    position: absolute;
    right: 20px;
    top: 85px;
    transform: translateY(-50%);
    width: 28px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: #a1a1aa;
    cursor: pointer;
    border-radius: 6px;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .prompt-settings-btn:hover {
    background: #3f3f46;
    color: #e4e4e7;
  }

  .prompt-input::placeholder {
    color: #71717a;
  }

  .prompt-input:focus {
    outline: none;
    border-color: #3b82f6;
    background: #18181b;
  }

  .prompt-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .prompt-textarea {
    width: 94%;
    padding: 8px 10px;
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 13px;
    font-family: inherit;
    transition: all 0.15s ease;
    resize: none;
    min-height: 60px;
    overflow-y: auto;
  }

  .prompt-textarea::placeholder {
    color: #71717a;
  }

  .prompt-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    background: #18181b;
  }

  .prompt-textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .prompt-textarea::-webkit-scrollbar {
    width: 6px;
  }

  .prompt-textarea::-webkit-scrollbar-track {
    background: transparent;
  }

  .prompt-textarea::-webkit-scrollbar-thumb {
    background: #3f3f46;
    border-radius: 3px;
  }

  .prompt-textarea::-webkit-scrollbar-thumb:hover {
    background: #52525b;
  }

  .selection-info {
    margin-top: 6px;
    padding: 6px 10px;
    background: #1e3a8a;
    border-radius: 4px;
    color: #93c5fd;
    font-size: 11px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* Options panel */
  .options-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background: #27272a;
    border-radius: 8px;
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
    width: 94%;
    padding: 8px 10px;
    background: #262832;
    border: 1px solid #3f3f46;
    border-radius: 48px;
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
    border-color: #3b82f6;
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
    border-radius: 8px;
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
    border-color: #3b82f6;
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
    border-radius: 8px;
  }

  textarea::-webkit-scrollbar-thumb:hover {
    background: #52525b;
  }

  /* Thin scrollbar for content container (WebKit) */
  .content::-webkit-scrollbar {
    width: 6px;
  }

  .content::-webkit-scrollbar-track {
    background: transparent;
  }

  .content::-webkit-scrollbar-thumb {
    background: #3f3f46;
    border-radius: 8px;
  }

  .content::-webkit-scrollbar-thumb:hover {
    background: #52525b;
  }

  select {
    cursor: pointer;
  }

  /* Section toggle button */
  .section-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 8px;
    color: #3b82f6;
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-top: 8px;
  }

  .section-toggle:hover {
    background: #3f3f46;
    border-color: #52525b;
  }

  .section-toggle:active {
    transform: scale(0.99);
  }

  .toggle-icon {
    font-size: 10px;
    color: #a1a1aa;
  }

  /* Languages panel */
  .languages-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background: #27272a;
    border-radius: 8px;
    border: 1px solid #3f3f46;
    margin-top: 8px;
  }

  /* Info section */
  .info-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: #18181b;
    border-radius: 8px;
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

  /* Checkbox fieldset */
  .checkbox-fieldset {
    border: none;
    padding: 0;
    margin: 0;
  }

  .checkbox-fieldset legend {
    font-size: 12px;
    font-weight: 500;
    color: #a1a1aa;
    margin-bottom: 6px;
  }

  /* Checkbox group */
  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    background: #18181b;
    border-radius: 8px;
    border: 1px solid #3f3f46;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #e4e4e7;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 8px;
    transition: background 0.15s ease;
  }

  .checkbox-label:hover {
    background: #27272a;
  }

  .checkbox-label input[type='checkbox'] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: #3b82f6;
  }

  .checkbox-label input[type='checkbox']:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .checkbox-label span {
    user-select: none;
  }

  /* Reset Button */
  .reset-btn {
    width: 100%;
    padding: 8px 12px;
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 8px;
    color: #a1a1aa;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reset-btn:hover:not(:disabled) {
    background: #3f3f46;
    border-color: #52525b;
    color: #e4e4e7;
  }

  .reset-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .reset-btn:active:not(:disabled) {
    transform: scale(0.99);
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
    border-radius: 8px;
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
