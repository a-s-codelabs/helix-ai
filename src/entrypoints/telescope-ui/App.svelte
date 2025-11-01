<script lang="ts">
  import Telescope from "./Telescope.svelte";
  import { chatStore } from "@/lib/chatStore";
  import { sidePanelUtils } from "@/lib/sidePanelStore";
  import { globalStorage } from "@/lib/globalStorage";
  import type { Message, State } from "./type";
  import TelescopeSidepanelHeader from "./TelescopeSidepanelHeader.svelte";
  import { handleAskHelper } from "./handleAsk";
  import type { AskOptions } from "./handleAsk";
  import {
    convertAndStorePageMarkdown,
    getCachedPageMarkdown,
  } from "@/lib/chatStore/markdown-cache-helper";

  let currentState: State = $state("ask");
  let inputValue = $state("");
  let inputImageAttached = $state<string[]>([]);
  let isVisible = $state(true);
  let messages: Message[] = $state([]);
  let isStreaming = $state(false);
  let streamingMessageId = $state<number | null>(null);
  let quotedContent = $state<string[]>([]);

  let tabId = $state<number | null>(null);
  let { isInSidePanel }: { isInSidePanel: boolean } = $props();
  let currentUrl = $state<string | null>(null);

  $effect(() => {
    const unsubscribe = chatStore.subscribe((state) => {
      messages = state.messages;
      isStreaming = state.isStreaming;
      streamingMessageId = state.streamingMessageId;
    });
    return unsubscribe;
  });

  $effect(() => {
    // Get tab ID for both sidepanel and floating modes
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
          console.log("App: Got tab ID", {
            tabId: response.tabId,
            url: response.url,
            isInSidePanel,
          });
          tabId = response.tabId;
          currentUrl = response.url;
        } else {
          console.warn("App: Failed to get tab ID", response);
          // Retry after a short delay if it failed
          setTimeout(() => {
            chrome.runtime.sendMessage(
              { type: "GET_TAB_ID" },
              (retryResponse) => {
                if (
                  !chrome.runtime.lastError &&
                  retryResponse?.success &&
                  retryResponse.tabId
                ) {
                  console.log("App: Got tab ID on retry", {
                    tabId: retryResponse.tabId,
                    url: retryResponse.url,
                  });
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

  const updateStateFromStorage = async () => {
    if (!isInSidePanel) return;

    // Ensure we have tabId before processing
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
    if (storedState) {
      globalStorage().delete("action_state");

      if (storedState.actionSource === "context-image") {
        const content = String(storedState.content || "");
        const isImageUrl =
          /^data:image\//i.test(content) ||
          /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?(#.*)?$/i.test(content);
        inputImageAttached = [...inputImageAttached, content];
      }

      if (storedState.actionSource === "addToChat") {
        quotedContent = [...quotedContent, storedState.content];
      }

      if (storedState.actionSource === "summarise") {
        chatStore.summariseStreaming({
          userMessage: storedState.content,
          tabId: tabId,
        });
      } else if (
        storedState.actionSource === "translate" &&
        storedState.targetLanguage
      ) {
        chatStore.translateStreaming({
          userMessage: storedState.content,
          targetLanguage: storedState.targetLanguage,
          tabId,
        });
      }
    }
  };

  $effect(() => {
    if (isInSidePanel) {
      globalStorage().watch(
        globalStorage().ACTION_STATE_EVENT,
        updateStateFromStorage
      );
      return () => {
        globalStorage().unwatch();
      };
    }
  });

  $effect(() => {
    if (isInSidePanel) {
      updateStateFromStorage();
    }
  });

  function handleStateChange({ state }: { state: State }) {
    currentState = state;
  }

  function handleInput({ value }: { value: string }) {
    inputValue = value;
  }

  function handleAsk(opts: AskOptions) {
    handleAskHelper({ ...opts, tabId: tabId });
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
    console.log("Telescope: Listening to url changes", {
      a: !isInSidePanel,
      b: typeof window !== "undefined",
    });
    // Listen to url changes and react accordingly (for floating mode)
    if (!isInSidePanel && typeof window !== "undefined") {
      const handleUrlChange = () => {
        console.log("Telescope: Url changed");
        // reload the page context if the url changes
        // this mimics the logic that runs on init
        // You may want to debounce this if navigation is frequent
        (async () => {
          try {
            console.log("Telescope: Url changed", {
              tabId,
              currentUrl,
            });
            if (!tabId) return;

            const cached = await getCachedPageMarkdown({ tabId: tabId });
            if (cached) {
              // Use cached
            } else {
              if (currentUrl) {
                console.log("Telescope: Converting and storing page markdown", {
                  tabId,
                  currentUrl,
                });
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
      // Listen to popstate & hashchange as proxies for url change
      window.addEventListener("popstate", handleUrlChange);
      window.addEventListener("hashchange", handleUrlChange);

      // For single page apps, often pushState is called directly,
      // so also patch pushState to notify us.
      const originalPushState = window.history.pushState;
      window.history.pushState = function (...args) {
        const result = originalPushState.apply(this, args);
        window.dispatchEvent(new Event("popstate"));
        return result;
      };

      return () => {
        window.removeEventListener("popstate", handleUrlChange);
        window.removeEventListener("hashchange", handleUrlChange);
        // Optionally restore original pushState if needed
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
      onStateChange={handleStateChange}
      onInput={handleInput}
      onAsk={({ value, images, settings, intent }) =>
        handleAsk({ value, images, settings, intent: intent as any })}
      onSuggestedQuestion={handleSuggestedQuestion}
      onClose={handleClose}
      onStop={handleStop}
      onDragStart={handleDragStart}
    />
  </div>
{/if}

<style>
  .telescope-container {
    position: relative;
    max-width: 600px;
    margin-top: 0;
    width: min-content;
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
