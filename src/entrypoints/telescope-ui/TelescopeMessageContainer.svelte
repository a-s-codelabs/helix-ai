<script lang="ts">
  import type { Message } from "./type";
  import { formatBasicMarkdown, sanitizeHtml, isContentSafe } from "../../lib/streamingMarkdown";
  // @ts-ignore - Svelte component import
  import CopyIcon from "./icons/Copy.svelte";

  let { messages = [], isStreaming = false, streamingMessageId = null }: {
    messages: Message[],
    isStreaming?: boolean,
    streamingMessageId?: number | null
  } = $props();

  let messageContainer = $state<HTMLElement | undefined>(undefined);
  let autoScroll = $state(true);
  let copiedMessageId = $state<number | null>(null);

  /**
   * Copy message content to clipboard
   * @param content - The message content to copy
   * @param messageId - The ID of the message being copied
   */
  async function copyToClipboard(content: string, messageId: number) {
    try {
      // Remove HTML tags and get plain text
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const plainText = tempDiv.textContent || tempDiv.innerText || '';

      await navigator.clipboard.writeText(plainText);

      // Show "Copied!" feedback
      copiedMessageId = messageId;
      setTimeout(() => {
        copiedMessageId = null;
      }, 2000); // Hide after 2 seconds

      console.log('Content copied to clipboard');
    } catch (err) {
      console.error('Failed to copy content: ', err);
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = content.replace(/<[^>]*>/g, ''); // Remove HTML tags
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        // Show "Copied!" feedback for fallback too
        copiedMessageId = messageId;
        setTimeout(() => {
          copiedMessageId = null;
        }, 2000);

        console.log('Content copied to clipboard (fallback)');
      } catch (fallbackErr) {
        console.error('Fallback copy failed: ', fallbackErr);
      }
    }
  }

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
      <div class="message-content">
        {#if message.images && message.images.length > 0}
          <div class="message-images">
            {#each message.images as image}
              <img src={image} alt="" class="message-image" />
            {/each}
          </div>
        {/if}
        {@html renderMarkdownContent(message.content)}
        {#if isStreaming && message.id === streamingMessageId}
          <span class="streaming-cursor">|</span>
        {/if}
      </div>

      <!-- Copy button for assistant messages -->
      {#if message.type === "assistant"}
        <button
          class="copy-button"
          onclick={() => copyToClipboard(message.content, message.id)}
          title="Copy message"
          aria-label="Copy message"
        >
          <CopyIcon />
        </button>

        <!-- Copied feedback -->
        {#if copiedMessageId === message.id}
          <div class="copied-feedback">
            Copied!
          </div>
        {/if}
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
    padding: 30px 10px 0px 0px;
    margin-bottom: 20px;
    overscroll-behavior: none;
    /* Thin scrollbar styling */
    scrollbar-width: thin;
    scrollbar-color: #555 #2a2a2a;
    width: 100%;
    box-sizing: border-box;
  }

  /* Webkit scrollbar styling for thin appearance */
  .message-container::-webkit-scrollbar {
    width: 6px;
  }

  .message-container::-webkit-scrollbar-track {
    background: #2a2a2a;
    border-radius: 3px;
  }

  .message-container::-webkit-scrollbar-thumb {
    background: #555;
    border-radius: 3px;
  }

  .message-container::-webkit-scrollbar-thumb:hover {
    background: #666;
  }
  .message {
    background: #131723;
    padding: 12px;
    border-radius: 20px;
    font-family: "Sora", sans-serif;
    font-size: 14px;
    color: #fff;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    max-width: 450px;
    width: max-content;
    cursor: pointer;
    transition: opacity 0.2s ease;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    min-width: 60px;
    position: relative;
  }

  .message-content {
    flex: 1;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
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
    align-self: flex-start;
    margin-right: auto;
  }
  .user-message {
    background: #4177f1;
    align-self: flex-end;
    margin-left: auto;
  }

  .copy-button {
    background: transparent;
    border: none;
    color: #ccc;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
    opacity: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    flex-shrink: 0;
    position: absolute;
    bottom: 8px;
    right: 8px;
  }

  .message:hover .copy-button {
    opacity: 1;
  }

  .copy-button:hover {
    color: #fff;
    background-color: rgba(255, 255, 255, 0.1);
  }

  .copy-button:active {
    transform: scale(0.95);
    background-color: rgba(255, 255, 255, 0.2);
  }

  .copied-feedback {
    position: absolute;
    bottom: 8px;
    right: 40px;
    background: #666;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    z-index: 10;
    animation: fadeInOut 2s ease-in-out;
  }

  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(5px); }
    20% { opacity: 1; transform: translateY(0); }
    80% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-5px); }
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

  .message-images {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }

  .message-image {
    max-width: 150px;
    max-height: 150px;
    border-radius: 8px;
    object-fit: cover;
    border: 1px solid #404040;
  }

  /* Side panel specific adjustments */
  :global(.sidepanel-layout) .message {
    max-width: 95%;
    width: max-content;
    box-sizing: border-box;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
  }

  :global(.sidepanel-layout) .message-content {
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
  }

  :global(.sidepanel-layout) .message-container {
    overflow-x: hidden;
    width: 100%;
    box-sizing: border-box;
    max-height: none;
    height: 100%;
    flex: 1;
    overflow-y: auto;
    padding: 0px 20px 0px 0px;
    margin-bottom: 0;
  }

  /* Responsive adjustments */
  @media (max-width: 400px) {
    .message-container {
      padding: 12px 12px 0px 0px;
      margin-bottom: 12px;
      gap: 8px;
    }

    .message {
      font-size: 13px;
      padding: 10px;
      max-width: 95%;
    }

    .copy-button {
      min-width: 20px;
      height: 20px;
    }

    .message-image {
      max-width: 120px;
      max-height: 120px;
    }
  }

  @media (max-width: 300px) {
    .message-container {
      padding: 8px 8px 0px 0px;
      margin-bottom: 8px;
      gap: 6px;
    }

    .message {
      font-size: 12px;
      padding: 8px;
      max-width: 95%;
    }

    .copy-button {
      min-width: 18px;
      height: 18px;
    }

    .message-image {
      max-width: 100px;
      max-height: 100px;
    }
  }
</style>
