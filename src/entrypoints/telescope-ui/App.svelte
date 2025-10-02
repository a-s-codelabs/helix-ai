<script lang="ts">
  import Telescope from './Telescope.svelte';
  import { searchStore } from '../../lib/searchStore';

  // State using Svelte 5 runes
  let currentState: 'empty' | 'filled' | 'search' | 'summary' = $state('empty');
  let inputValue = $state('');
  let searchIndex = $state(1);
  let totalResults = $state(19);
  let isVisible = $state(false);

  // Subscribe to search store
  $effect(() => {
    const unsubscribe = searchStore.subscribe((state) => {
      isVisible = state.isVisible;
      if (state.isVisible) {
        currentState = 'search';
        searchIndex = state.currentIndex + 1;
        totalResults = state.totalResults;
        inputValue = state.query;
      }
    });
    return unsubscribe;
  });

  function handleStateChange(event: CustomEvent) {
    currentState = event.detail.state;
  }

  function handleInput(event: CustomEvent) {
    inputValue = event.detail.value;
    // Perform search as user types
    searchStore.search(inputValue);
  }

  function handleAsk(event: CustomEvent) {
    console.log('Ask clicked:', event.detail.value);
    // Simulate processing and show summary
    setTimeout(() => {
      currentState = 'summary';
    }, 1000);
  }

  function handleSearchNavigation(event: CustomEvent) {
    const { direction } = event.detail;
    if (direction === 'up') {
      searchStore.previous();
    } else if (direction === 'down') {
      searchStore.next();
    }
  }

  function handleSuggestedQuestion(event: CustomEvent) {
    inputValue = event.detail.question;
    currentState = 'filled';
  }

  function handleVoiceInput() {
    console.log('Voice input clicked');
  }

  function handleAttachment() {
    console.log('Attachment clicked');
  }

  function handleClear() {
    inputValue = '';
    currentState = 'empty';
    searchStore.clearHighlights();
  }

  function handleClose() {
    searchStore.hide();
  }

  // Drag functionality
  let isDragging = $state(false);
  let dragOffset = $state({ x: 0, y: 0 });
  let telescopeContainer = $state<HTMLElement | undefined>(undefined);

  function handleMouseDown(event: MouseEvent) {
    if (telescopeContainer && (event.target === telescopeContainer || telescopeContainer.contains(event.target as Node))) {
      isDragging = true;
      const rect = telescopeContainer.getBoundingClientRect();
      dragOffset.x = event.clientX - rect.left;
      dragOffset.y = event.clientY - rect.top;
      if (telescopeContainer) {
        telescopeContainer.style.cursor = 'grabbing';
      }
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (isDragging && telescopeContainer) {
      const newLeft = event.clientX - dragOffset.x;
      const newTop = Math.max(0, event.clientY - dragOffset.y); // Keep at least at top edge
      
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

  // Add event listeners when component mounts
  $effect(() => {
    if (isVisible) {
      // Reset position to top when telescope becomes visible
      if (telescopeContainer) {
        telescopeContainer.style.left = '50%';
        telescopeContainer.style.top = '0px';
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
  <div class="telescope-overlay" class:search-mode={currentState === 'search' || currentState === 'filled'}>
    <div class="telescope-container draggable" bind:this={telescopeContainer}>
      <Telescope
        state={currentState}
        bind:inputValue
        searchIndex={searchIndex}
        totalResults={totalResults}
        summaryTitle="summarize the website and tell me"
        summaryContent="
          <p>Here's a breakdown of Ascodelabs (ascodelabs.com) based on what I found + observations & suggestions:</p>
          
          <h4>Ascodelabs (AS CodeLabs)</h4>
          <p>A modern software development agency specializing in:</p>
          <ul>
            <li>Custom web & mobile apps (React, Next.js, Tailwind)</li>
            <li>Dashboards & analytics solutions (real-time insights)</li>
            <li>Automation workflows (e.g., n8n integration)</li>
            <li>Dedicated developer teams / outsourcing</li>
          </ul>
          
          <h4>Portfolio & Work</h4>
          <p>They showcase projects like OKTRIA Dashboard and ThreeYem Stamp, highlighting their use of modern tech stacks.</p>
          
          <h4>Blog & Content</h4>
          <p>Regular insights on development practices and industry trends.</p>
        "
        suggestedQuestions={[
          "Who are their main clients / industries they serve?",
          "How do they price / package their services?",
          "What technologies do they specialize in?",
          "Can you show me examples of their work?"
        ]}
        on:stateChange={handleStateChange}
        on:input={handleInput}
        on:ask={handleAsk}
        on:voiceInput={handleVoiceInput}
        on:attachment={handleAttachment}
        on:clear={handleClear}
        on:suggestedQuestion={handleSuggestedQuestion}
        on:searchNavigation={handleSearchNavigation}
        on:close={handleClose}
      />
    </div>
  </div>
{:else}
  <div class="demo-container">
    <h1>Telescope Component Demo</h1>
    <p>Press <kbd>Cmd+F</kbd> (Mac) or <kbd>Ctrl+F</kbd> (Windows/Linux) to open the search interface</p>
    
    <div class="state-controls">
      <h3>State Controls:</h3>
      <div class="button-group">
        <button 
          class="state-button" 
          class:active={currentState === 'empty'}
          onclick={() => currentState = 'empty'}
        >
          Empty
        </button>
        <button 
          class="state-button" 
          class:active={currentState === 'filled'}
          onclick={() => currentState = 'filled'}
        >
          Filled
        </button>
        <button 
          class="state-button" 
          class:active={currentState === 'search'}
          onclick={() => currentState = 'search'}
        >
          Search
        </button>
        <button 
          class="state-button" 
          class:active={currentState === 'summary'}
          onclick={() => currentState = 'summary'}
        >
          Summary
        </button>
      </div>
    </div>

    <div class="telescope-demo">
      <Telescope
        state={currentState}
        bind:inputValue
        searchIndex={searchIndex}
        totalResults={totalResults}
        summaryTitle="summarize the website and tell me"
        summaryContent="
          <p>Here's a breakdown of Ascodelabs (ascodelabs.com) based on what I found + observations & suggestions:</p>
          
          <h4>Ascodelabs (AS CodeLabs)</h4>
          <p>A modern software development agency specializing in:</p>
          <ul>
            <li>Custom web & mobile apps (React, Next.js, Tailwind)</li>
            <li>Dashboards & analytics solutions (real-time insights)</li>
            <li>Automation workflows (e.g., n8n integration)</li>
            <li>Dedicated developer teams / outsourcing</li>
          </ul>
          
          <h4>Portfolio & Work</h4>
          <p>They showcase projects like OKTRIA Dashboard and ThreeYem Stamp, highlighting their use of modern tech stacks.</p>
          
          <h4>Blog & Content</h4>
          <p>Regular insights on development practices and industry trends.</p>
        "
        suggestedQuestions={[
          "Who are their main clients / industries they serve?",
          "How do they price / package their services?",
          "What technologies do they specialize in?",
          "Can you show me examples of their work?"
        ]}
        on:stateChange={handleStateChange}
        on:input={handleInput}
        on:ask={handleAsk}
        on:voiceInput={handleVoiceInput}
        on:attachment={handleAttachment}
        on:clear={handleClear}
        on:suggestedQuestion={handleSuggestedQuestion}
        on:searchNavigation={handleSearchNavigation}
      />
    </div>

    <div class="debug-info">
      <h3>Debug Info:</h3>
      <p><strong>Current State:</strong> {currentState}</p>
      <p><strong>Input Value:</strong> "{inputValue}"</p>
      <p><strong>Search Index:</strong> {searchIndex}/{totalResults}</p>
    </div>
  </div>
{/if}

<style>
  .telescope-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 99999;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 0;
    pointer-events: auto;
  }

  .telescope-overlay:not(.search-mode) {
    backdrop-filter: blur(4px);
  }

  .telescope-overlay .telescope-container {
    position: relative;
    width: 100%;
    max-width: 600px;
    margin-top: 0;
  }

  .telescope-container.draggable {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    cursor: grab;
    user-select: none;
    z-index: 100000;
    margin: 0;
  }

  .telescope-container.draggable:active {
    cursor: grabbing;
  }

  .demo-container {
    padding: 20px;
    max-width: 1000px;
    margin: 0 auto;
    background: #0a0a0a;
    min-height: 100vh;
    color: #ffffff;
  }

  h1 {
    color: #ffffff;
    margin-bottom: 8px;
  }

  p {
    color: #9ca3af;
    margin-bottom: 24px;
  }

  .state-controls {
    margin-bottom: 32px;
  }

  .state-controls h3 {
    color: #d1d5db;
    margin-bottom: 12px;
  }

  .button-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .state-button {
    background: #2a2a2a;
    color: #d1d5db;
    border: 1px solid #404040;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
  }

  .state-button:hover {
    background: #404040;
    border-color: #555;
  }

  .state-button.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
  }

  .telescope-demo {
    margin-bottom: 32px;
  }

  .debug-info {
    background: #1a1a1a;
    border: 1px solid #404040;
    border-radius: 8px;
    padding: 16px;
  }

  .debug-info h3 {
    color: #d1d5db;
    margin: 0 0 12px 0;
  }

  .debug-info p {
    margin: 4px 0;
    font-family: monospace;
    font-size: 14px;
  }

  kbd {
    background: #2a2a2a;
    border: 1px solid #404040;
    border-radius: 4px;
    padding: 2px 6px;
    font-family: monospace;
    font-size: 12px;
    color: #d1d5db;
  }
</style>