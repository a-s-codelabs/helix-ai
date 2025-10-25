<script lang="ts">
  import MicIcon from "./icons/Mic.svelte";
  import AttachmentIcon from "./icons/Attachment.svelte";
  import UpIcon from "./icons/Up.svelte";
  import DownIcon from "./icons/Down.svelte";
  import SearchIcon from "./icons/Search.svelte";
  import SearchAiIcon from "./icons/SearchAi.svelte";
  import CloseIcon from "./icons/Close.svelte";
  import type { InputProps, State } from "./type";
  import SendIcon from "./icons/Send.svelte";
  import StopIcon from "./icons/Stop.svelte";

  let {
    inputState = $bindable("search" as State),
    inputValue = $bindable(""),
    placeholder = "Find or ask...",
    searchIndex = 0,
    totalResults = 0,
    isExpanded = false,
    disabled = false,
    inputImageAttached = $bindable([] as string[]),
    suggestedQuestions = [] as string[],
    isStreaming = false,
    onInput,
    onStateChange,
    onAsk,
    onVoiceInput,
    onAttachment,
    onClear,
    onSuggestedQuestion,
    onSearchNavigation,
    onClose,
    onStop,
  }: InputProps = $props();

  // Check if we're in side panel mode
  let isInSidePanel = $state(false);

  $effect(() => {
    // Check if we're in a side panel context
    isInSidePanel = window.location.pathname.includes('sidepanel') ||
                   window.location.href.includes('sidepanel') ||
                   document.title.includes('Side Panel');
  });

  // Dynamic placeholder based on side panel mode
  let dynamicPlaceholder = $derived(isInSidePanel ? "Ask..." : placeholder);

  let inputElement: HTMLTextAreaElement;
  let inputBarElement: HTMLDivElement;
  const CHAR_EXPAND_LIMIT = 28;
  let isInputExpanded = $derived(
    inputValue.length > CHAR_EXPAND_LIMIT ||
      inputValue.includes("\n") ||
      inputImageAttached.length > 0
  );

  // Focus the input when the component becomes visible
  $effect(() => {
    if (inputElement && !disabled) {
      // Use a small delay to ensure the element is fully rendered
      setTimeout(() => {
        inputElement.focus();
        // Ensure the input is visible and ready for typing
        inputElement.select();
      }, 100);
    }
  });

  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    inputValue = target.value;
    onInput?.({ value: inputValue });

    // if (inputValue.includes("\n") || inputImageAttached.length > 0) {
    //   onStateChange?.({ state: "ask" });
    // } else {
    //   onStateChange?.({ state: "search" });
    // }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onAsk?.({ value: inputValue, images: inputImageAttached });
      // Reset input after submission
      resetInput();
    }
  }

  function handleAsk() {
    onAsk?.({ value: inputValue, images: inputImageAttached });
    // Reset input after submission
    resetInput();
  }

  function handleVoiceInput() {
    onVoiceInput?.();
  }

  function handleAttachment() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true;

    fileInput.onchange = (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        Array.from(files).forEach((file) => {
          if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = e.target?.result as string;
              if (result) {
                inputImageAttached = [...inputImageAttached, result];
              }
            };
            reader.readAsDataURL(file);
          }
        });
      }
    };

    fileInput.click();

    onAttachment?.();
  }

  function handleClose() {
    onStateChange?.({ state: "search" });
    resetInput();
    onClear?.();
    onClose?.();
  }

  function handleImageClose(image: string, idx: number) {
    inputImageAttached = inputImageAttached.filter((_, i) => i !== idx);
  }

  function handleSearchNavigation(direction: "up" | "down") {
    onSearchNavigation?.({ direction, currentIndex: searchIndex });
  }

  function handleStop() {
    onStop?.();
  }

  // Reusable function to reset input state - following DRY principles
  function resetInput() {
    inputValue = "";
    inputElement.value = "";
    inputImageAttached = [];
  }
</script>

<div
  class="telescope-container"
  class:expanded={isExpanded}
  class:reached-min-chars={inputValue.length >= 15 || isInputExpanded}
  class:sidepanel-mode={isInSidePanel}
