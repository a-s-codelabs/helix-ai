<script lang="ts">
  import { fly } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import MicIcon from "./icons/Mic.svelte";
  import AttachmentIcon from "./icons/Attachment.svelte";
  import UpIcon from "./icons/Up.svelte";
  import DownIcon from "./icons/Down.svelte";
  import SearchIcon from "./icons/Search.svelte";
  import CloseIcon from "./icons/Close.svelte";
  import type { State } from "./type";

  let {
    state = $bindable("empty" as State),
    inputValue = $bindable(""),
    placeholder = "Find or ask...",
    searchIndex = 1,
    totalResults = 19,
    summaryTitle = "",
    summaryContent = "",
    suggestedQuestions = [] as string[],
    disabled = false,
    onInput,
    onStateChange,
    onAsk,
    onVoiceInput,
    onAttachment,
    onClear,
    onSuggestedQuestion,
    onSearchNavigation,
    onClose,
  }: {
    state?: State;
    inputValue?: string;
    placeholder?: string;
    searchIndex?: number;
    totalResults?: number;
    summaryTitle?: string;
    summaryContent?: string;
    suggestedQuestions?: string[];
    disabled?: boolean;
    onInput?: ({ value }: { value: string }) => void;
    onStateChange?: ({ state }: { state: State }) => void;
    onAsk?: ({ value }: { value: string }) => void;
    onVoiceInput?: () => void;
    onAttachment?: () => void;
    onClear?: () => void;
    onSuggestedQuestion?: ({ question }: { question: string }) => void;
    onSearchNavigation?: ({
      direction,
      currentIndex,
    }: {
      direction: "up" | "down";
      currentIndex: number;
    }) => void;
    onClose?: () => void;
  } = $props();

  let inputElement: HTMLTextAreaElement;
  let inputBarElement: HTMLDivElement;
  const CHAR_EXPAND_LIMIT = 40;
  let isExpanded = $derived(state === "summary");
  let isInputExpanded = $derived(
    inputValue.length > CHAR_EXPAND_LIMIT || inputValue.includes("\n")
  );

  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    inputValue = target.value;
    onInput?.({ value: inputValue });

    autoResize(target);

    if (inputValue.length > 0 && state === "empty") {
      onStateChange?.({ state: "filled" });
    } else if (inputValue.length === 0 && state === "filled") {
      onStateChange?.({ state: "empty" });
    }
  }

  function autoResize(textarea: HTMLTextAreaElement) {
    textarea.style.height = "auto";
    textarea.style.height = Math.max(12, textarea.scrollHeight) + "px";
    if (isInputExpanded) {
      inputBarElement.style.height =
        Math.max(12, textarea.scrollHeight + 45) + "px";
    } else {
      inputBarElement.style.height = "auto";
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onAsk?.({ value: inputValue });
    }
  }

  function handleAsk() {
    onAsk?.({ value: inputValue });
  }

  function handleVoiceInput() {
    onVoiceInput?.();
  }

  function handleAttachment() {
    onAttachment?.();
  }

  function handleClose() {
    if (state === "summary") {
      onStateChange?.({ state: "empty" });
    } else {
      inputValue = "";
      inputElement.value = "";
      onClear?.();
    }
    onClose?.();
  }

  function handleSuggestedQuestion(question: string) {
    inputValue = question;
    inputElement.value = question;
    onSuggestedQuestion?.({ question });
  }

  function handleSearchNavigation(direction: "up" | "down") {
    onSearchNavigation?.({ direction, currentIndex: searchIndex });
  }

  // Effect to auto-resize on mount and when inputValue changes
  $effect(() => {
    if (inputElement && inputBarElement && isInputExpanded) {
      autoResize(inputElement);
    }
  });
</script>

