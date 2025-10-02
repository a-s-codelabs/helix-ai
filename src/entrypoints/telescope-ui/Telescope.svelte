<script lang="ts">
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { createEventDispatcher } from 'svelte';

  // Props using Svelte 5 runes
  let { 
    state = $bindable('empty' as 'empty' | 'filled' | 'search' | 'summary'),
    inputValue = $bindable(''),
    placeholder = 'Find or ask...',
    searchIndex = 1,
    totalResults = 19,
    summaryTitle = '',
    summaryContent = '',
    suggestedQuestions = [] as string[],
    disabled = false
  }: {
    state?: 'empty' | 'filled' | 'search' | 'summary';
    inputValue?: string;
    placeholder?: string;
    searchIndex?: number;
    totalResults?: number;
    summaryTitle?: string;
    summaryContent?: string;
    suggestedQuestions?: string[];
    disabled?: boolean;
  } = $props();

  // Event dispatcher - using Svelte 5 approach
  let dispatch = createEventDispatcher();

  // Refs using Svelte 5
  let inputElement: HTMLTextAreaElement;

  // Derived state using Svelte 5 runes
  let isExpanded = $derived(state === 'summary');
  let isInputExpanded = $derived(inputValue.length > 50 || inputValue.includes('\n'));

  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    inputValue = target.value;
    dispatch('input', { value: inputValue });
    
    // Auto-resize textarea
    autoResize(target);
    
    if (inputValue.length > 0 && state === 'empty') {
      dispatch('stateChange', { state: 'filled' });
    } else if (inputValue.length === 0 && state === 'filled') {
      dispatch('stateChange', { state: 'empty' });
    }
  }

  function autoResize(textarea: HTMLTextAreaElement) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight to fit content
    textarea.style.height = Math.max(48, textarea.scrollHeight) + 'px';
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      dispatch('ask', { value: inputValue });
    }
  }

  function handleAsk() {
    dispatch('ask', { value: inputValue });
  }

  function handleVoiceInput() {
    dispatch('voiceInput');
  }

  function handleAttachment() {
    dispatch('attachment');
  }

  function handleClose() {
    if (state === 'summary') {
      dispatch('stateChange', { state: 'empty' });
    } else {
      inputValue = '';
      inputElement.value = '';
      dispatch('clear');
    }
  }

  function handleSuggestedQuestion(question: string) {
    inputValue = question;
    inputElement.value = question;
    dispatch('suggestedQuestion', { question });
  }

  function handleSearchNavigation(direction: 'up' | 'down') {
    dispatch('searchNavigation', { direction, currentIndex: searchIndex });
  }

  // Effect to auto-resize on mount and when inputValue changes
  $effect(() => {
    if (inputElement) {
      autoResize(inputElement);
    }
  });
</script>