>
  <div
    class="input-bar-container"
    class:is-expanded={isExpanded}
    class:input-expanded={isInputExpanded}
  >
    {#if inputImageAttached.length > 0}
      <div class="image-inputs-container">
        {#each inputImageAttached as image, idx}
          <div class="image-placeholder">
            {#if image}
              <img src={image} alt="" class="attached-image" />
            {/if}
            <button
              class="image-close-icon"
              onclick={() => handleImageClose(image, idx)}
            >
              <CloseIcon />
            </button>
          </div>
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
          {#if inputState === "search"}
            <SearchIcon />
          {:else}
            <SearchAiIcon />
          {/if}
        </div>
      {/if}
      <!-- svelte-ignore a11y_autofocus -->
      <textarea
        bind:this={inputElement}
        bind:value={inputValue}
        oninput={handleInput}
        onkeydown={handleKeydown}
        placeholder={dynamicPlaceholder}
        {disabled}
        class="input-field"
        class:input-expanded={isInputExpanded}
        rows="1"
        style="resize: none;"
        autofocus
      ></textarea>

      {#if inputState === "search" && !isInputExpanded}
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

        {#if inputState === "ask"}
          <button class="ask-button" onclick={handleAsk}> Ask </button>
        {/if}

        {#if inputState === "chat"}
          <button
            class="send-button"
            aria-label={isStreaming ? "Stop streaming" : "Send message"}
            onclick={isStreaming ? handleStop : handleAsk}
          >
            {#if isStreaming}
              <StopIcon />
            {:else}
              <SendIcon />
            {/if}
          </button>
        {:else}
          <button
            class="close-button"
            onclick={handleClose}
            title="Close"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        {/if}
      {/if}

      {#if isInputExpanded}
        <div class="expand-bar">
          <div class="icon search-icon">
            {#if inputState === "search"}
              <SearchIcon />
            {:else}
              <SearchAiIcon />
            {/if}
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

            {#if inputState === "ask"}
              <button class="ask-button" onclick={handleAsk}> Ask </button>
            {/if}

            {#if inputState === "chat"}
              <button
                class="send-button"
                aria-label={isStreaming ? "Stop streaming" : "Send message"}
                onclick={isStreaming ? handleStop : handleAsk}
              >
                {#if isStreaming}
                  <StopIcon />
                {:else}
                  <SendIcon />
                {/if}
              </button>
            {:else}
              <button
                class="close-button"
                onclick={handleClose}
                title="Close"
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap");

  textarea {
    field-sizing: content;
  }
  .telescope-container {
    position: relative;
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    margin-bottom: 20px;
    transition: all 0.3s ease;
    font-family:
      "Sora",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
  }
  .reached-min-chars {
    min-width: 600px;
  }

  /* Responsive adjustments */
  @media (max-width: 400px) {
    .telescope-container {
      max-width: 100%;
    }

    .reached-min-chars {
      min-width: 100%;
    }

    .input-bar-container {
      padding: 8px 12px;
    }

    .input-field {
      font-size: 14px;
      min-width: 150px;
    }
  }

  @media (max-width: 300px) {
    .telescope-container {
      max-width: 100%;
    }

    .reached-min-chars {
      min-width: 100%;
    }

    .input-bar-container {
      padding: 6px 10px;
    }

    .input-field {
      font-size: 13px;
      min-width: 120px;
    }

    .action-icons {
      gap: 4px;
    }

    .icon-button {
      padding: 6px;
    }
  }

  /* Side panel specific: Ensure all icons are always visible and input field adjusts */
  .telescope-container.sidepanel-mode .action-icons {
    display: flex;
    flex-shrink: 0; /* Prevent icons from shrinking */
  }

  .telescope-container.sidepanel-mode .icon-button {
    flex-shrink: 0; /* Prevent individual icon buttons from shrinking */
  }

  .telescope-container.sidepanel-mode .input-field {
    flex: 1;
    min-width: 100px; /* Allow input to shrink more in side panel */
  }

  .send-button {
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
  /* .telescope-container.expanded {
    max-width: 800px;
  } */

  .input-bar-container {
    display: flex;
    align-items: start;
    flex-direction: column;
    background: #262832;
    /* border: 1px solid #404040; */
    border-radius: 48px;
    padding: 12px 16px;
  }

  .input-bar-container.input-expanded {
    border-radius: 28px;
  }

  .input-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all 0.3s ease;
    position: relative;
    width: 100%;
    /* min-height: 48px; */
  }

  .image-inputs-container {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .image-placeholder:hover .attached-image {
    filter: brightness(0.85);
  }
  .image-placeholder {
    width: 110px;
    height: 110px;
    background: #131723;
    border-radius: 15px;
    position: relative;
    overflow: hidden;
  }

  .attached-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 15px;
  }
  .image-placeholder:hover .image-close-icon {
    display: block;
  }

  .image-close-icon {
    background: none;
    border: none;
    position: absolute;
    top: 5px;
    right: 5px;
    width: 20px;
    height: 20px;
    display: none;
    color: #d1d5db;
    cursor: pointer;
  }

  .image-close-icon:hover {
    color: white;
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
    padding: 8px 0px;
    min-height: auto;
    flex-direction: column;
  }

  .input-bar:hover {
    border-color: #555;
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
    max-height: 240px;
    line-height: 1.4;
    font-family: "Sora", inherit;
    resize: none;
    overflow: auto;
    overscroll-behavior: none;
    padding: 0;
    margin: 0;
    height: 24px;
    min-width: 200px;
  }
  .input-field.input-expanded {
    width: calc(100% - 24px);
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
</style>
