<script lang="ts">
  import { scale, slide } from "svelte/transition";
  /*@ts-ignore */
  import Helix from "../telescope-ui/icons/Helix.svelte";
  /*@ts-ignore */
  import Settings from "../telescope-ui/icons/Settings.svelte";
  /*@ts-ignore */
  import Send from "../telescope-ui/icons/Send.svelte";
  import {
    writeContentStreaming,
    checkWriterAvailability,
    rewriteContentStreaming,
    checkRewriterAvailability,
    proofreadContentStreaming,
    checkProofreaderAvailability,
    type WriterOptions,
    type RewriterOptions,
    type ProofreaderOptions,
  } from "../../lib/writerApiHelper";

  interface Props {
    targetElement: HTMLTextAreaElement | HTMLInputElement | HTMLElement;
    onClose?: () => void;
    onDragStart?: (event: MouseEvent) => void;
  }

  let { targetElement, onClose, onDragStart }: Props = $props();

  // Helper to check if element is contentEditable
  function isContentEditable(
    el: HTMLTextAreaElement | HTMLInputElement | HTMLElement
  ): el is HTMLElement {
    return (
      "contentEditable" in el && (el as HTMLElement).contentEditable === "true"
    );
  }

  // Helper to get text content from element
  function getElementValue(
    el: HTMLTextAreaElement | HTMLInputElement | HTMLElement
  ): string {
    if (isContentEditable(el)) {
      return el.textContent || "";
    }
    return (el as HTMLTextAreaElement | HTMLInputElement).value || "";
  }

  // Helper to set text content to element
  function setElementValue(
    el: HTMLTextAreaElement | HTMLInputElement | HTMLElement,
    value: string
  ) {
    if (isContentEditable(el)) {
      el.textContent = value;
    } else {
      (el as HTMLTextAreaElement | HTMLInputElement).value = value;
    }
  }

  // Helper to get selection for contentEditable
  function getContentEditableSelection(
    el: HTMLElement
  ): { start: number; end: number } | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(el);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;
    const end = start + range.toString().length;

    return { start, end };
  }

  // Helper to set cursor position for contentEditable
  function setContentEditableCursor(el: HTMLElement, position: number) {
    const range = document.createRange();
    const sel = window.getSelection();
    if (!sel) return;

    let charCount = 0;
    let nodeStack = [el];
    let node: Node | undefined;
    let foundNode: Node | null = null;
    let foundOffset = 0;

    while ((node = nodeStack.pop())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const textNode = node as Text;
        const nextCharCount = charCount + (textNode.textContent?.length || 0);
        if (position >= charCount && position <= nextCharCount) {
          foundNode = textNode;
          foundOffset = position - charCount;
          break;
        }
        charCount = nextCharCount;
      } else {
        const children = Array.from(node.childNodes);
        for (let i = children.length - 1; i >= 0; i--) {
          nodeStack.push(children[i]);
        }
      }
    }

    if (foundNode) {
      range.setStart(foundNode, foundOffset);
      range.setEnd(foundNode, foundOffset);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
  type Mode = "writer" | "rewriter" | "proofreader";
  let mode = $state<Mode>("writer");

  let prompt = $state("");
  let context = $state("");
  let isGenerating = $state(false);
  let error = $state("");
  let showOptions = $state(false);
  let showLanguages = $state(false);
  let apiAvailable = $state<"available" | "after-download" | "unavailable">(
    "unavailable"
  );

  let selectionStart = $state<number | null>(null);
  let selectionEnd = $state<number | null>(null);
  let textBeforeSelection = $state("");
  let textAfterSelection = $state("");

  let writerTone = $state<"formal" | "neutral" | "casual">("neutral");
  let writerLength = $state<"short" | "medium" | "long">("medium");
  let writerFormat = $state<"markdown" | "plain-text">("plain-text");

  let rewriterTone = $state<"as-is" | "more-formal" | "more-casual">("as-is");
  let rewriterLength = $state<"as-is" | "shorter" | "longer">("as-is");
  let rewriterFormat = $state<"as-is" | "markdown" | "plain-text">("as-is");

  let proofreaderInputLangs = $state({
    en: true,
    fr: false,
    ja: false,
    pt: false,
    es: false,
  });

  let outputLanguage = $state("en");

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

  let abortController: AbortController | null = null;
  let streamedContent = $state("");

  $effect(() => {
    const checkAvailability = async () => {
      const availability =
        mode === "writer"
          ? await checkWriterAvailability()
          : mode === "rewriter"
            ? await checkRewriterAvailability()
            : await checkProofreaderAvailability();

      apiAvailable = availability;

      const apiName =
        mode === "writer"
          ? "Writer"
          : mode === "rewriter"
            ? "Rewriter"
            : "Proofreader";

      if (availability === "unavailable") {
        // Fallback will be used automatically via prompt API
        error = "";
      } else if (availability === "after-download") {
        error = `${apiName} API is downloading. Please wait and try again in a few moments.`;
      } else {
        error = "";
      }
    };

    checkAvailability();
  });

  $effect(() => {
    if (targetElement) {
      const value = getElementValue(targetElement);
      if (value) {
        context = value;
      }
    }

    if ((mode === "rewriter" || mode === "proofreader") && targetElement) {
      let start = 0;
      let end = 0;

      if (isContentEditable(targetElement)) {
        const selection = getContentEditableSelection(targetElement);
        if (selection) {
          start = selection.start;
          end = selection.end;
        }
      } else {
        start =
          (targetElement as HTMLTextAreaElement | HTMLInputElement)
            .selectionStart || 0;
        end =
          (targetElement as HTMLTextAreaElement | HTMLInputElement)
            .selectionEnd || 0;
      }

      if (start !== end) {
        const value = getElementValue(targetElement);
        const selectedText = value.substring(start, end);
        prompt = selectedText;
        selectionStart = start;
        selectionEnd = end;
        textBeforeSelection = value.substring(0, start);
        textAfterSelection = value.substring(end);
      } else {
        selectionStart = null;
        selectionEnd = null;
        textBeforeSelection = "";
        textAfterSelection = "";
      }
    }
  });

  $effect(() => {
    setTimeout(() => {
      const input = document.querySelector(".prompt-input") as HTMLInputElement;
      const textarea = document.querySelector(
        ".prompt-textarea"
      ) as HTMLTextAreaElement;
      if (mode === "writer" && input) {
        input.focus();
      } else if ((mode === "rewriter" || mode === "proofreader") && textarea) {
        textarea.focus();
      }
    }, 0);
  });

  async function handleGenerate() {
    if (!prompt.trim()) {
      error =
        mode === "writer"
          ? "Please enter a prompt"
          : mode === "rewriter"
            ? "Please enter text to rewrite"
            : "Please enter text to proofread";
      return;
    }

    isGenerating = true;
    error = "";
    streamedContent = "";

    abortController = new AbortController();

    try {
      const selectedInputLangs = Object.entries(inputLangs)
        .filter(([_, checked]) => checked)
        .map(([lang]) => lang);

      const selectedContextLangs = Object.entries(contextLangs)
        .filter(([_, checked]) => checked)
        .map(([lang]) => lang);

      if (mode === "writer") {
        const options: WriterOptions = {
          tone: writerTone,
          length: writerLength,
          format: writerFormat,
          ...(context.trim() && { sharedContext: context.trim() }),
          ...(outputLanguage && outputLanguage !== "" && { outputLanguage }),
          ...(selectedInputLangs.length > 0 && {
            expectedInputLanguages: selectedInputLangs,
          }),
          ...(selectedContextLangs.length > 0 && {
            expectedContextLanguages: selectedContextLangs,
          }),
        };

        const stream = writeContentStreaming(
          {
            prompt: prompt.trim(),
          },
          options
        );

        const initialValue = targetElement
          ? getElementValue(targetElement)
          : "";
        const separator = initialValue ? "\n\n" : "";

        for await (const chunk of stream) {
          if (abortController?.signal.aborted) {
            console.warn("[Writer API] Generation stopped by user");
            break;
          }

          streamedContent = "Writer" in self ? streamedContent + chunk : chunk;

          if (targetElement) {
            setElementValue(
              targetElement,
              initialValue + separator + streamedContent
            );
            targetElement.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
      } else if (mode === "rewriter") {
        const options: RewriterOptions = {
          tone: rewriterTone,
          length: rewriterLength,
          format: rewriterFormat,
          ...(context.trim() && { sharedContext: context.trim() }),
          ...(outputLanguage && outputLanguage !== "" && { outputLanguage }),
          ...(selectedInputLangs.length > 0 && {
            expectedInputLanguages: selectedInputLangs,
          }),
          ...(selectedContextLangs.length > 0 && {
            expectedContextLanguages: selectedContextLangs,
          }),
        };

        const stream = rewriteContentStreaming(
          {
            text: prompt.trim(),
          },
          options
        );

        for await (const chunk of stream) {
          if (abortController?.signal.aborted) {
            console.warn("[Rewriter API] Rewriting stopped by user");
            break;
          }

          streamedContent =
            "Rewriter" in self ? streamedContent + chunk : chunk;

          if (targetElement) {
            if (selectionStart !== null && selectionEnd !== null) {
              setElementValue(
                targetElement,
                textBeforeSelection + streamedContent + textAfterSelection
              );

              const newCursorPosition =
                textBeforeSelection.length + streamedContent.length;
              if (isContentEditable(targetElement)) {
                setContentEditableCursor(targetElement, newCursorPosition);
              } else {
                (
                  targetElement as HTMLTextAreaElement | HTMLInputElement
                ).setSelectionRange(newCursorPosition, newCursorPosition);
              }
            } else {
              setElementValue(targetElement, streamedContent);
            }
            targetElement.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
      } else if (mode === "proofreader") {
        const selectedProofreaderLangs = Object.entries(proofreaderInputLangs)
          .filter(([_, checked]) => checked)
          .map(([lang]) => lang);

        const options: ProofreaderOptions = {
          ...(selectedProofreaderLangs.length > 0 && {
            expectedInputLanguages: selectedProofreaderLangs,
          }),
        };

        const stream = proofreadContentStreaming(
          {
            text: prompt.trim(),
          },
          options
        );

        for await (const chunk of stream) {
          if (abortController?.signal.aborted) {
            console.warn("[Proofreader API] Proofreading stopped by user");
            break;
          }

          // Accumulate chunks for fallback (incremental), built-in API returns full text in first chunk
          streamedContent = streamedContent ? streamedContent + chunk : chunk;

          if (targetElement) {
            if (selectionStart !== null && selectionEnd !== null) {
              setElementValue(
                targetElement,
                textBeforeSelection + streamedContent + textAfterSelection
              );
              const newCursorPosition =
                textBeforeSelection.length + streamedContent.length;
              if (isContentEditable(targetElement)) {
                setContentEditableCursor(targetElement, newCursorPosition);
              } else {
                (
                  targetElement as HTMLTextAreaElement | HTMLInputElement
                ).setSelectionRange(newCursorPosition, newCursorPosition);
              }
            } else {
              setElementValue(targetElement, streamedContent);
            }
            targetElement.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
      }

      if (targetElement && streamedContent) {
        if (mode === "writer") {
          targetElement.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          targetElement.dispatchEvent(new Event("change", { bubbles: true }));
        }

        targetElement.focus();
      }

      if (!abortController?.signal.aborted && streamedContent) {
        const successMessage =
          mode === "writer"
            ? "Content generated!"
            : mode === "rewriter"
              ? "Content rewritten!"
              : "Content proofread!";
        showSuccessNotification(successMessage);

        setTimeout(() => {
          onClose?.();
        }, 500);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.debug(
          `[${mode === "writer" ? "Writer" : mode === "rewriter" ? "Rewriter" : "Proofreader"} API] Generation aborted`
        );
      } else {
        console.error(
          `[${mode === "writer" ? "Writer" : mode === "rewriter" ? "Rewriter" : "Proofreader"} API] Error:`,
          err
        );
        error =
          err instanceof Error ? err.message : "Failed to generate content";
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

  function showSuccessNotification(message: string = "✓ Content generated!") {
    const notification = document.createElement("div");
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

    const style = document.createElement("style");
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

    setTimeout(() => {
      notification.style.animation = "slideIn 0.3s ease-out reverse";
      setTimeout(() => {
        notification.remove();
        style.remove();
      }, 300);
    }, 2000);
  }

  function handleResetOptions() {
    writerTone = "neutral";
    writerLength = "medium";
    writerFormat = "plain-text";

    rewriterTone = "as-is";
    rewriterLength = "as-is";
    rewriterFormat = "as-is";

    proofreaderInputLangs = {
      en: true,
      fr: false,
      ja: false,
      pt: false,
      es: false,
    };

    outputLanguage = "en";
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
    context = "";
  }

  function handleWriterMode() {
    mode = "writer";
  }

  function handleRewriterMode() {
    mode = "rewriter";
  }

  function handleProofreaderMode() {
    mode = "proofreader";
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      if (isGenerating) {
        handleStop();
      }
      onClose?.();
    }
    if (
      event.key === "Enter" &&
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
        class:active={mode === "writer"}
      >
        Writer
      </button>
      <button
        class="header-btn mode-btn rewriter-btn"
        onclick={handleRewriterMode}
        type="button"
        aria-label="Rewriter mode"
        disabled={isGenerating}
        class:active={mode === "rewriter"}
      >
        Rewriter
      </button>
      <!-- <button
        class="header-btn mode-btn proofreader-btn"
        onclick={handleProofreaderMode}
        type="button"
        aria-label="Proofreader mode"
        disabled={isGenerating}
        class:active={mode === 'proofreader'}
      >
        Proofreader
      </button> -->
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
    <div class="input-wrapper">
      <textarea
        type="text"
        bind:value={prompt}
        placeholder={`Add prompt to ${
          mode === "writer"
            ? "write"
            : mode === "rewriter"
              ? "rewrite"
              : "proofread"
        } here...`}
        class="prompt-textarea"
        rows="3"
        disabled={isGenerating}
      ></textarea>
      {#if selectionStart !== null && selectionEnd !== null}
        <div class="selection-info">
          ✓ {mode === "rewriter" ? "Rewriting" : "Proofreading"} selected text only
          ({selectionEnd - selectionStart} chars)
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

    {#if showOptions}
      <div class="options-panel" transition:slide={{ duration: 200 }}>
        <div class="field">
          <label for="context">Context (optional)</label>
          <textarea
            id="context"
            bind:value={context}
            placeholder="Add background information... e.g., I'm a long-standing customer..."
            rows="3"
            disabled={isGenerating}
          ></textarea>
        </div>

        <div class="field-row field-row-3">
          <div class="field">
            <label for="tone">Tone</label>
            {#if mode === "writer"}
              <select id="tone" bind:value={writerTone} disabled={isGenerating}>
                <option value="formal">Formal</option>
                <option value="neutral">Neutral</option>
                <option value="casual">Casual</option>
              </select>
            {:else if mode === "rewriter"}
              <select
                id="tone"
                bind:value={rewriterTone}
                disabled={isGenerating}
              >
                <option value="as-is">As-Is</option>
                <option value="more-formal">More Formal</option>
                <option value="more-casual">More Casual</option>
              </select>
            {:else}
              <!-- Proofreader mode doesn't have tone options -->
              <select disabled>
                <option>N/A</option>
              </select>
            {/if}
          </div>

          <div class="field">
            <label for="length">Length</label>
            {#if mode === "writer"}
              <select
                id="length"
                bind:value={writerLength}
                disabled={isGenerating}
              >
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            {:else if mode === "rewriter"}
              <select
                id="length"
                bind:value={rewriterLength}
                disabled={isGenerating}
              >
                <option value="as-is">As-Is</option>
                <option value="shorter">Shorter</option>
                <option value="longer">Longer</option>
              </select>
            {:else}
              <!-- Proofreader mode doesn't have length options -->
              <select disabled>
                <option>N/A</option>
              </select>
            {/if}
          </div>

          <div class="field">
            <label for="format">Format</label>
            {#if mode === "writer"}
              <select
                id="format"
                bind:value={writerFormat}
                disabled={isGenerating}
              >
                <option value="plain-text">Plain Text</option>
                <option value="markdown">Markdown</option>
              </select>
            {:else if mode === "rewriter"}
              <select
                id="format"
                bind:value={rewriterFormat}
                disabled={isGenerating}
              >
                <option value="as-is">As-Is</option>
                <option value="plain-text">Plain Text</option>
                <option value="markdown">Markdown</option>
              </select>
            {:else}
              <!-- Proofreader mode doesn't have format options -->
              <select disabled>
                <option>N/A</option>
              </select>
            {/if}
          </div>
        </div>

        <div class="field">
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

        {#if mode === "proofreader"}
          <div class="field">
            <fieldset class="checkbox-fieldset">
              <legend>Expected Input Languages</legend>
              <div class="checkbox-group">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={proofreaderInputLangs.en}
                    disabled={isGenerating}
                  />
                  <span>English</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={proofreaderInputLangs.fr}
                    disabled={isGenerating}
                  />
                  <span>French</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={proofreaderInputLangs.ja}
                    disabled={isGenerating}
                  />
                  <span>Japanese</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={proofreaderInputLangs.pt}
                    disabled={isGenerating}
                  />
                  <span>Portuguese</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={proofreaderInputLangs.es}
                    disabled={isGenerating}
                  />
                  <span>Spanish</span>
                </label>
              </div>
            </fieldset>
          </div>
        {/if}
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
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
      Ubuntu, Cantarell, sans-serif;
    font-size: 14px;
    color: #e4e4e7;
    overflow: hidden;
  }

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

  .error-banner {
    background: #7f1d1d;
    color: #fca5a5;
    padding: 8px 16px;
    font-size: 12px;
    border-bottom: 1px solid #991b1b;
  }

  .content {
    overflow: auto;
    overscroll-behavior: none;
    max-height: 50vh;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    scrollbar-width: thin;
    scrollbar-color: #52525b transparent;
  }

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
    transition:
      color 0.15s ease,
      background 0.15s ease;
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

  input[type="text"] {
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

  input[type="text"]::placeholder {
    color: #71717a;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: #3b82f6;
  }

  input[type="text"]:disabled {
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

  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: #3b82f6;
  }

  .checkbox-label input[type="checkbox"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .checkbox-label span {
    user-select: none;
  }

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
