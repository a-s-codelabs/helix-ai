<script lang="ts">
  import Telescope from "./Telescope.svelte";
  import { chatStore } from "@/lib/chatStore";
  import { sidePanelUtils, sidePanelStore } from "@/lib/sidePanelStore";
import { globalStorage } from "@/lib/globalStorage";
import { DB_SCHEMA } from "@/lib/dbSchema";
  import type { Message, State } from "./type";
  import TelescopeSidepanelHeader from "./TelescopeSidepanelHeader.svelte";
  import { handleAskHelper } from "./handleAsk";
  import type { AskOptions } from "./handleAsk";
  import VoiceInputModal from "./VoiceInputModal.svelte";

  let currentState: State = $state("ask");
  let inputValue = $state("");
  let inputImageAttached = $state<string[]>([]);
  let isVisible = $state(false);
  let messages: Message[] = $state([]);
  let isStreaming = $state(false);
  let streamingMessageId = $state<number | null>(null);
  let quotedContent = $state<string[]>([]);
  let showVoiceModal = $state(false);

  let { isInSidePanel }: { isInSidePanel: boolean } = $props();
  $effect(() => {
    const unsubscribe = chatStore.subscribe((state) => {
      messages = state.messages;
      isStreaming = state.isStreaming;
      streamingMessageId = state.streamingMessageId;
    });
    return unsubscribe;
  });

  $effect(() => {
    if (isVisible) {
      if (isInSidePanel) {
        (async () => {
          console.log("App: In side panel mode, fetching page content...");
          const pageContext = await sidePanelUtils.getPageContent();
          if (pageContext) {
            console.log("App: Received page content, initializing chat store");
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

  $effect(() => {
    isVisible = true;
  });

  const updateStateFromStorage = async () => {
    if (!isInSidePanel) return;
    const storedState = await globalStorage().get("action_state");
    console.log("event", storedState);
    if (storedState) {
      globalStorage().delete("action_state");
      console.log("App: Updating state from storage:", storedState);

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
        chatStore.summarise(storedState.content);
      } else if (
        storedState.actionSource === "translate" &&
        storedState.targetLanguage
      ) {
        chatStore.translate(storedState.content, storedState.targetLanguage);
      }
    }
  };

  $effect(() => {
    if (isInSidePanel) {
      globalStorage().watch(globalStorage().ACTION_STATE_EVENT, updateStateFromStorage);
      // Watch for voice transcription results saved by the page instance
      const voiceKey = DB_SCHEMA.voice_result.storageKey;
      const handleVoiceResult = async () => {
        const res = await globalStorage().get("voice_result");
        if (res && typeof (res as any).text === "string" && (res as any).text.trim()) {
          await globalStorage().delete("voice_result");
          handleAsk({ value: (res as any).text, images: [] });
        }
      };
      globalStorage().watch(voiceKey, handleVoiceResult);
      return () => {
        globalStorage().unwatch();
      };
    }
  });

  // In page context, watch for side panel's voice open requests and open the modal
  $effect(() => {
    if (!isInSidePanel) {
      const requestKey = DB_SCHEMA.voice_request.storageKey;
      const openIfRequested = async () => {
        const req = await globalStorage().get("voice_request");
        if (req && (req as any).requested) {
          showVoiceModal = true;
          await globalStorage().delete("voice_request");
        }
      };
      globalStorage().watch(requestKey, openIfRequested);
      // Check immediately in case request happened before mount
      openIfRequested();
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
    handleAskHelper(opts);
  }

  function handleSuggestedQuestion({ question }: { question: string }) {
    inputValue = question;
    handleAsk({ value: question, images: [] });
  }

  function handleVoiceInput() {
    console.log("Voice input clicked");
    if (isInSidePanel) {
      // Request page instance to open voice modal via storage (reliable across contexts)
      globalStorage().set("voice_request", { requested: true, ts: Date.now() });
      // Also try postMessage as a best-effort fallback
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ action: "openVoiceModalFromSidePanel" }, "*");
      }
      // Ensure the page UI is mounted by asking background to open/toggle telescope on the active tab
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({ type: 'OPEN_FLOATING_TELESCOPE' });
        }
      } catch {}
      return;
    }
    showVoiceModal = true;
  }

  function handleVoiceModalClose() {
    showVoiceModal = false;
  }

  function handleVoiceTranscribe(text: string) {
    console.log("Voice transcribed:", text);
    // Send the transcribed text to chat in this context
    handleAsk({ value: text, images: [] });
    // If we're on the main page (not side panel), persist for the side panel to consume
    if (!isInSidePanel) {
      globalStorage().set("voice_result", { text, ts: Date.now() });
    }
  }

  function handleAttachment() {
    console.log("Attachment clicked");
  }

  function handleClearChat() {
    chatStore.clear();
  }

  function handleClose() {
    chatStore.clear();

    if (!isInSidePanel) {
      console.log("Closing telescope from close button...");
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

  function handleMessage(event: MessageEvent) {
    const data = (event && event.data) || {};
    // From side panel: request to open the voice modal centered on the page
    if (!isInSidePanel && data.action === "openVoiceModalFromSidePanel") {
      showVoiceModal = true;
      return;
    }
  }
</script>

<svelte:window on:message={handleMessage} />
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
      {messages}
      {isStreaming}
      {streamingMessageId}
      onStateChange={handleStateChange}
      onInput={handleInput}
      onAsk={({ value, images, settings, intent }) =>
        handleAsk({ value, images, settings, intent })}
      onVoiceInput={handleVoiceInput}
      onAttachment={handleAttachment}
      onSuggestedQuestion={handleSuggestedQuestion}
      onClose={handleClose}
      onStop={handleStop}
      onDragStart={handleDragStart}
    />
  </div>
{/if}

<VoiceInputModal
  isOpen={showVoiceModal}
  onClose={handleVoiceModalClose}
  onTranscribe={handleVoiceTranscribe}
/>

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