<div class="telescope-container" class:expanded={isExpanded}>
  {#if suggestedQuestions.length > 0}
    <div class="suggested-questions">
      {#each suggestedQuestions as question}
        <button
          class="suggested-question"
          onclick={() => handleSuggestedQuestion(question)}
        >
          {question}
        </button>
      {/each}
    </div>
  {/if}

  <div
    class="input-bar"
    bind:this={inputBarElement}
    class:disabled
    class:input-expanded={isInputExpanded}
  >
    {#if !isInputExpanded}
      <div class="icon search-icon">
        <SearchIcon />
      </div>
    {/if}
    <textarea
      bind:this={inputElement}
      bind:value={inputValue}
      oninput={handleInput}
      onkeydown={handleKeydown}
      {placeholder}
      {disabled}
      class="input-field"
      class:input-expanded={isInputExpanded}
      rows="1"
      style="resize: none; overflow: hidden;"
    ></textarea>

    {#if state === "search" && inputValue.length > 0}
      <div class="search-navigation">
        <span class="search-counter">{searchIndex}/{totalResults}</span>
        <button
          class="nav-button"
          onclick={() => handleSearchNavigation("up")}
          disabled={searchIndex <= 1}
          aria-label="Previous result"
        >
          <UpIcon />
        </button>
        <button
          class="nav-button"
          onclick={() => handleSearchNavigation("down")}
          disabled={searchIndex >= totalResults}
          aria-label="Next result"
        >
          <DownIcon />
        </button>
      </div>
    {/if}

    {#if !isInputExpanded}
      <div class="separator"></div>

      <div class="action-icons">
        <button
          class="icon-button"
          onclick={handleVoiceInput}
          title="Voice input"
          aria-label="Voice input"
        >
          <MicIcon />
        </button>

        <button
          class="icon-button"
          onclick={handleAttachment}
          title="Attach file"
          aria-label="Attach file"
        >
          <AttachmentIcon />
        </button>
      </div>

      {#if state === "filled" && inputValue.length > 0}
        <button class="ask-button" onclick={handleAsk}> Ask </button>
      {/if}

      <button
        class="close-button"
        onclick={handleClose}
        title="Close"
        aria-label="Close"
      >
        <CloseIcon />
      </button>
    {/if}

    {#if isInputExpanded}
      <div class="expand-bar">
        <div class="icon search-icon">
          <SearchIcon />
        </div>
        <div class="expand-bar-content">
          <div class="action-icons">
            <button
              class="icon-button"
              onclick={handleVoiceInput}
              title="Voice input"
              aria-label="Voice input"
            >
              <MicIcon />
            </button>

            <button
              class="icon-button"
              onclick={handleAttachment}
              title="Attach file"
              aria-label="Attach file"
            >
              <AttachmentIcon />
            </button>
          </div>
          <div class="separator"></div>

          {#if state === "filled" && inputValue.length > 0}
            <button class="ask-button" onclick={handleAsk}> Ask </button>
          {/if}

          <button
            class="close-button"
            onclick={handleClose}
            title="Close"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap");

  .telescope-container {
    position: relative;
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    transition: all 0.3s ease;
    font-family:
      "Sora",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
  }

  /* .telescope-container.expanded {
    max-width: 800px;
  } */

  .input-bar {
    display: flex;
    align-items: center;
    background: #262832;
    border: 1px solid #404040;
    border-radius: 48px;
    padding: 12px 16px;
    gap: 12px;
    transition: all 0.3s ease;
    position: relative;
    /* min-height: 48px; */
  }

  .expand-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .expand-bar-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .input-bar.input-expanded {
    align-items: flex-start;
    padding: 16px;
    min-height: auto;
    flex-direction: column;
  }

  .input-bar:hover {
    border-color: #555;
  }

  .input-bar:focus-within {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .input-bar.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    flex-shrink: 0;
  }

  .input-bar.input-expanded .icon {
    align-items: flex-start;
    padding-top: 2px;
  }

  .search-icon {
    color: #d1d5db;
  }

  .input-field {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #ffffff;
    font-size: 16px;
    font-weight: 500;
    min-width: 0;
    min-height: 24px;
    line-height: 1.4;
    font-family: "Sora", inherit;
    resize: none;
    overflow: hidden;
    padding: 0;
    margin: 0;
    height: 24px;
  }
  .input-field.input-expanded {
    width: 100%;
  }

  .input-field::placeholder {
    color: #9ca3af;
  }

  .search-navigation {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #9ca3af;
    font-size: 14px;
  }

  .search-counter {
    font-size: 14px;
    color: #d1d5db;
  }

  .nav-button {
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

  .nav-button:hover:not(:disabled) {
    background: #404040;
    color: #d1d5db;
  }

  .nav-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .separator {
    width: 1px;
    height: 24px;
    background: #404040;
    flex-shrink: 0;
  }

  .input-bar.input-expanded .separator {
    align-self: flex-start;
    margin-top: 2px;
  }

  .action-icons {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .input-bar.input-expanded .action-icons {
    align-items: flex-start;
    padding-top: 2px;
  }

  .icon-button {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 8px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .icon-button:hover {
    background: #404040;
    color: #d1d5db;
  }

  .ask-button {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .input-bar.input-expanded .ask-button {
    align-self: flex-start;
    margin-top: 2px;
  }

  .ask-button:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .close-button {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 8px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .input-bar.input-expanded .close-button {
    align-self: flex-start;
    margin-top: 2px;
  }

  .close-button:hover {
    background: #404040;
    color: #d1d5db;
  }
  .suggested-questions {
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
    padding: 0 0px 20px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    overflow-x: auto;
    scroll-padding-inline-start: 0px;
    /* Hide scrollbar for Webkit browsers */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
  }
  .suggested-questions::-webkit-scrollbar {
    display: none; /* Safari and Chrome */
  }

  .suggested-question {
    background: #262832;
    color: #d1d5db;
    border: 1px solid #404040;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex: 0 0 auto;
  }

  .suggested-question:hover {
    background: #404040;
    border-color: #555;
  }

  .follow-up-input {
    display: flex;
    align-items: center;
    background: #262832;
    border-top: 1px solid #404040;
    padding: 16px 20px;
    gap: 12px;
  }

  .follow-up-field {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #ffffff;
    font-size: 14px;
  }

  .follow-up-field::placeholder {
    color: #9ca3af;
  }

  /* Animations */
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .ask-button {
    animation: fadeIn 0.3s ease;
  }

  .summary-panel {
    animation: fadeIn 0.4s ease;
  }
</style>
