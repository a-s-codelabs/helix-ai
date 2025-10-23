<script lang="ts">
  import Telescope from './Telescope.svelte';
  import { searchStore } from '../../lib/searchStore';
  import { chatStore } from '../../lib/chatStore';
  import type { Direction, State, Message } from './type';

  let currentState: State = $state('ask');
  let inputValue = $state('');
  let searchIndex = $state(1);
  let totalResults = $state(19);
  let isVisible = $state(false);
  let aiResponse = $state('');
  let messages: Message[] = $state([]);
  let isStreaming = $state(false);
  let streamingMessageId = $state<number | null>(null);

  // Subscribe to search store
  $effect(() => {
    const unsubscribe = searchStore.subscribe((state) => {
      isVisible = state.isVisible;
      if (state.isVisible) {
        searchIndex = state.currentIndex + 1;
        totalResults = state.totalResults;
        inputValue = state.query;
      }
    });
    return unsubscribe;
  });

  // Subscribe to chat store
  $effect(() => {
    const unsubscribe = chatStore.subscribe((state) => {
      messages = state.messages;
      isStreaming = state.isStreaming;
      streamingMessageId = state.streamingMessageId;
      // Update search store when we have messages
      if (state.messages.length > 0) {
        searchStore.setAskMode(true);
      }
    });
    return unsubscribe;
  });

  // Initialize chat store when visible
  $effect(() => {
    if (isVisible) {
      chatStore.init();
    }
  });

  function handleStateChange({ state }: { state: State }) {
    currentState = state;
  }

  function handleInput({ value }: { value: string }) {
    inputValue = value;
    // Determine if this is a search or ask based on content
    const isQuestion =
      value.includes('?') ||
      value.toLowerCase().startsWith('what') ||
      value.toLowerCase().startsWith('how') ||
      value.toLowerCase().startsWith('why') ||
      value.toLowerCase().startsWith('when') ||
      value.toLowerCase().startsWith('where') ||
      value.toLowerCase().startsWith('who') ||
      value.toLowerCase().startsWith('explain') ||
      value.toLowerCase().startsWith('tell me') ||
      value.toLowerCase().startsWith('can you');

    if (isQuestion) {
      currentState = 'ask';
    } else {
      currentState = 'search';
      // Perform search as user types
      searchStore.search(inputValue);
    }
  }

  function handleAsk({ value }: { value: string }) {
    console.log('Ask clicked:', value);``
    // alert('Ask clicked!: ' + value);
    if (value.trim()) {
      // Switch to ask mode
      searchStore.setAskMode(true);
       // Use Chrome's AI capabilities via chatStore with streaming
       chatStore.sendMessageStreaming(value);
      inputValue = '';
    }
  }

  function handleSearchNavigation({ direction }: { direction: Direction }) {
    if (direction === 'up') {
      searchStore.previous();
    } else if (direction === 'down') {
      searchStore.next();
    }
  }

  function handleSuggestedQuestion({ question }: { question: string }) {
    inputValue = question;
    handleAsk({ value: question });
  }

  function handleVoiceInput() {
    console.log('Voice input clicked');
  }

  function handleAttachment() {
    console.log('Attachment clicked');
  }

  function handleClear() {
    inputValue = '';
    searchStore.clearHighlights();
  }

  function handleClearChat() {
    chatStore.clear();
  }

  function handleClose() {
    searchStore.hide();
    searchStore.setAskMode(false);
    chatStore.clear();
  }

  function handleStop() {
    chatStore.stopStreaming();
  }

  // Drag functionality
  let isDragging = $state(false);
  let dragOffset = $state({ x: 0, y: 0 });
  let telescopeContainer = $state<HTMLElement | undefined>(undefined);

  function handleMouseDown(event: MouseEvent) {
    if (telescopeContainer) {
      const target = event.target as HTMLElement;
      const isClickableElement = target.closest(
        'button, input, textarea, [role="button"]'
      );
      if (!isClickableElement) {
        isDragging = true;
        const rect = telescopeContainer.getBoundingClientRect();
        dragOffset.x = event.clientX - rect.left;
        dragOffset.y = event.clientY - rect.top;
        telescopeContainer.style.cursor = 'grabbing';
      }
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
      if (telescopeContainer) {
        telescopeContainer.style.cursor = 'grab';
      }
    }
  }

  $effect(() => {
    if (isVisible) {
      if (telescopeContainer) {
        telescopeContainer.style.left = '50%';
        telescopeContainer.style.top = '20px';
        telescopeContainer.style.transform = 'translateX(-50%)';
      }

      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  });
</script>

{#if isVisible}
  <div class="telescope-container draggable" bind:this={telescopeContainer}>
    <Telescope
      inputState={currentState}
      bind:inputValue
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
      onClear={handleClear}
      onSuggestedQuestion={handleSuggestedQuestion}
      onSearchNavigation={handleSearchNavigation}
      onClose={handleClose}
      onStop={handleStop}
    />
  </div>
{/if}

<style>
  .telescope-container {
    position: relative;
    width: 100%;
    max-width: 600px;
    margin-top: 0;
  }

  .telescope-container.draggable {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    cursor: grab;
    z-index: 100000;
    margin: 0;
    border-radius: 12px;
  }

  .telescope-container.draggable:active {
    cursor: grabbing;
  }
</style>
