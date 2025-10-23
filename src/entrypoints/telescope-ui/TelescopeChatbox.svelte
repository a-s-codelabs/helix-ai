<script lang="ts">
  import Close from './icons/Close.svelte';
  import RightSidePanel from './icons/RightSidePanel.svelte';
  import type { Message, ChatboxProps } from './type';
  import MessageContainer from './TelescopeMessageContainer.svelte';
  import { sidePanelUtils } from '../../lib/sidePanelStore';

  let {
    input,
    messages = [],
    suggestedQuestions = [],
    onSuggestedQuestion,
    onClose,
    isStreaming = false,
    streamingMessageId = null,
  // Additional props for side panel functionality
  inputValue = '',
  inputImageAttached = [],
  searchIndex = 1,
  totalResults = 0,
  currentState = 'ask',
}: ChatboxProps = $props();

// Check if we're in side panel mode
let isInSidePanel = $state(false);

$effect(() => {
  // Check if we're in a side panel context
  isInSidePanel = window.location.pathname.includes('sidepanel') ||
                 window.location.href.includes('sidepanel') ||
                 document.title.includes('Side Panel');
});

  // Handle move to side panel
  async function handleMoveToSidePanel() {
    console.log('RightSidePanel clicked - attempting to move to side panel');

    const telescopeState = {
      messages,
      isStreaming,
      streamingMessageId,
      inputValue,
      inputImageAttached,
      searchIndex,
      totalResults,
      currentState,
      timestamp: Date.now()
    };

    console.log('Telescope state to move:', telescopeState);

    try {
      const success = await sidePanelUtils.moveToSidePanel(telescopeState);
      console.log('Move to side panel result:', success);

      if (success) {
        // Hide the floating telescope UI after successful move
        onClose?.();
      } else {
        console.error('Failed to move to side panel');
        // Try direct approach as fallback
        try {
          if (typeof chrome !== 'undefined' && chrome.sidePanel) {
            await chrome.sidePanel.open({});
            console.log('Side panel opened directly as fallback');
            onClose?.();
          } else {
            alert('Failed to open side panel. Please try clicking the extension icon in the toolbar.');
          }
        } catch (directError) {
          console.error('Direct side panel open also failed:', directError);
          alert('Failed to open side panel. Please try clicking the extension icon in the toolbar.');
        }
      }
    } catch (error) {
      console.error('Error in handleMoveToSidePanel:', error);
      // Try direct approach as fallback
      try {
        if (typeof chrome !== 'undefined' && chrome.sidePanel) {
          await chrome.sidePanel.open({});
          console.log('Side panel opened directly as fallback after error');
          onClose?.();
        } else {
          alert('Error opening side panel: ' + (error as Error).message);
        }
      } catch (directError) {
        console.error('Direct side panel open also failed:', directError);
        alert('Error opening side panel: ' + (error as Error).message);
      }
    }
  }
</script>