<div class="telescope-container" class:expanded={isExpanded}>
  <!-- Main Input Bar -->
  <div class="input-bar" class:disabled class:input-expanded={isInputExpanded}>
    <!-- Search Icon -->
    <div class="icon search-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
        <circle cx="11" cy="11" r="3" fill="currentColor" opacity="0.3"></circle>
        <path d="m8 8 2 2" stroke-width="1"></path>
        <path d="m14 8 2 2" stroke-width="1"></path>
      </svg>
    </div>

    <!-- Input Field -->
    <textarea
      bind:this={inputElement}
      bind:value={inputValue}
      oninput={handleInput}
      onkeydown={handleKeydown}
      {placeholder}
      {disabled}
      class="input-field"
      rows="1"
      style="resize: none; overflow: hidden;"
    ></textarea>

    <!-- Search Navigation (for search state) -->
    {#if state === 'search'}
      <div class="search-navigation">
        <span class="search-counter">{searchIndex}/{totalResults}</span>
        <button class="nav-button" onclick={() => handleSearchNavigation('up')} disabled={searchIndex <= 1} aria-label="Previous result">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="18,15 12,9 6,15"></polyline>
          </svg>
        </button>
        <button class="nav-button" onclick={() => handleSearchNavigation('down')} disabled={searchIndex >= totalResults} aria-label="Next result">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
        </button>
      </div>
    {/if}

    <!-- Separator -->
    <div class="separator"></div>

    <!-- Action Icons -->
    <div class="action-icons">
      <button class="icon-button" onclick={handleVoiceInput} title="Voice input" aria-label="Voice input">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>
      </button>

      <button class="icon-button" onclick={handleAttachment} title="Attach file" aria-label="Attach file">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path>
        </svg>
      </button>
    </div>

    <!-- Ask Button (for filled state) -->
    {#if state === 'filled' && inputValue.length > 0}
      <button class="ask-button" onclick={handleAsk}>
        Ask
      </button>
    {/if}

    <!-- Close Button -->
    <button class="close-button" onclick={handleClose} title="Close" aria-label="Close">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>

  <!-- Summary Panel (for summary state) -->
  {#if state === 'summary'}
    <div class="summary-panel" transition:fly={{ y: 20, duration: 300, easing: quintOut }}>
      <div class="summary-header">
        <span class="time">05:13 PM</span>
        <div class="drag-handle"></div>
        <button class="close-summary" onclick={handleClose} aria-label="Close summary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="summary-content">
        <h3 class="summary-title">{summaryTitle || 'Website Summary'}</h3>
        <div class="summary-text">
          {#if summaryContent}
            {@html summaryContent}
          {:else}
            <p>Here's a breakdown based on what I found + observations & suggestions:</p>
            <p>This is a placeholder for the actual summary content. The component is ready to display rich HTML content including lists, formatting, and more.</p>
          {/if}
        </div>
      </div>

      <!-- Suggested Questions -->
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

      <!-- Follow-up Input -->
      <div class="follow-up-input">
        <div class="icon search-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </div>
        <input
          type="text"
          placeholder="Ask a question..."
          class="follow-up-field"
        />
        <div class="action-icons">
          <button class="icon-button" onclick={handleVoiceInput} aria-label="Voice input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          </button>
          <button class="icon-button" onclick={handleAttachment} aria-label="Attach file">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path>
            </svg>
          </button>
        </div>
        <div class="separator"></div>
        <button class="ask-button">Ask</button>
      </div>
    </div>
  {/if}
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');

  .telescope-container {
    position: relative;
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    transition: all 0.3s ease;
    font-family: 'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .telescope-container.expanded {
    max-width: 800px;
  }

  .input-bar {
    display: flex;
    align-items: center;
    background: #2a2a2a;
    border: 1px solid #404040;
    border-radius: 12px;
    padding: 12px 16px;
    gap: 12px;
    transition: all 0.3s ease;
    position: relative;
    min-height: 48px;
  }

  .input-bar.input-expanded {
    align-items: flex-start;
    padding: 16px;
    min-height: auto;
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
    font-family: 'Sora', inherit;
    resize: none;
    overflow: hidden;
    padding: 0;
    margin: 0;
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

  .summary-panel {
    background: #1a1a1a;
    border: 1px solid #404040;
    border-radius: 12px;
    margin-top: 8px;
    overflow: hidden;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  }

  .summary-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #404040;
  }

  .time {
    color: #9ca3af;
    font-size: 14px;
  }

  .drag-handle {
    width: 40px;
    height: 4px;
    background: #404040;
    border-radius: 2px;
    margin: 0 auto;
  }

  .close-summary {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .close-summary:hover {
    background: #404040;
    color: #d1d5db;
  }

  .summary-content {
    padding: 20px;
  }

  .summary-title {
    color: #ffffff;
    font-size: 20px;
    font-weight: 700;
    margin: 0 0 16px 0;
  }

  .summary-text {
    color: #d1d5db;
    line-height: 1.6;
    font-size: 14px;
  }

  .summary-text p {
    margin: 0 0 12px 0;
  }

  /* These selectors are used in the HTML content via {@html} - svelte-ignore css_unused_selector */
  .summary-text ul {
    margin: 12px 0;
    padding-left: 20px;
  }

  .summary-text li {
    margin: 4px 0;
  }

  .suggested-questions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0 20px 20px;
  }

  .suggested-question {
    background: #2a2a2a;
    color: #d1d5db;
    border: 1px solid #404040;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .suggested-question:hover {
    background: #404040;
    border-color: #555;
  }

  .follow-up-input {
    display: flex;
    align-items: center;
    background: #2a2a2a;
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
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .ask-button {
    animation: fadeIn 0.3s ease;
  }

  .summary-panel {
    animation: fadeIn 0.4s ease;
  }
</style>
