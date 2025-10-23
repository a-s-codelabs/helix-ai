<script lang="ts">
  import type { Message } from "./type";
  import { formatBasicMarkdown, sanitizeHtml, isContentSafe } from "../../lib/streamingMarkdown";

  let { messages = [], isStreaming = false, streamingMessageId = null }: {
    messages: Message[],
    isStreaming?: boolean,
    streamingMessageId?: number | null
  } = $props();

  let messageContainer = $state<HTMLElement | undefined>(undefined);
  let autoScroll = $state(true);

  /**
   * Safely render markdown content with security sanitization
   * @param content - The markdown content to render
   * @returns Sanitized HTML content
   */
  function renderMarkdownContent(content: string): string {
    // Check if content is safe before processing
    if (!isContentSafe(content)) {
      console.warn('Potentially unsafe content detected, using plain text');
      return sanitizeHtml(content.replace(/\n/g, '<br>'));
    }

    // Format basic markdown (bold, italic, line breaks)
    const formatted = formatBasicMarkdown(content);

    // Sanitize the formatted HTML for security
    return sanitizeHtml(formatted);
  }

  // Listen to user scrolls to toggle autoScroll on or off
  function handleUserScroll() {
    if (!messageContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = messageContainer;
    // Allow a 4px buffer at bottom due to possible fractional pixels
    const atBottom = Math.abs(scrollTop + clientHeight - scrollHeight) < 4;
    if (atBottom) {
      autoScroll = true;
    } else {
      autoScroll = false;
    }
  }

  $effect(() => {
    if (!messageContainer) return;
    // Use a passive event (safe, no preventDefault)
    messageContainer.addEventListener('scroll', handleUserScroll, { passive: true });
    return () => {
      messageContainer?.removeEventListener('scroll', handleUserScroll);
    };
  });

  $effect(() => {
    // Watch isStreaming, messages, autoScroll, and container reference
    if (!messageContainer) return;

    let previousScrollHeight = messageContainer.scrollHeight;
    let observer: MutationObserver | null = null;

    const handleContentChange = () => {
      if (!messageContainer) return;
      // Only auto-scroll if enabled and isStreaming
      if (isStreaming && autoScroll) {
        const currentScrollHeight = messageContainer.scrollHeight;
        // Only scroll if the content grew (e.g., new streamed chunk)
        if (currentScrollHeight > previousScrollHeight || previousScrollHeight === 0) {
          messageContainer.scrollTo({
            top: currentScrollHeight,
            behavior: 'smooth'
          });
          previousScrollHeight = currentScrollHeight;
        }
      }
    };

    if (isStreaming) {
      observer = new MutationObserver(handleContentChange);
      observer.observe(messageContainer, { childList: true, subtree: true });

      // Initial scroll if at bottom or first streaming
      if (autoScroll) {
        messageContainer.scrollTo({
          top: messageContainer.scrollHeight,
          behavior: 'smooth'
        });
        previousScrollHeight = messageContainer.scrollHeight;
      }
    }

    return () => observer?.disconnect();
  });
</script>

<div class="message-container" bind:this={messageContainer}>
  {#each messages as message}
    <div
      class="message"
      class:user-message={message.type === "user"}
      class:assistant-message={message.type === "assistant"}
      class:streaming={isStreaming && message.id === streamingMessageId}

    
    >
      {@html renderMarkdownContent(message.content)}
      {#if isStreaming && message.id === streamingMessageId}
        <span class="streaming-cursor">|</span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .message-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 400px;
    overflow-y: auto;
    padding: 20px 20px 0px 0px;
    margin-bottom: 20px;
    overscroll-behavior: none;
  }
  .message {
    background: #131723;
    padding: 12px;
    border-radius: 20px;
    font-family: "Sora", sans-serif;
    font-size: 14px;
    color: #fff;
    display: inline-block;
    max-width: 450px;
    width: max-content;
    cursor: pointer;
    transition: opacity 0.2s ease;
  }

  .message:hover {
    opacity: 0.9;
  }

  .message:focus {
    outline: 2px solid #4177f1;
    outline-offset: 2px;
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

  /* Markdown formatting styles */
  :global(.message strong) {
    font-weight: bold;
    color: #fff;
  }

  :global(.message em) {
    font-style: italic;
    color: #e0e0e0;
  }

  :global(.message br) {
    line-height: 1.4;
  }

  .streaming-cursor {
    animation: blink 1s infinite;
    color: #4177f1;
    font-weight: bold;
  }

  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
</style>
