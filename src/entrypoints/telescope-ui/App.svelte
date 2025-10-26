<script lang="ts">
  import Telescope from './Telescope.svelte';
  import { chatStore } from '../../lib/chatStore';
  import { sidePanelUtils, sidePanelStore } from '../../lib/sidePanelStore';
  import type { Direction, State, Message } from './type';

  let currentState: State = $state('ask');
  let inputValue = $state('');
  let inputImageAttached = $state<string[]>([]);
  let searchIndex = $state(1);
  let totalResults = $state(19);
  let isVisible = $state(false);
  let aiResponse = $state('');
  let messages: Message[] = $state([]);
  let isStreaming = $state(false);
  let streamingMessageId = $state<number | null>(null);
  let source = $state<'append' | 'move'>('append');

  // Subscribe to chat store
  $effect(() => {
    const unsubscribe = chatStore.subscribe((state) => {
      messages = state.messages;
      isStreaming = state.isStreaming;
      streamingMessageId = state.streamingMessageId;
    });
    return unsubscribe;
  });

  // Initialize chat store when visible
  $effect(() => {
    if (isVisible) {
      // If we're in side panel mode, fetch page content first
      if (isInSidePanel) {
        (async () => {
          console.log('App: In side panel mode, fetching page content...');
          const pageContext = await sidePanelUtils.getPageContent();
          if (pageContext) {
            console.log('App: Received page content, initializing chat store');
            await chatStore.init(pageContext);
          } else {
            console.warn(
              'App: Failed to get page content, initializing without context'
            );
            await chatStore.init();
          }
        })();
      } else {
        // In content script mode, extract page content directly
        chatStore.init();
      }
    }
  });

  // Check if we're in side panel mode
  let isInSidePanel = $state(false);

  // Detect if we're in side panel by checking the URL or window context
  $effect(() => {
    // Check if we're in a side panel context
    isInSidePanel =
      window.location.pathname.includes('sidepanel') ||
      window.location.href.includes('sidepanel') ||
      document.title.includes('Side Panel');

    // If we're in side panel mode, automatically show the UI
    if (isInSidePanel) {
      isVisible = true;
    }
  });

  // Check for side panel state restoration
  $effect(() => {
    if (isInSidePanel) {
      // Function to update state from storage
      const updateStateFromStorage = async () => {
        const storedState = await sidePanelUtils.getTelescopeState();
        if (storedState) {
          console.log('App: Updating state from storage:', storedState);


          // Update local state
          messages = storedState.messages;
          isStreaming = storedState.isStreaming;
          streamingMessageId = storedState.streamingMessageId;
          inputValue = storedState.inputValue;
          inputImageAttached = storedState.inputImageAttached;
          searchIndex = storedState.searchIndex;
          totalResults = storedState.totalResults;
          currentState = storedState.currentState;
          source = storedState.source
          const lastUserMessage = messages.filter(msg => msg.type === 'user').pop();
          if (lastUserMessage) {
            chatStore.summarise(lastUserMessage.content);
          }
        }
      };

      // Initial state restoration
      updateStateFromStorage();

      // Listen for Chrome storage changes
      const handleStorageChange = (changes: { [key: string]: any }, areaName: string) => {
        if (areaName === 'local' && changes.telescopeState) {
          console.log('App: Storage changed, updating state');
          updateStateFromStorage();
        }
      };

      // Add the storage change listener
      if (typeof chrome !== 'undefined' && chrome.storage) {
        (chrome.storage as any).onChanged.addListener(handleStorageChange);

        // Cleanup function
        return () => {
          (chrome.storage as any).onChanged.removeListener(handleStorageChange);
        };
      }
    }
  });

  function handleStateChange({ state }: { state: State }) {
    currentState = state;
  }

  function handleInput({ value }: { value: string }) {
    inputValue = value;
  }

  function handleAsk({ value, images }: { value: string; images?: string[] }) {
    if (value.trim()) {
       chatStore.sendMessageStreaming(value, images);
    }
  }

  function handleSuggestedQuestion({ question }: { question: string }) {
    inputValue = question;
    handleAsk({ value: question, images: [] });
  }

  function handleVoiceInput() {
    console.log('Voice input clicked');
  }

  function handleAttachment() {
    console.log('Attachment clicked');
  }

  function handleClearChat() {
    chatStore.clear();
  }

  function handleClose() {
    chatStore.clear();
  }

  function handleStop() {
    chatStore.stopStreaming();
  }

  // Drag functionality
  let isDragging = $state(false);
  let dragOffset = $state({ x: 0, y: 0 });
  let telescopeContainer = $state<HTMLElement | undefined>(undefined);

  function handleDragStart(event: MouseEvent) {
    if (telescopeContainer) {
      isDragging = true;
      const rect = telescopeContainer.getBoundingClientRect();
      dragOffset.x = event.clientX - rect.left;
      dragOffset.y = event.clientY - rect.top;
      event.preventDefault(); // Prevent text selection while dragging
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (isDragging && telescopeContainer) {
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

      telescopeContainer.style.left = newLeft + 'px';
      telescopeContainer.style.top = newTop + 'px';
      telescopeContainer.style.transform = 'none'; // Remove centering transform when dragging
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
        telescopeContainer.style.left = '50%';
        telescopeContainer.style.top = '20px';
        telescopeContainer.style.transform = 'translateX(-50%)';
      }

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  });

  function handleMessage(event: MessageEvent) {
    console.log({ event })
  }
</script>

<svelte:window on:message={handleMessage} />
{#if isVisible || isInSidePanel}
  <div
    class="telescope-container"
    class:draggable={!isInSidePanel}
    bind:this={telescopeContainer}
  >
    <Telescope
      inputState={currentState}
      bind:inputValue
      bind:inputImageAttached
      {searchIndex}
      {totalResults}
      {messages}
      {isStreaming}
      {streamingMessageId}
      onStateChange={handleStateChange}
      onInput={handleInput}
      onAsk={handleAsk}
      onVoiceInput={handleVoiceInput}
      onAttachment={handleAttachment}
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
    width: 100%;
    max-width: 600px;
    margin-top: 0;
    width: min-content;
  }

  /* Floating mode styling */
  .telescope-container.draggable {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100000;
    margin: 0;
    border-radius: 12px;
  }

  /* Side panel mode styling */
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
    min-width: 0; /* Allow container to shrink */
    overflow: hidden; /* Prevent content from overflowing */
    /* Enable flexible width handling */
    min-width: 200px; /* Minimum usable width */
    max-width: 100vw; /* Never exceed viewport width */
  }

  /* Responsive adjustments for side panel */
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
