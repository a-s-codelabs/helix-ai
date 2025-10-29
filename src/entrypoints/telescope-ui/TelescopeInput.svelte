<script lang="ts">
  import MicIcon from "./icons/Mic.svelte";
  import AttachmentIcon from "./icons/Attachment.svelte";
  import SearchAiIcon from "./icons/SearchAi.svelte";
  import CloseIcon from "./icons/Close.svelte";
  import SettingsIcon from "./icons/Settings.svelte";
  import type { InputProps, State } from "./type";
  import SendIcon from "./icons/Send.svelte";
  import StopIcon from "./icons/Stop.svelte";
  import { globalStorage } from "@/lib/globalStorage";
  // intent icons
  import AddToChat from "./icons/AddToChat.svelte";
  import SummariseIcon from "./icons/Summarise.svelte";
  import TranslateIcon from "./icons/Translate.svelte";
  import WriterIcon from "./icons/Writer.svelte";
  import RewriterIcon from "./icons/Rewriter.svelte";

  let {
    inputState = $bindable("ask" as State),
    inputValue = $bindable(""),
    placeholder = "Summarize this site...",
    isExpanded = false,
    quotedContent = $bindable([]),
    disabled = false,
    inputImageAttached = $bindable([] as string[]),
    isStreaming = false,
    hasChatBox = false,
    onInput,
    onStateChange,
    onAsk,
    onVoiceInput,
    onAttachment,
    onClear,
    onClose,
    onStop,
  }: InputProps = $props();

  let isInSidePanel = $state(false);

  // Hover menu for search icon: choose intent and adapt placeholder
  type Intent = "prompt" | "summarise" | "translate" | "write" | "rewrite";
  let showIntentMenu = $state(false);
  let selectedIntent = $state<Intent>("summarise");

  const intentToPlaceholder: Record<Intent, string> = {
    prompt: "Ask...",
    summarise: "Summarize this site...",
    translate: "Translate this content...",
    write: "Write content...",
    rewrite: "Rewrite selected text...",
  };

  $effect(() => {
    isInSidePanel =
      window.location.pathname.includes("sidepanel") ||
      window.location.href.includes("sidepanel") ||
      document.title.includes("Side Panel");
  });

  // Dynamic placeholder based on side panel mode and selected intent
  let dynamicPlaceholder = $derived(
    (() => {
      // If consumer provided a custom placeholder, prefer it for non-sidepanel when intent is summarise (default)
      const base = intentToPlaceholder[selectedIntent] ?? "Ask...";
      if (isInSidePanel) return selectedIntent === "summarise" ? "Ask..." : base;
      // Outside sidepanel, allow component-supplied placeholder for summarise intent
      return selectedIntent === "summarise" ? placeholder : base;
    })()
  );

  let inputElement: HTMLTextAreaElement;
  let inputBarElement: HTMLDivElement;
  const CHAR_EXPAND_LIMIT = 28;
  // let quotedContent = $state<string[]>([]);
  let isInputExpanded = $derived(
    inputValue.length > CHAR_EXPAND_LIMIT ||
      inputValue.includes("\n") ||
      quotedContent.length > 0 ||
      inputImageAttached.length > 0
  );

  // Detect when inputValue is set from outside (like add to chat)
  // $effect(() => {
  //   // If inputValue has content, it might be from add to chat
  //   // Store it as quoted content and clear inputValue
  //   if (inputValue && inputValue.trim()) {
  //     // Check if this looks like content that should be quoted (not user input)
  //     // We'll use a simple heuristic: if it's longer than 20 chars, it's probably quoted content
  //     if (inputValue.length > 20) {
  //       // Add to array instead of replacing
  //       quotedContent = [...quotedContent, inputValue];
  //       inputValue = "";
  //     }
  //   }
  // });

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
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      // Prepend quoted content if it exists
      const quotedText =
        quotedContent.length > 0
          ? quotedContent.join("\n\n---\n\n") + "\n\n"
          : "";
      const finalMessage = quotedText + inputValue;
      onAsk?.({ value: finalMessage, images: inputImageAttached });
      resetInput();
    }
  }

  function handleAsk() {
    // Prepend quoted content if it exists
    const quotedText =
      quotedContent.length > 0
        ? quotedContent.join("\n\n---\n\n") + "\n\n"
        : "";
    const finalMessage = quotedText + inputValue;
    onAsk?.({ value: finalMessage, images: inputImageAttached });
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
    onStateChange?.({ state: "ask" });
    resetInput();
    onClear?.();
    onClose?.();
  }

  function handleImageClose(image: string, idx: number) {
    inputImageAttached = inputImageAttached.filter((_, i) => i !== idx);
  }

  function handleStop() {
    onStop?.();
  }

  function handleClearQuoted(index: number) {
    quotedContent = quotedContent.filter((_, i) => i !== index);
  }

  // Reusable function to reset input state - following DRY principles
  function resetInput() {
    inputValue = "";
    inputElement.value = "";
    inputImageAttached = [];
    quotedContent = [];
  }
