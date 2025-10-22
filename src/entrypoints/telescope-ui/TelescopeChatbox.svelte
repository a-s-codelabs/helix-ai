<script lang="ts">
  import Close from "./icons/Close.svelte";
  import type { Message, ChatboxProps } from "./type";
  import MessageContainer from "./TelescopeMessageContainer.svelte";

  let {
    input,
    messages = [],
    suggestedQuestions = [],
    onSuggestedQuestion,
    onClose,
    isStreaming = false,
    streamingMessageId = null,
  }: ChatboxProps = $props();
</script>

<div class:chat-box={messages.length > 0} class="default-chat-box">
  {#if messages.length > 0}
    <button class="close-icon" onclick={onClose}><Close /></button>
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
  }
  .close-icon:hover {
    color: #fff;
  }

  .suggested-questions {
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
    padding: 20px 0px;
    width: 600px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    overflow-x: auto;
    scroll-padding-inline-start: 0px;
    /* Hide scrollbar for Webkit browsers */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
  }
  .suggested-questions::-webkit-scrollbar {
    display: none; /* Safari and Chrome */
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
  }

  .suggested-question:hover {
    background: #404040;
    border-color: #555;
  }
</style>