<div class:chat-box={messages.length > 0} class:sidepanel-layout={isInSidePanel} class="default-chat-box">
  {#if messages.length > 0}
    {#if !isInSidePanel}
      <button
        class="right-panel-icon"
        onclick={handleMoveToSidePanel}
        title="Move to Side Panel"
        aria-label="Move to Side Panel"
      >
        <RightSidePanel />
      </button>
      <button
        class="close-icon"
        onclick={onClose}
        title="Close"
        aria-label="Close"
      >
        <Close />
      </button>
    {/if}
    <div class="messages-container">
      <MessageContainer {messages} {isStreaming} {streamingMessageId} />
      {#if suggestedQuestions.length > 0}
        <div class="suggested-questions">
          {#each suggestedQuestions as question}
            <button
              class="suggested-question"
              onclick={() => onSuggestedQuestion?.({ question })}
            >
              {question}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
  <div class="input">{@render input()}</div>
</div>

<style>
  .default-chat-box {
    display: inline-block;
    position: relative;
    padding-top: 30px;
  }
  .chat-box {
    background: #131723;
    padding: 12px 12px 12px 16px;
    border-radius: 35px;
  }

  .close-icon {
    position: absolute;
    top: 12px;
    right: 12px;
    cursor: pointer;
    background-color: transparent;
    color: #ccc;
    outline: none;
    border: none;
    transition: all 0.2s ease;
    padding: 4px;
    border-radius: 4px;
  }
  .close-icon:hover {
    color: #fff;
    background-color: rgba(255, 255, 255, 0.1);
  }
  .close-icon:active {
    transform: scale(0.95);
    background-color: rgba(255, 255, 255, 0.2);
  }

  .right-panel-icon {
    position: absolute;
    top: 12px;
    right: 50px;
    cursor: pointer;
    background-color: transparent;
    color: #ccc;
    outline: none;
    border: none;
    transition: all 0.2s ease;
    padding-left: 4px;
    border-radius: 4px;
  }
  .right-panel-icon:hover {
    color: #fff;
    background-color: rgba(255, 255, 255, 0.1);
  }
  .right-panel-icon:active {
    transform: scale(0.95);
    background-color: rgba(255, 255, 255, 0.2);
  }

  .input {
    margin-top: 0;
    padding-top: 0;
  }

  .suggested-questions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 20px 0px;
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scroll-padding-inline-start: 0px;
    /* Thin scrollbar styling */
    scrollbar-width: thin;
    scrollbar-color: #555 #2a2a2a;
  }

  /* Webkit scrollbar styling for thin appearance */
  .suggested-questions::-webkit-scrollbar {
    height: 6px;
  }

  .suggested-questions::-webkit-scrollbar-track {
    background: #2a2a2a;
    border-radius: 3px;
  }

  .suggested-questions::-webkit-scrollbar-thumb {
    background: #555;
    border-radius: 3px;
  }

  .suggested-questions::-webkit-scrollbar-thumb:hover {
    background: #666;
  }

  .suggested-question {
    background: #262832;
    color: #d1d5db;
    border: 1px solid #404040;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex: 0 0 auto;
    min-width: fit-content;
    max-width: 100%;
    word-break: break-word;
    box-sizing: border-box;
  }

  /* Side panel specific suggested question styling */
  .sidepanel-layout .suggested-question {
    white-space: normal;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    flex: 1 1 auto;
    min-width: 0;
  }

  /* Responsive suggested questions */
  @media (max-width: 400px) {
    .suggested-question {
      font-size: 12px;
      padding: 6px 10px;
    }
  }

  @media (max-width: 300px) {
    .suggested-question {
      font-size: 11px;
      padding: 5px 8px;
      white-space: normal;
      text-align: center;
    }
  }

  .suggested-question:hover {
    background: #404040;
    border-color: #555;
  }

  /* Side panel layout styles */
  .sidepanel-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    min-width: 0; /* Allow flex items to shrink below content size */
    position: relative;
  }

  .sidepanel-layout .messages-container {
    flex: 1;
    overflow-y: auto;

    min-height: 0; /* Allow container to shrink */
    display: flex;
    flex-direction: column;
  }

  .sidepanel-layout .input {
    flex-shrink: 0;
    margin-top: auto;
    padding: 12px;
    width: 100%;
    box-sizing: border-box;
  }

  .sidepanel-layout .suggested-questions {
    padding: 20px 0px 0px 0px;
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    box-sizing: border-box;
  }

  /* Responsive breakpoints */
  @media (max-width: 400px) {
    .sidepanel-layout .messages-container {
      padding: 8px;
    }

    .sidepanel-layout .input {
      padding: 8px;
    }

    .sidepanel-layout .suggested-questions {
      padding: 16px 0px 0px 0px;
      gap: 6px;
    }
  }

  @media (max-width: 300px) {
    .sidepanel-layout .messages-container {
      padding: 6px;
    }

    .sidepanel-layout .input {
      padding: 6px;
    }

    .sidepanel-layout .suggested-questions {
      padding: 12px 0px 0px 0px;
      gap: 4px;
    }
  }
</style>
