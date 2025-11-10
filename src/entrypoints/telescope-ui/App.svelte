<script lang="ts">
  import Telescope from "./Telescope.svelte";
  import { chatStore } from "@/lib/chatStore";
  import { sidePanelUtils } from "@/lib/sidePanelStore";
  import { globalStorage } from "@/lib/globalStorage";
  import type { Message, State } from "./type";
  import TelescopeSidepanelHeader from "./TelescopeSidepanelHeader.svelte";
  import { handleAskHelper } from "./handleAsk";
  import type { AskOptions } from "./handleAsk";
  import { getLanguageByCode, getLanguageName } from "@/lib/languageHelper";
  import {
    convertAndStorePageMarkdown,
    getCachedPageMarkdown,
  } from "@/lib/chatStore/markdown-cache-helper";
  import { detectLanguageFromText } from "@/lib/chatStore";
  import { AVAILABLE_MODELS, multiModelStore } from "@/lib/multiModelStore";

  let currentState: State = $state("ask");
  let inputValue = $state("");
  let inputImageAttached = $state<string[]>([]);
  let isVisible = $state(true);
  let messages: Message[] = $state([]);
  let isStreaming = $state(false);
  let streamingMessageId = $state<number | null>(null);
  let quotedContent = $state<string[]>([]);
  let quotedContentToFormat = $state<Set<string>>(new Set());

  let tabId = $state<number | null>(null);
  let { isInSidePanel }: { isInSidePanel: boolean } = $props();
  let currentUrl = $state<string | null>(null);
  let multiModel = $state(false);
  let enabledModels = $state<string[]>([]);
  let enabledModelsInitialized = $state(false);

  // Load saved enabled models on init (only once)
  $effect(() => {
    if (enabledModelsInitialized) return;
    (async () => {
      try {
        const storage = globalStorage();
        const saved = await storage.get('enabledModels');
        if (saved && Array.isArray(saved) && saved.length > 0) {
          enabledModels = saved;
          multiModelStore.setEnabledModels(saved);
        } else {
          enabledModels = AVAILABLE_MODELS.map((m) => m.id);
          multiModelStore.setEnabledModels(enabledModels);
        }
        enabledModelsInitialized = true;
      } catch (error) {
        console.error('Failed to load enabled models:', error);
        enabledModels = AVAILABLE_MODELS.map((m) => m.id);
        multiModelStore.setEnabledModels(enabledModels);
        enabledModelsInitialized = true;
      }
    })();
  });

  // Sync enabled models with store changes
  $effect(() => {
    const unsubscribe = multiModelStore.subscribe((state) => {
      const arraysEqual = (a: string[], b: string[]) =>
        a.length === b.length && a.every((val, idx) => val === b[idx]);

      if (state.enabledModels.length > 0 && !arraysEqual(state.enabledModels, enabledModels)) {
        enabledModels = state.enabledModels;
      }
    });
    return unsubscribe;
  });

  $effect(() => {
    const unsubscribe = chatStore.subscribe((state) => {
      messages = state.messages;
      isStreaming = state.isStreaming;
      streamingMessageId = state.streamingMessageId;
    });
    return unsubscribe;
  });

  $effect(() => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "GET_TAB_ID" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "App: Error getting tab ID:",
            chrome.runtime.lastError.message
          );
          return;
        }
        if (response?.success && response.tabId) {
          tabId = response.tabId;
          currentUrl = response.url;
        } else {
          console.warn("App: Failed to get tab ID", response);
          setTimeout(() => {
            chrome.runtime.sendMessage(
              { type: "GET_TAB_ID" },
              (retryResponse) => {
                if (
                  !chrome.runtime.lastError &&
                  retryResponse?.success &&
                  retryResponse.tabId
                ) {
                  tabId = retryResponse.tabId;
                  currentUrl = retryResponse.url;
                }
              }
            );
          }, 500);
        }
      });
    }
  });

  $effect(() => {
    if (isVisible) {
      if (isInSidePanel) {
        (async () => {
          const pageContext = await sidePanelUtils.getPageContent();
          if (pageContext) {
            await chatStore.init(pageContext);
          } else {
            console.warn(
              "App: Failed to get page content, initializing without context"
            );
            await chatStore.init();
          }
        })();
      } else {
        chatStore.init();
      }
    }
  });

  let isProcessingActionState = $state(false);
  let processedActionStateIds = $state<Set<string>>(new Set());

  /**
   * Format content with quoted style and heading
   * Uses markdown h6 for light gray heading and blockquote for quoted content
   */
  const formatQuotedContent = (
    heading: string,
    content: string
  ): string => {
    const headingText = `###### ${heading}`;
    const quotedContent = content
      .split('\n')
      .map(line => line.trim() ? `> ${line}` : '>')
      .join('\n');
    return `${headingText}\n${quotedContent}`;
  };

  const processActionState = async (storedState: any) => {
    if (storedState.actionSource === "context-image") {
      const content = String(storedState.content || "");
      const isImageUrl =
        /^data:image\//i.test(content) ||
        /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?(#.*)?$/i.test(content);
      inputImageAttached = [...inputImageAttached, content];
      return;
    }

    if (storedState.actionSource === "addToChat") {
      // Store plain content for display, format when sending
      quotedContent = [...quotedContent, storedState.content];
      quotedContentToFormat.add(storedState.content);
      return;
    }

    if (storedState.actionSource === "audio" && storedState.blobId) {
      const audioBlobId = storedState.blobId;
      handleAsk({ value: "", images: [], audioBlobId });
      return;
    }

    if (storedState.actionSource === "summarize") {
      const heading = "Summarize below content";
      const formattedMessage = formatQuotedContent(
        heading,
        storedState.content
      );
      handleAsk({
        value: formattedMessage,
        images: [],
        intent: "summarize",
      });
      return;
    }

    if (
      storedState.actionSource === "translate" &&
      storedState.targetLanguage
    ) {
      const detectedLangCode = await detectLanguageFromText(storedState.content);
      const sourceLangName = detectedLangCode
        ? getLanguageName(detectedLangCode)
        : '(auto detected)';

      const targetLang = getLanguageByCode(storedState.targetLanguage);
      const targetLangName = targetLang?.name || storedState.targetLanguage;
      const heading = `User wants to translate from ${sourceLangName} to ${targetLangName}`;
      const formattedMessage = formatQuotedContent(
        heading,
        storedState.content
      );
      handleAsk({
        value: formattedMessage,
        images: [],
        intent: "translate",
        settings: {
          outputLanguage: storedState.targetLanguage,
        },
      });
      return;
    }
  };

  const updateStateFromStorage = async () => {
    if (isProcessingActionState) return;

    if (!tabId && typeof chrome !== "undefined" && chrome.runtime) {
      const response = await new Promise<{
        success?: boolean;
        tabId?: number;
        url?: string;
      }>((resolve) => {
        chrome.runtime.sendMessage({ type: "GET_TAB_ID" }, (response) => {
          resolve(response || {});
        });
      });
      if (response?.success && response.tabId) {
        tabId = response.tabId;
        currentUrl = response.url || null;
      }
    }

    const storedState = await globalStorage().get("action_state");
    if (!storedState) return;

    const contentHash = storedState.content
      ? `${storedState.content.slice(0, 100)}${storedState.content.length}`
      : '';
    // For audio actions, use blobId to ensure uniqueness
    const audioId = storedState.actionSource === 'audio' && storedState.blobId
      ? storedState.blobId
      : '';
    const stateId = `${storedState.actionSource}-${contentHash}${storedState.targetLanguage || ''}${audioId}`;

    if (processedActionStateIds.has(stateId)) {
      globalStorage().delete("action_state");
      return;
    }

    isProcessingActionState = true;
    try {
      globalStorage().delete("action_state");
      processedActionStateIds.add(stateId);

      if (processedActionStateIds.size > 20) {
        const idsArray = Array.from(processedActionStateIds);
        processedActionStateIds = new Set(idsArray.slice(-20));
      }

      await processActionState(storedState);
    } finally {
      isProcessingActionState = false;
    }
  };

  $effect(() => {
    globalStorage().watch(
      globalStorage().ACTION_STATE_EVENT,
      updateStateFromStorage
    );
    return () => {
      globalStorage().unwatch();
    };
  });

  $effect(() => {
    updateStateFromStorage();
  });

  function handleStateChange({ state }: { state: State }) {
    currentState = state;
  }

  function handleInput({ value }: { value: string }) {
    inputValue = value;
  }

  function handleAskFromInput({
    value,
    images,
    settings,
    intent,
    audioBlobId,
  }: {
    value: string;
    images?: string[];
    settings?: Record<string, string | number>;
    intent?: string;
    audioBlobId?: string;
  }) {
    // Format quotedContent items that need formatting (from addToChat)
    let formattedValue = value;
    if (quotedContentToFormat.size > 0) {
      const separator = "\n\n---\n\n";
      const parts = value.split(separator);

      // Format each part that needs formatting
      const formattedParts = parts.map((part) => {
        // Check if this part matches or starts with content that needs formatting
        for (const contentToFormat of quotedContentToFormat) {
          const trimmedPart = part.trim();
          // Exact match
          if (trimmedPart === contentToFormat) {
            const heading = "Added to chat";
            return formatQuotedContent(heading, contentToFormat);
          }
          // Part starts with contentToFormat followed by \n\n (for last part with inputValue)
          if (part.startsWith(contentToFormat + "\n\n")) {
            const heading = "Added to chat";
            const formatted = formatQuotedContent(heading, contentToFormat);
            const remaining = part.slice(contentToFormat.length);
            return formatted + remaining;
          }
        }
        return part;
      });

      formattedValue = formattedParts.join(separator);
    }

    handleAsk({
      value: formattedValue,
      images,
      settings,
      intent: intent as "prompt" | "summarize" | "translate" | "write" | "rewrite" | "proofread" | undefined,
      audioBlobId,
    });

    // Clear the formatting set after sending
    quotedContentToFormat.clear();
  }

  function handleAsk(opts: AskOptions) {
    // Enable multi-model mode for prompt intents
    const isPromptIntent = !opts.intent || opts.intent === 'prompt';
    if (isPromptIntent) {
      multiModel = true;
      enabledModels = AVAILABLE_MODELS.map((m) => m.id);
    } else {
      multiModel = false;
    }

    handleAskHelper({
      ...opts,
      tabId: tabId,
      multiModel: isPromptIntent ? true : false,
      enabledModels: isPromptIntent ? enabledModels : undefined,
    });
  }

  function handleSuggestedQuestion({ question }: { question: string }) {
    inputValue = question;
    handleAsk({ value: question, images: [] });
  }

  function handleClose() {
    chatStore.clear();

    if (!isInSidePanel) {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ action: "closeTelescope" }, "*");
      } else {
        window.dispatchEvent(new CustomEvent("telescope-close"));
      }
    }
  }

  function handleStop() {
    chatStore.stopStreaming();
  }

  let isDragging = $state(false);
  let dragOffset = $state({ x: 0, y: 0 });
  let telescopeContainer = $state<HTMLElement | undefined>(undefined);

  function handleDragStart(event: MouseEvent) {
    if (telescopeContainer) {
      isDragging = true;
      const rect = telescopeContainer.getBoundingClientRect();
      dragOffset.x = event.clientX - rect.left;
      dragOffset.y = event.clientY - rect.top;
      event.preventDefault();
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (isDragging && telescopeContainer && !isInSidePanel) {
      const newLeft = Math.max(
        0,
        Math.min(
          window.innerWidth - telescopeContainer.offsetWidth,
          event.clientX - dragOffset.x
        )
      );
      const newTop = Math.max(
        0,
        Math.min(
          window.innerHeight - telescopeContainer.offsetHeight,
          event.clientY - dragOffset.y
        )
      );

      telescopeContainer.style.left = newLeft + "px";
      telescopeContainer.style.top = newTop + "px";
      telescopeContainer.style.transform = "none";
    }
  }

  function handleMouseUp() {
    if (isDragging) {
      isDragging = false;
    }
  }

  $effect(() => {
    if (isVisible) {
      if (telescopeContainer) {
        telescopeContainer.style.left = "50%";
        telescopeContainer.style.top = isInSidePanel ? "0" : "20px";
        telescopeContainer.style.transform = "translateX(-50%)";
      }

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  });

  $effect(() => {
    if (!isInSidePanel && typeof window !== "undefined") {
      const handleUrlChange = () => {
        // reload the page context if the url changes
        // this mimics the logic that runs on init
        (async () => {
          try {
            if (!tabId) return;

            const cached = await getCachedPageMarkdown({ tabId: tabId });
            if (cached) {
              // Use cached
            } else {
              if (currentUrl) {
                await convertAndStorePageMarkdown({
                  tabId: tabId,
                  url: currentUrl,
                });
              }
            }
          } catch (err) {
            console.error("Telescope: Error handling url change:", err);
          }
        })();
      };

      handleUrlChange();
      window.addEventListener("popstate", handleUrlChange);
      window.addEventListener("hashchange", handleUrlChange);

      const originalPushState = window.history.pushState;
      window.history.pushState = function (...args) {
        const result = originalPushState.apply(this, args);
        window.dispatchEvent(new Event("popstate"));
        return result;
      };

      return () => {
        window.removeEventListener("popstate", handleUrlChange);
        window.removeEventListener("hashchange", handleUrlChange);
        window.history.pushState = originalPushState;
      };
    }
  });
</script>

{#if isVisible || isInSidePanel}
  <div
    class="telescope-container"
    class:sidepanel-layout={isInSidePanel}
    class:draggable={!isInSidePanel}
    bind:this={telescopeContainer}
  >
    {#if isInSidePanel}
      <TelescopeSidepanelHeader hasChatBox={(messages ?? []).length > 0} />
    {/if}
    <Telescope
      {isInSidePanel}
      inputState={currentState}
      bind:inputValue
      bind:inputImageAttached
      bind:quotedContent
      {tabId}
      {currentUrl}
      {messages}
      {isStreaming}
      {streamingMessageId}
      {multiModel}
      {enabledModels}
      onStateChange={handleStateChange}
      onInput={handleInput}
      onAsk={handleAskFromInput}
      onSuggestedQuestion={handleSuggestedQuestion}
      onClose={handleClose}
      onStop={handleStop}
      onDragStart={handleDragStart}
    />
  </div>
{/if}

<style>
  :global(body) {
    pointer-events: none;
  }
  .telescope-container {
    position: relative;
    max-width: 600px;
    margin-top: 0;
    width: min-content;
    pointer-events: all;
  }

  .telescope-container.draggable {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100000;
    margin: 0;
    border-radius: 12px;
  }

  .telescope-container:not(.draggable) {
    position: relative;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
    border-radius: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #0a0a0a;
    min-width: 0;
    overflow: hidden;
    min-width: 200px;
    max-width: 100vw;
  }

  @media (max-width: 400px) {
    .telescope-container:not(.draggable) {
      font-size: 14px;
    }
  }

  @media (max-width: 300px) {
    .telescope-container:not(.draggable) {
      font-size: 12px;
    }
  }
</style>
