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
  import AddToChat from "./icons/AddToChat.svelte";
  import SummarizeIcon from "./icons/Summarize.svelte";
  import TranslateIcon from "./icons/Translate.svelte";
  import WriterIcon from "./icons/Writer.svelte";
  import RewriterIcon from "./icons/Rewriter.svelte";
  import ProofreadIcon from "./icons/Proofread.svelte";
  import SettingsPopup from "./SettingsPopup.svelte";
  import ModelSelectorPopup from "./ModelSelectorPopup.svelte";
  import ModelSelectorIcon from "./icons/ModelSelector.svelte";
import { multiModelStore, AVAILABLE_MODELS } from "@/lib/multiModelStore";
import { QUOTED_CONTENT_SEPARATOR } from "./constants";
  type Intent =
    | "prompt"
    | "summarize"
    | "translate"
    | "write"
    | "rewrite"
    | "proofread";

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
    isInSidePanel = false,
    onInput,
    onStateChange,
    onAsk,
    onVoiceInput,
    onAttachment,
    onClear,
    onClose,
    onStop,
  }: InputProps = $props();

  let containerElement: HTMLDivElement;
  let isCompactAction = $state(false);

  let showIntentMenu = $state(false);
  let selectedIntent = $state<Intent>("prompt");
  let intentTriggerElement = $state<HTMLDivElement | null>(null);
  let intentMenuElement = $state<HTMLDivElement | null>(null);
  let menuJustOpened = $state(false);

  let showSettingsPopup = $state(false);
  let settingsButtonElement = $state<HTMLButtonElement | null>(null);
  let settingsValues = $state<Record<string, string | number>>({});

  let showModelSelector = $state(false);
  let modelSelectorButtonElement = $state<HTMLButtonElement | null>(null);

  const storage = globalStorage();

  const intentToPlaceholder: Record<Intent, string> = {
    prompt: "Ask...",
    summarize: "Summarize this site...",
    translate: "Translate this content...",
    write: "Write content...",
    rewrite: "Rewrite selected text...",
    proofread: "Proofread this text...",
  };

  const intentToIcon: Record<Intent, typeof SearchAiIcon> = {
    prompt: AddToChat,
    summarize: SummarizeIcon,
    translate: TranslateIcon,
    write: WriterIcon,
    rewrite: RewriterIcon,
    proofread: ProofreadIcon,
  };

  const CurrentIntentIcon = $derived(
    intentToIcon[selectedIntent] ?? SearchAiIcon
  );

  $effect(() => {
    if (!containerElement) return;
    const updateCompact = () => {
      const width = containerElement.clientWidth;
      isCompactAction = width <= 400;
    };
    updateCompact();
    const observer = new ResizeObserver(updateCompact);
    observer.observe(containerElement);
    return () => observer.disconnect();
  });

  let dynamicPlaceholder = $derived(
    (() => {
      const base = intentToPlaceholder[selectedIntent] ?? "Ask...";
      return base;
    })()
  );

  function handleDocumentClick(event: MouseEvent) {
    if (!showIntentMenu) return;
    // Ignore clicks immediately after opening the menu
    if (menuJustOpened) return;
    const target = event.target as Node | null;
    if (!target) return;
    const clickedInsideIntent = intentTriggerElement?.contains(target) ?? false;
    const clickedInsideBar = inputBarElement?.contains(target) ?? false;
    const clickedInsideMenu = intentMenuElement?.contains(target) ?? false;
    const clickedInsideSettings =
      settingsButtonElement?.contains(target) ?? false;
    const clickedInsideSettingsPopup =
      (event.target as HTMLElement)?.closest(".search-icon") !== null;
    const clickedInsideModelSelector =
      modelSelectorButtonElement?.contains(target) ?? false;
    const clickedInsideModelSelectorPopup =
      (event.target as HTMLElement)?.closest(".model-selector-popup") !== null;
    if (
      !clickedInsideIntent &&
      !clickedInsideBar &&
      !clickedInsideMenu &&
      !clickedInsideSettingsPopup &&
      !clickedInsideModelSelector &&
      !clickedInsideModelSelectorPopup
    ) {
      showIntentMenu = false;
      showModelSelector = false;
    }
  }

  function handleSettingsClick(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    showSettingsPopup = !showSettingsPopup;
  }

  function handleSettingsClose() {
    showSettingsPopup = false;
  }

  function handleModelSelectorClick(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    showModelSelector = !showModelSelector;
  }

  function handleModelSelectorClose() {
    showModelSelector = false;
  }

  function handleSettingsChange({
    id,
    value,
  }: {
    id: string;
    value: string | number;
  }) {
    settingsValues[id] = value;
  }

  async function handleSettingsSave({
    intent,
    values,
  }: {
    intent: Intent;
    values: Record<string, string | number>;
  }) {
    try {
      const currentSettings = (await storage.get("telescopeSettings")) || {};
      const updatedSettings = {
        ...currentSettings,
        [intent]: values,
      };
      await storage.set("telescopeSettings", updatedSettings);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  $effect(() => {
    if (!selectedIntent) return;
    (async () => {
      try {
        const savedSettings = await storage.get("telescopeSettings");
        if (savedSettings && savedSettings[selectedIntent]) {
          settingsValues = {
            ...settingsValues,
            ...savedSettings[selectedIntent],
          };
        } else {
          settingsValues = {};
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    })();
  });

  $effect(() => {
    // Use setTimeout to allow button click handlers to process first
    function handleClick(event: MouseEvent) {
      // Delay to allow intent button clicks to process first
      setTimeout(() => {
        handleDocumentClick(event);
      }, 0);
    }
    document.addEventListener("click", handleClick, false);
    return () => document.removeEventListener("click", handleClick, false);
  });

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

  $effect(() => {
    if (inputElement && !disabled) {
      setTimeout(() => {
        inputElement.focus();
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
      handleAsk();
    }
  }

  function handleSendData(audioBlobId?: string) {
    const quotedText =
      quotedContent.length > 0
        ? quotedContent.join(QUOTED_CONTENT_SEPARATOR) + QUOTED_CONTENT_SEPARATOR
        : "";
    const finalMessage = quotedText + inputValue;
    onAsk?.({
      value: finalMessage,
      images: inputImageAttached,
      settings: settingsValues,
      intent: selectedIntent,
      audioBlobId,
    });
    resetInput();
  }

  function handleAsk() {
    handleSendData();
  }

  async function handleVoiceInput() {
    // Request mic from active tab (works for both sidepanel and floating)
    try {
      const response = await new Promise<{
        success?: boolean;
        tabId?: number;
      }>((resolve) => {
        if (typeof chrome !== "undefined" && chrome.runtime) {
          chrome.runtime.sendMessage({ type: "GET_TAB_ID" }, (response) => {
            resolve(response || {});
          });
        } else {
          resolve({});
        }
      });

      if (response?.tabId) {
        // Send message to background to request audio from content script
        chrome.runtime.sendMessage({
          type: "REQUEST_AUDIO",
          tabId: response.tabId,
        });
      } else {
        console.error("Failed to get tab ID for audio recording");
        // Fallback to direct handling if in floating mode and no tab ID
        if (!isInSidePanel) {
          onVoiceInput?.();
        }
      }
    } catch (error) {
      console.error("Error requesting audio:", error);
      // Fallback to direct handling if in floating mode
      if (!isInSidePanel) {
        onVoiceInput?.();
      }
    }
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
    console.log({
      quotedContent,
      index,
    });
  }

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
  bind:this={containerElement}
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
          bind:this={intentTriggerElement}
          onclick={(e: { preventDefault: () => void; stopPropagation: () => void; }) => {
            e.preventDefault();
            e.stopPropagation();
            const willOpen = !showIntentMenu;
            showIntentMenu = !showIntentMenu;
            if (willOpen) {
              menuJustOpened = true;
              // Allow document clicks after a brief delay
              setTimeout(() => {
                menuJustOpened = false;
              }, 100);
            }
          }}
          role="button"
          tabindex="0"
          aria-haspopup="menu"
          aria-expanded={showIntentMenu}
          autofocus={true}
          onkeydown={(e: { preventDefault: () => void; stopPropagation: () => void; }) => {
            e.preventDefault();
            e.stopPropagation();
            if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") {
              e.preventDefault();
              showIntentMenu = !showIntentMenu;
            }
          }}
          onkeyup={(e: { preventDefault: () => void; stopPropagation: () => void; }) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onkeypress={(e: { preventDefault: () => void; stopPropagation: () => void; }) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <CurrentIntentIcon />
          {#if showIntentMenu}
            <div class="intent-menu" role="menu" bind:this={intentMenuElement}>
              <button
                class="intent-item {selectedIntent === 'prompt'
                  ? 'active'
                  : ''}"
                role="menuitemradio"
                aria-checked={selectedIntent === "prompt"}
                onclick={(e: { stopPropagation: () => void; }) => {
                  e.stopPropagation();
                  selectedIntent = "prompt";
                  showIntentMenu = false;
                }}
              >
                <span class="intent-icon-circle"><AddToChat /></span>
                <span>Prompt</span>
              </button>
              <button
                class="intent-item {selectedIntent === 'summarize'
                  ? 'active'
                  : ''}"
                role="menuitemradio"
                aria-checked={selectedIntent === "summarize"}
                onclick={(e: { stopPropagation: () => void; }) => {
                  e.stopPropagation();
                  selectedIntent = "summarize";
                  showIntentMenu = false;
                }}
              >
                <span class="intent-icon-circle"><SummarizeIcon /></span>
                <span>Summarize</span>
              </button>
              <button
                class="intent-item {selectedIntent === 'translate'
                  ? 'active'
                  : ''}"
                role="menuitemradio"
                aria-checked={selectedIntent === "translate"}
                onclick={(e: { stopPropagation: () => void; }) => {
                  e.stopPropagation();
                  selectedIntent = "translate";
                  showIntentMenu = false;
                }}
              >
                <span class="intent-icon-circle"><TranslateIcon /></span>
                <span>Translate</span>
              </button>
              <button
                class="intent-item {selectedIntent === 'write' ? 'active' : ''}"
                role="menuitemradio"
                aria-checked={selectedIntent === "write"}
                onclick={(e: { stopPropagation: () => void; }) => {
                  e.stopPropagation();
                  selectedIntent = "write";
                  showIntentMenu = false;
                }}
              >
                <span class="intent-icon-circle intent-icon-circle--large"
                  ><WriterIcon /></span
                >
                <span>Write</span>
              </button>
              <button
                class="intent-item {selectedIntent === 'rewrite'
                  ? 'active'
                  : ''}"
                role="menuitemradio"
                aria-checked={selectedIntent === "rewrite"}
                onclick={(e: { stopPropagation: () => void; }) => {
                  e.stopPropagation();
                  selectedIntent = "rewrite";
                  showIntentMenu = false;
                }}
              >
                <span class="intent-icon-circle intent-icon-circle--large"
                  ><RewriterIcon /></span
                >
                <span>Rewrite</span>
              </button>
              <button
                class="intent-item {selectedIntent === 'proofread'
                  ? 'active'
                  : ''}"
                role="menuitemradio"
                aria-checked={selectedIntent === "proofread"}
                onclick={(e: { stopPropagation: () => void; }) => {
                  e.stopPropagation();
                  selectedIntent = "proofread";
                  showIntentMenu = false;
                }}
              >
                <span class="intent-icon-circle"><ProofreadIcon /></span>
                <span>Proofread</span>
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
        <div class="settings-container" style="position: relative;">
          <button
            class="icon-button"
            title="Settings"
            aria-label="Settings"
            bind:this={settingsButtonElement}
            onclick={handleSettingsClick}
            class:active={showSettingsPopup}
          >
            <SettingsIcon />
          </button>
          {#if showSettingsPopup}
            <SettingsPopup
              intent={selectedIntent}
              bind:values={settingsValues}
              onChange={handleSettingsChange}
              onClose={handleSettingsClose}
              onSave={handleSettingsSave}
              onReset={() => {}}
              anchorEl={settingsButtonElement}
            />
          {/if}
        </div>

        <div class="model-selector-container" style="position: relative; display: flex; align-items: center;">
          <button
            class="icon-button model-selector-button"
            title="Select AI Models"
            aria-label="Select AI Models"
            bind:this={modelSelectorButtonElement}
            onclick={handleModelSelectorClick}
            class:active={showModelSelector}
            style="display: flex !important; align-items: center; justify-content: center; min-width: 24px; min-height: 24px; visibility: visible !important; opacity: 1 !important; width: 24px; height: 24px; color: #9ca3af;"
          >
            <ModelSelectorIcon />
          </button>
          {#if showModelSelector}
            <ModelSelectorPopup
              anchorEl={modelSelectorButtonElement}
              onClose={handleModelSelectorClose}
              {isInSidePanel}
            />
          {/if}
        </div>

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
            <button
              class="ask-button"
              class:streaming={isStreaming}
              onclick={isStreaming ? handleStop : handleAsk}
              aria-label={isStreaming ? "Stop streaming" : "Send message"}
            >
              {#if isStreaming}
                <StopIcon />
              {:else}
                <SendIcon />
              {/if}
            </button>
            {#if !isInSidePanel && !isInputExpanded && !hasChatBox}
              <button
                class="close-button"
                class:input-expanded={isInputExpanded}
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
        {/if}
      {/if}

      {#if isInputExpanded}
        <div class="expand-bar">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="icon search-icon intent-trigger"
            bind:this={intentTriggerElement}
            role="button"
            tabindex="0"
            aria-haspopup="menu"
            aria-expanded={showIntentMenu}
          >
            <div
              role="button"
              tabindex="0"
              aria-haspopup="menu"
              aria-expanded={showIntentMenu}
              onclick={(e: { preventDefault: () => void; stopPropagation: () => void; }) => {
                e.preventDefault();
                e.stopPropagation();
                const willOpen = !showIntentMenu;
                showIntentMenu = !showIntentMenu;
                if (willOpen) {
                  menuJustOpened = true;
                  // Allow document clicks after a brief delay
                  setTimeout(() => {
                    menuJustOpened = false;
                  }, 100);
                }
              }}
            >
              <CurrentIntentIcon />
            </div>
            {#if showIntentMenu}
              <div
                class="intent-menu"
                role="menu"
                bind:this={intentMenuElement}
              >
                <button
                  class="intent-item {selectedIntent === 'prompt'
                    ? 'active'
                    : ''}"
                  role="menuitemradio"
                  aria-checked={selectedIntent === "prompt"}
                  onclick={(e: { stopPropagation: () => void; }) => {
                    e.stopPropagation();
                    selectedIntent = "prompt";
                    showIntentMenu = false;
                  }}
                >
                  <span class="intent-icon-circle"><AddToChat /></span>
                  <span>Prompt</span>
                </button>
                <button
                  class="intent-item {selectedIntent === 'summarize'
                    ? 'active'
                    : ''}"
                  role="menuitemradio"
                  aria-checked={selectedIntent === "summarize"}
                  onclick={(e: { stopPropagation: () => void; }) => {
                    e.stopPropagation();
                    selectedIntent = "summarize";
                    showIntentMenu = false;
                  }}
                >
                  <span class="intent-icon-circle"><SummarizeIcon /></span>
                  <span>Summarize</span>
                </button>
                <button
                  class="intent-item {selectedIntent === 'translate'
                    ? 'active'
                    : ''}"
                  role="menuitemradio"
                  aria-checked={selectedIntent === "translate"}
                  onclick={(e: { stopPropagation: () => void; }) => {
                    e.stopPropagation();
                    selectedIntent = "translate";
                    showIntentMenu = false;
                  }}
                >
                  <span class="intent-icon-circle"><TranslateIcon /></span>
                  <span>Translate</span>
                </button>
                <button
                  class="intent-item {selectedIntent === 'write'
                    ? 'active'
                    : ''}"
                  role="menuitemradio"
                  aria-checked={selectedIntent === "write"}
                  onclick={(e: { stopPropagation: () => void; }) => {
                    e.stopPropagation();
                    selectedIntent = "write";
                    showIntentMenu = false;
                  }}
                >
                  <span class="intent-icon-circle intent-icon-circle--large"
                    ><WriterIcon /></span
                  >
                  <span>Write</span>
                </button>
                <button
                  class="intent-item {selectedIntent === 'rewrite'
                    ? 'active'
                    : ''}"
                  role="menuitemradio"
                  aria-checked={selectedIntent === "rewrite"}
                  onclick={(e: { stopPropagation: () => void; }) => {
                    e.stopPropagation();
                    selectedIntent = "rewrite";
                    showIntentMenu = false;
                  }}
                >
                  <span class="intent-icon-circle intent-icon-circle--large"
                    ><RewriterIcon /></span
                  >
                  <span>Rewrite</span>
                </button>
                <button
                  class="intent-item {selectedIntent === 'proofread'
                    ? 'active'
                    : ''}"
                  role="menuitemradio"
                  aria-checked={selectedIntent === "proofread"}
                  onclick={(e: { stopPropagation: () => void; }) => {
                    e.stopPropagation();
                    selectedIntent = "proofread";
                    showIntentMenu = false;
                  }}
                >
                  <span class="intent-icon-circle"><ProofreadIcon /></span>
                  <span>Proofread</span>
                </button>
              </div>
            {/if}
          </div>
          <div class="expand-bar-content">
            <div
              class="settings-container"
              style="position: relative; margin-right: 8px;"
            >
              <button
                class="icon-button"
                title="Settings"
                aria-label="Settings"
                bind:this={settingsButtonElement}
                onclick={handleSettingsClick}
                class:active={showSettingsPopup}
              >
                <SettingsIcon />
              </button>
              {#if showSettingsPopup}
                <SettingsPopup
                  intent={selectedIntent}
                  bind:values={settingsValues}
                  onChange={handleSettingsChange}
                  onClose={handleSettingsClose}
                  onSave={handleSettingsSave}
                  onReset={() => {}}
                  anchorEl={settingsButtonElement}
                />
              {/if}
            </div>

            <div
              class="model-selector-container"
              style="position: relative; margin-right: 8px; display: flex !important; align-items: center; visibility: visible !important;"
            >
              <button
                class="icon-button model-selector-button"
                title="Select AI Models"
                aria-label="Select AI Models"
                bind:this={modelSelectorButtonElement}
                onclick={handleModelSelectorClick}
                class:active={showModelSelector}
                style="display: flex !important; align-items: center; justify-content: center; min-width: 24px; min-height: 24px; visibility: visible !important; opacity: 1 !important; width: 24px; height: 24px;"
              >
                <ModelSelectorIcon />
              </button>
              {#if showModelSelector}
                <ModelSelectorPopup
                  anchorEl={modelSelectorButtonElement}
                  onClose={handleModelSelectorClose}
                  {isInSidePanel}
                />
              {/if}
            </div>

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
                <button
                  class="ask-button"
                  class:streaming={isStreaming}
                  onclick={isStreaming ? handleStop : handleAsk}
                  aria-label={isStreaming ? "Stop streaming" : "Send message"}
                >
                  {#if isStreaming}
                    <StopIcon />
                  {:else}
                    <SendIcon />
                  {/if}
                </button>
                {#if !isInSidePanel && !hasChatBox}
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

  .telescope-container.sidepanel-mode.reached-min-chars {
    min-width: 0;
    padding-top: 14px;
  }

  .reached-min-chars {
    min-width: 600px;
  }

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

  .telescope-container.sidepanel-mode {
    max-width: 100%;
    width: 100%;
  }

  .telescope-container.sidepanel-mode .input-bar-container {
    max-width: 100%;
  }

  .telescope-container.sidepanel-mode .action-icons {
    display: flex;
    flex-shrink: 0;
  }

  .telescope-container.sidepanel-mode .icon-button {
    flex-shrink: 0;
  }

  .telescope-container.sidepanel-mode .input-field {
    flex: 1;
    min-width: 100px;
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

  .settings-container .icon-button {
    position: relative;
    z-index: 1100;
  }

  .model-selector-container {
    position: relative;
    display: flex !important;
    align-items: center;
    flex-shrink: 0;
    width: auto;
    height: auto;
    min-width: 24px;
    min-height: 24px;
  }

  .model-selector-container .icon-button {
    position: relative;
    z-index: 1100;
    display: flex !important;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    min-height: 24px;
    visibility: visible !important;
    opacity: 1 !important;
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .model-selector-container .icon-button:hover {
    background: #404040;
    color: #d1d5db;
  }

  .model-selector-container .icon-button.active {
    background: #404040;
    color: #3b82f6;
  }

  .model-selector-container .icon-button :global(svg),
  .model-selector-button :global(svg) {
    display: block !important;
    width: 18px !important;
    height: 18px !important;
    visibility: visible !important;
    opacity: 1 !important;
    color: currentColor !important;
    flex-shrink: 0;
  }

  .model-selector-container :global(svg),
  .model-selector-button :global(svg) {
    display: block !important;
    width: 18px !important;
    height: 18px !important;
    visibility: visible !important;
    opacity: 1 !important;
  }

  .model-selector-button {
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
  }

  .input-bar-container {
    display: flex;
    align-items: start;
    flex-direction: column;
    background: #262832;
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
    overflow: visible;
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
    line-clamp: 3;
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
    transition: color 0.2s ease;
  }

  /* .input-bar.input-expanded .icon {
    align-items: flex-start;
    padding-top: 2px;
  } */

  .search-icon {
    color: #e5e7eb;
  }
  .search-icon:hover {
    color: #ffffff;
  }

  .intent-trigger {
    position: relative;
    padding: 6px;
    border-radius: 50%;
    user-select: none;
    min-width: 32px;
    min-height: 32px;
    max-width: 32px;
    max-height: 32px;
    display: flex;
    align-items: center;
    justify-content: center !important;
    transition:
      background 0.2s ease,
      color 0.2s ease;
  }
  .intent-trigger :global(svg) {
    width: 20px;
    height: 20px;
  }
  .intent-trigger:hover {
    background: #404040;
    color: #ffffff;
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
    flex-direction: column;
    gap: 4px;
    z-index: 20;
    min-width: 180px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
  }
  .telescope-container.sidepanel-mode .intent-menu {
    top: auto;
    bottom: 36px;
    box-shadow: 0 -8px 20px rgba(0, 0, 0, 0.35);
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
  .intent-item.active {
    background: #2f3746;
    border-color: #4b5563;
  }

  .intent-icon-circle {
    width: 32px;
    height: 32px;
    background: #2b2e39;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .intent-icon-circle :global(svg) {
    width: 20px;
    height: 20px;
  }

  .intent-icon-circle--large {
    width: 36px;
    height: 36px;
  }
  .intent-icon-circle--large :global(svg) {
    width: 20px;
    height: 20px;
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
    /* height: 24px; */
    scrollbar-width: thin;
    scrollbar-color: #555 #2a2a2a;
  }

  .input-field:not(.input-expanded) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

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
    border-radius: 50%;
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

  .icon-button.active {
    background: #404040;
    color: #3b82f6;
  }

  .settings-container {
    position: relative;
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
    width: 30px !important;
    height: 30px !important;
    border-radius: 100%;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    white-space: nowrap;
    height: fit-content;
    align-self: center;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
  }

  .ask-button.streaming {
    background: none;
    color: #9ca3af;
  }

  .ask-button.streaming:hover {
    background: #404040;
    color: #d1d5db;
    transform: none;
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
