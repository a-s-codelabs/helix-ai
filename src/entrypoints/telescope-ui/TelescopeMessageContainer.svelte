<script lang="ts">
  import type { Message } from "./type";

  let { messages = [] }: { messages: Message[] } = $props();
</script>

<div class="message-container">
  {#each messages as message}
    <div
      class="message"
      class:user-message={message.type === "user"}
      class:assistant-message={message.type === "assistant"}
    >
      {@html message.content}
    </div>
  {/each}
</div>

<style>
  .message-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 450px;
    overflow-y: auto;
    padding: 0 20px;
  }
  .message {
    background: #131723;
    padding: 12px;
    border-radius: 20px;
    font-family: "Sora", sans-serif;
    color: #fff;
    display: inline-block;
    max-width: 450px;
    width: max-content;
  }

  .assistant-message {
    background: #322631;
  }
  .user-message {
    background: #4177f1;
    align-self: flex-end;
  }

  :global(.message > p) {
    margin: 0;
    padding: 0;
    display: inline;
  }
</style>