</script>

<div
  class="telescope-container"
  class:expanded={isExpanded}
  class:reached-min-chars={true}
  class:sidepanel-mode={isInSidePanel}
>
  <div
    class="input-bar-container"
    class:is-in-sidepanel={isInSidePanel}
    class:has-chat-box={hasChatBox}
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

    {#if quotedContent.length > 0}
      <div class="quoted-content-container">
        <div class="quoted-content-list">
          {#each quotedContent as content, index}
            <div class="quoted-content-item">
              <div class="quoted-text">{content}</div>
              <button
                class="quoted-close-icon"
                onclick={() => handleClearQuoted(index)}
                title="Remove quoted content"
              >
                <CloseIcon />
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div
      class="input-bar"
      bind:this={inputBarElement}
      class:disabled
      class:input-expanded={isInputExpanded}
    >
      {#if !isInputExpanded}
        <div
          class="icon search-icon intent-trigger"
          onmouseenter={() => (showIntentMenu = true)}
          onmouseleave={() => (showIntentMenu = false)}
        >
          <SearchAiIcon />
          {#if showIntentMenu}
            <div class="intent-menu" role="menu">
              <button class="intent-item" role="menuitem" onclick={() => (selectedIntent = "prompt")}>
                <span class="intent-icon-circle"><AddToChat /></span>
                <span>Prompt</span>
              </button>
              <button class="intent-item" role="menuitem" onclick={() => (selectedIntent = "summarise")}>
                <span class="intent-icon-circle"><SummariseIcon /></span>
                <span>Summarise</span>
              </button>
              <button class="intent-item" role="menuitem" onclick={() => (selectedIntent = "translate")}>
                <span class="intent-icon-circle"><TranslateIcon /></span>
                <span>Translate</span>
              </button>
              <button class="intent-item" role="menuitem" onclick={() => (selectedIntent = "write")}>
                <span class="intent-icon-circle intent-icon-circle--large"><WriterIcon /></span>
                <span>Write</span>
              </button>
              <button class="intent-item" role="menuitem" onclick={() => (selectedIntent = "rewrite")}>
                <span class="intent-icon-circle intent-icon-circle--large"><RewriterIcon /></span>
                <span>Rewrite</span>
              </button>
            </div>
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

      {#if !isInputExpanded}
        <!-- Settings icon placed to the left of the vertical separator -->
        <button
          class="icon-button"
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon />
        </button>

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
          <div class="ask-button-container">
            <button class="ask-button" onclick={handleAsk}>Ask</button>
            {#if !isInSidePanel}
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
          <!-- {:else}
          <button
            class="close-button"
            onclick={handleClose}
            title="Close"
            aria-label="Close"
          >
            <CloseIcon />
          </button> -->
        {/if}
      {/if}

      {#if isInputExpanded}
        <div class="expand-bar">
          <div
            class="icon search-icon intent-trigger"
            onmouseenter={() => (showIntentMenu = true)}
            onmouseleave={() => (showIntentMenu = false)}
          >
            <SearchAiIcon />
            {#if showIntentMenu}
              <div class="intent-menu" role="menu">
                <button class="intent-item" role="menuitem" onclick={() => (selectedIntent = "prompt")}>
                  <span class="intent-icon-circle"><AddToChat /></span>
                  <span>Prompt</span>
                </button>
                <button class="intent-item" role="menuitem" onclick={() => (selectedIntent = "summarise")}>
                  <span class="intent-icon-circle"><SummariseIcon /></span>
                  <span>Summarise</span>
                </button>
                <button class="intent-item" role="menuitem" onclick={() => (selectedIntent = "translate")}>
                  <span class="intent-icon-circle"><TranslateIcon /></span>
                  <span>Translate</span>
                </button>
                <button class="intent-item" role="menuitem" onclick={() => (selectedIntent = "write")}>
                  <span class="intent-icon-circle intent-icon-circle--large"><WriterIcon /></span>
                  <span>Write</span>
                </button>
                <button class="intent-item" role="menuitem" onclick={() => (selectedIntent = "rewrite")}>
                  <span class="intent-icon-circle intent-icon-circle--large"><RewriterIcon /></span>
                  <span>Rewrite</span>
                </button>
              </div>
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
              <div class="ask-button-container">
                <button class="ask-button" onclick={handleAsk}> Ask </button>
                {#if !isInSidePanel}
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

  /* Remove min-width constraint in side panel mode */
  .telescope-container.sidepanel-mode.reached-min-chars {
    min-width: 0;
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
  .telescope-container.sidepanel-mode {
    max-width: 100%; /* Remove fixed max-width constraint for side panel */
    width: 100%; /* Ensure container takes full width */
  }

  /* Ensure input bar container takes full width in side panel */
  .telescope-container.sidepanel-mode .input-bar-container {
    max-width: 100%;
  }

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
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
    align-self: center;
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

  .input-bar-container.is-in-sidepanel {
    margin: auto;
    width: calc(100% - 64px);
  }
  .input-bar-container.is-in-sidepanel.has-chat-box {
    margin: 0;
  }
  .input-bar-container.input-expanded {
    border-radius: 28px;
  }

  .input-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
    position: relative;
    width: 100%;
    flex-wrap: nowrap;
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

  .quoted-content-container {
    margin: 8px 0;
    padding: 0;
    overflow-x: auto;
    overflow-y: hidden;
    width: 100%;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
  }

  .quoted-content-list {
    display: flex;
    flex-direction: row;
    gap: 8px;
    padding-bottom: 4px;
    width: max-content;
    min-width: 100%;
  }

  .quoted-content-item {
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(59, 130, 246, 0.15);
    border-left: 3px solid rgba(59, 130, 246, 0.5);
    border-radius: 6px;
    position: relative;
    color: #e5e7eb;
    font-size: 14px;
    line-height: 1.4;
    max-width: 300px;
    min-width: 200px;
  }

  .quoted-text {
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    word-wrap: break-word;
  }

  .quoted-close-icon {
    background: none;
    border: none;
    position: absolute;
    top: 4px;
    right: 4px;
    width: 18px;
    height: 18px;
    color: #9ca3af;
    cursor: pointer;
    flex-shrink: 0;
  }

  .quoted-close-icon:hover {
    color: white;
  }

  /* Thin scrollbar for quoted content */
  .quoted-content-container::-webkit-scrollbar {
    height: 4px;
  }

  .quoted-content-container::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 2px;
  }

  .quoted-content-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }

  .quoted-content-container::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
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

  /* Intent menu */
  .intent-trigger {
    position: relative;
  }
  .intent-menu {
    position: absolute;
    top: 36px;
    left: 0;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 10px;
    padding: 6px;
    display: flex;
    flex-direction: column; /* show one by one */
    gap: 4px;
    z-index: 20;
    min-width: 180px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.35);
  }
  /* Open upward in sidepanel mode */
  .telescope-container.sidepanel-mode .intent-menu {
    top: auto;
    bottom: 36px;
    box-shadow: 0 -8px 20px rgba(0,0,0,0.35);
  }
  .intent-item {
    background: transparent;
    color: #e5e7eb;
    border: 1px solid transparent;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .intent-item:hover {
    background: #374151;
    border-color: #4b5563;
  }

  /* Circle behind the small intent icons */
  .intent-icon-circle {
    width: 32px;
    height: 32px;
    background: #2b2e39;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  /* Normalize the icon sizes inside the circle */
  .intent-icon-circle :global(svg) {
    width: 20px;
    height: 20px;
  }

  /* Larger variant for write and rewrite */
  .intent-icon-circle--large {
    width: 36px;
    height: 36px;
  }
  .intent-icon-circle--large :global(svg) {
    width: 24px;
    height: 24px;
  }

  .input-field {
    flex: 1 1 auto;
    background: transparent;
    border: none;
    outline: none;
    color: #ffffff;
    font-size: 16px;
    font-weight: 500;
    min-width: 200px;
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
    /* Thin scrollbar styling */
    scrollbar-width: thin;
    scrollbar-color: #555 #2a2a2a;
  }

  /* Webkit scrollbar styling for input field */
  .input-field::-webkit-scrollbar {
    width: 4px;
  }

  .input-field::-webkit-scrollbar-track {
    background: #2a2a2a;
    border-radius: 2px;
  }

  .input-field::-webkit-scrollbar-thumb {
    background: #555;
    border-radius: 2px;
  }

  .input-field::-webkit-scrollbar-thumb:hover {
    background: #666;
  }
  .input-field.input-expanded {
    width: calc(100% - -4px);
  }

  .input-field::placeholder {
    color: #9ca3af;
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
    gap: 4px;
    flex-shrink: 0;
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
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .icon-button:hover {
    background: #404040;
    color: #d1d5db;
  }

  .ask-button-container {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .ask-button {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 6px 14px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    white-space: nowrap;
    height: fit-content;
    align-self: center;
  }

  .input-bar.input-expanded .ask-button-container {
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
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
    align-self: center;
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
