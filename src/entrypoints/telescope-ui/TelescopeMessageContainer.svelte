<script lang="ts">
  import type { Message } from "./type";
  import {
    formatBasicMarkdown,
    sanitizeHtml,
    isContentSafe,
  } from "../../lib/streamingMarkdown";
  // @ts-ignore - Svelte component import
  import CopyIcon from "./icons/Copy.svelte";
  // @ts-ignore - Svelte component import
  import SpeakerIcon from "./icons/Speaker.svelte";

  let {
    messages = [],
    isStreaming = false,
    streamingMessageId = null,
  }: {
    messages: Message[];
    isStreaming?: boolean;
    streamingMessageId?: number | null;
  } = $props();

  let messageContainer = $state<HTMLElement | undefined>(undefined);
  let autoScroll = $state(true);
  let copiedMessageId = $state<number | null>(null);
  let speakingMessageId = $state<number | null>(null);

  /**
   * Copy message content to clipboard
   * @param content - The message content to copy
   * @param messageId - The ID of the message being copied
   */
  async function copyToClipboard(content: string, messageId: number) {
    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = content;
      const plainText = tempDiv.textContent || tempDiv.innerText || "";

      // Show feedback immediately next to the button
      copiedMessageId = messageId;
      setTimeout(() => {
        copiedMessageId = null;
      }, 2000);

      await navigator.clipboard.writeText(plainText);
    } catch (err) {
      console.error("Failed to copy content: ", err);
      try {
        const textArea = document.createElement("textarea");
        textArea.value = content.replace(/<[^>]*>/g, "");
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch (fallbackErr) {
        console.error("Fallback copy failed: ", fallbackErr);
      }
    }
  }

  /**
   * Convert message content to speech using Web Speech API
   * @param content - The message content to speak
   * @param messageId - The ID of the message being spoken
   */
  async function speakMessage(content: string, messageId: number) {
    try {
      if (speakingMessageId !== null) {
        window.speechSynthesis.cancel();
        speakingMessageId = null;
        return;
      }

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = content;
      let plainText = tempDiv.textContent || tempDiv.innerText || "";

      if (!plainText.trim()) {
        console.warn("No text content to speak");
        return;
      }

      plainText = plainText.replace(/[*#]/g, " ");

      const utterance = new SpeechSynthesisUtterance(plainText);

      speakingMessageId = messageId;

      utterance.onend = () => {
        speakingMessageId = null;
      };

      utterance.onerror = (event) => {
        console.error("Speech synthesis error:", event.error);
        speakingMessageId = null;
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Failed to speak message:", err);
      speakingMessageId = null;
    }
  }

  /**
   * Safely render markdown content with security sanitization
   * @param content - The markdown content to render
   * @returns Sanitized HTML content
   */
  function renderMarkdownContent(content: string): string {
    if (!isContentSafe(content)) {
      console.warn("Potentially unsafe content detected, using plain text");
      return sanitizeHtml(content.replace(/\n/g, "<br>"));
    }
    const formatted = formatBasicMarkdown(content);
    return sanitizeHtml(formatted);
  }

  function handleUserScroll() {
    if (!messageContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = messageContainer;
    const atBottom = Math.abs(scrollTop + clientHeight - scrollHeight) < 4;
    if (atBottom) {
      autoScroll = true;
    } else {
      autoScroll = false;
    }
  }

  $effect(() => {
    if (!messageContainer) return;
    messageContainer.addEventListener("scroll", handleUserScroll, {
      passive: true,
    });
    return () => {
      messageContainer?.removeEventListener("scroll", handleUserScroll);
    };
  });

  $effect(() => {
    if (!messageContainer) return;

    let previousScrollHeight = messageContainer.scrollHeight;
    let observer: MutationObserver | null = null;

    const handleContentChange = () => {
      if (!messageContainer) return;
      if (isStreaming && autoScroll) {
        const currentScrollHeight = messageContainer.scrollHeight;
        if (
          currentScrollHeight > previousScrollHeight ||
          previousScrollHeight === 0
        ) {
          messageContainer.scrollTo({
            top: currentScrollHeight,
            behavior: "smooth",
          });
          previousScrollHeight = currentScrollHeight;
        }
      }
    };

    if (isStreaming) {
      observer = new MutationObserver(handleContentChange);
      observer.observe(messageContainer, { childList: true, subtree: true });

      if (autoScroll) {
        messageContainer.scrollTo({
          top: messageContainer.scrollHeight,
          behavior: "smooth",
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
        {#if message.audioUrl && message.type === "user"}
          <div class="audio-player-container">
            <audio controls class="audio-player" src={message.audioUrl}></audio>
          </div>
        {/if}
        {@html renderMarkdownContent(message.content)}
        {#if isStreaming && message.id === streamingMessageId}
          <span class="streaming-cursor">|</span>
        {/if}
      </div>

      {#if message.type === "assistant" && !(isStreaming && message.id === streamingMessageId)}
        <div class="message-actions">
          <button
            class="speaker-button"
            class:speaking={speakingMessageId === message.id}
            onclick={() => speakMessage(message.content, message.id)}
            title={speakingMessageId === message.id
              ? "Stop speaking"
              : "Speak message"}
            aria-label={speakingMessageId === message.id
              ? "Stop speaking"
              : "Speak message"}
          >
            <SpeakerIcon />
          </button>

          <button
            class="copy-button"
            onclick={() => copyToClipboard(message.content, message.id)}
            title="Copy message"
            aria-label="Copy message"
          >
            <CopyIcon />
          </button>

          {#if copiedMessageId === message.id}
            <div class="copied-feedback">Copied!</div>
          {/if}
        </div>
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
    scrollbar-width: thin;
    scrollbar-color: #555 #2a2a2a;
    width: 100%;
    box-sizing: border-box;
  }

  .message-container::-webkit-scrollbar {
    width: 4px;
  }

  .message-container::-webkit-scrollbar-track {
    background: #2a2a2a;
    border-radius: 2px;
  }

  .message-container::-webkit-scrollbar-thumb {
    background: #555;
    border-radius: 2px;
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
    flex-direction: column;
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
    width: 100%;
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

  .message-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    opacity: 1;
    transition: opacity 0.2s ease;
    align-self: flex-start;
  }

  .speaker-button,
  .copy-button {
    background: transparent;
    border: none;
    color: #ccc;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .copy-button {
    position: relative;
  }

  .speaker-button:hover,
  .copy-button:hover {
    color: #fff;
    background-color: rgba(255, 255, 255, 0.1);
  }

  .speaker-button:active,
  .copy-button:active {
    transform: scale(0.95);
    background-color: rgba(255, 255, 255, 0.2);
  }

  .speaker-button.speaking {
    color: #4177f1;
    background-color: rgba(65, 119, 241, 0.1);
  }

  .speaker-button.speaking:hover {
    background-color: rgba(65, 119, 241, 0.2);
  }

  .copied-feedback {
    display: inline-block;
    /* position: absolute;  // old: positioned outside actions */
    /* top: 50%;            // old: vertical centering for absolute */
    /* left: 100%;          // old: push to the right of container */
    /* transform: translateY(-50%); */
    margin-left: 8px;
    background: #666;
    width: max-content;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    animation: fadeInOut 2s ease-in-out;
  }

  @keyframes fadeInOut {
    0% {
      opacity: 1;
    }
    85% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  :global(.message > p) {
    margin: 0;
    padding: 0;
    display: inline;
  }

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

  :global(.message a) {
    color: #6bb5ff;
    text-decoration: underline;
    cursor: pointer;
    transition: color 0.2s ease;
    word-break: break-all;
  }

  :global(.message a:hover) {
    color: #8ec9ff;
    text-decoration: underline;
  }

  :global(.message a:active) {
    color: #4a9bef;
  }

  :global(.user-message a) {
    color: #d4e7ff;
  }

  :global(.user-message a:hover) {
    color: #ffffff;
  }

  :global(.user-message a:active) {
    color: #b3d4f7;
  }

  :global(.message code) {
    background-color: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: "Consolas", "Monaco", "Courier New", monospace;
    font-size: 13px;
    color: #f0f0f0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  :global(.message pre) {
    background-color: rgba(0, 0, 0, 0.3);
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 8px 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    scrollbar-width: thin;
    scrollbar-color: #555 #2a2a2a;
  }

  :global(.message pre::-webkit-scrollbar) {
    height: 4px;
  }

  :global(.message pre::-webkit-scrollbar-track) {
    background: #2a2a2a;
    border-radius: 2px;
  }

  :global(.message pre::-webkit-scrollbar-thumb) {
    background: #555;
    border-radius: 2px;
  }

  :global(.message pre::-webkit-scrollbar-thumb:hover) {
    background: #666;
  }

  :global(.message pre code) {
    background-color: transparent;
    padding: 0;
    border-radius: 0;
    font-size: 12px;
    line-height: 1.5;
    display: block;
    white-space: pre;
    word-break: normal;
  }

  :global(.user-message code) {
    background-color: rgba(0, 0, 0, 0.2);
    color: #ffffff;
  }

  :global(.user-message pre) {
    background-color: rgba(0, 0, 0, 0.4);
    border-color: rgba(255, 255, 255, 0.2);
  }

  :global(.message h1),
  :global(.message h2),
  :global(.message h3),
  :global(.message h4),
  :global(.message h5),
  :global(.message h6) {
    margin: 0 0 4px 0;
    font-weight: 600;
    line-height: 1.3;
    color: #fff;
  }

  :global(.message h1:not(:first-child)),
  :global(.message h2:not(:first-child)),
  :global(.message h3:not(:first-child)),
  :global(.message h4:not(:first-child)),
  :global(.message h5:not(:first-child)),
  :global(.message h6:not(:first-child)) {
    margin-top: 12px;
  }

  :global(.message h1) {
    font-size: 20px;
    border-bottom: 2px solid rgba(255, 255, 255, 0.2);
    padding-bottom: 4px;
  }

  :global(.message h2) {
    font-size: 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    padding-bottom: 3px;
  }

  :global(.message h3) {
    font-size: 16px;
  }

  :global(.message h4) {
    font-size: 15px;
  }

  :global(.message h5) {
    font-size: 14px;
  }

  :global(.message h6) {
    font-size: 12px;
    color: #e0e0e0;
    opacity: 0.7;
    font-weight: normal;
  }

  :global(.message table) {
    border-collapse: collapse;
    width: 100%;
    margin: 0 0 8px 0;
    font-size: 13px;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    overflow: hidden;
  }

  :global(.message table:not(:first-child)) {
    margin-top: 8px;
  }

  :global(.message th) {
    background-color: rgba(255, 255, 255, 0.1);
    padding: 8px 12px;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  :global(.message td) {
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    color: #e0e0e0;
  }

  :global(.message tr:last-child td) {
    border-bottom: none;
  }

  :global(.message tbody tr:hover) {
    background-color: rgba(255, 255, 255, 0.05);
  }

  :global(.user-message table) {
    background-color: rgba(0, 0, 0, 0.2);
  }

  :global(.user-message th) {
    background-color: rgba(0, 0, 0, 0.3);
    border-bottom-color: rgba(255, 255, 255, 0.3);
  }

  :global(.user-message td) {
    border-bottom-color: rgba(255, 255, 255, 0.2);
  }

  :global(.user-message tbody tr:hover) {
    background-color: rgba(0, 0, 0, 0.2);
  }

  :global(.message ul),
  :global(.message ol) {
    margin: 0 0 8px 0;
    padding-left: 20px;
    color: #e0e0e0;
  }

  :global(.message ul:not(:first-child)),
  :global(.message ol:not(:first-child)) {
    margin-top: 8px;
  }

  :global(.message li) {
    margin: 2px 0;
    line-height: 1.5;
  }

  :global(.user-message ul),
  :global(.user-message ol) {
    color: #fff;
  }

  :global(.message blockquote) {
    margin: 0 0 8px 0;
    padding: 8px 12px;
    border-left: 4px solid rgba(255, 255, 255, 0.3);
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    font-style: italic;
    color: #e0e0e0;
    font-size: 13px;
  }

  :global(.message h6 + blockquote) {
    margin-top: 0;
  }

  :global(.message blockquote:not(:first-child)) {
    margin-top: 8px;
  }

  :global(.message blockquote p) {
    margin: 0;
    display: block;
  }

  :global(.user-message blockquote) {
    background-color: rgba(0, 0, 0, 0.2);
    border-left-color: rgba(255, 255, 255, 0.4);
    color: #fafafa;
    font-size: 13px;
  }

  :global(.user-message h6 + blockquote) {
    margin-top: 0;
  }

  .streaming-cursor {
    animation: blink 1s infinite;
    color: #4177f1;
    font-weight: bold;
  }

  @keyframes blink {
    0%,
    50% {
      opacity: 1;
    }
    51%,
    100% {
      opacity: 0;
    }
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

  .audio-player-container {
    margin-bottom: 8px;
    padding: 8px 0;
  }

  .audio-player {
    width: 100%;
    min-width: 200px;
    max-width: 320px;
    height: 32px;
    outline: none;
    background: transparent;
    border-radius: 6px;
    color: #e5e7eb;
  }

  .audio-player::-webkit-media-controls-panel {
    border-radius: 6px;
  }

  .audio-player::-webkit-media-controls-panel {
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
  }

  .user-message .audio-player::-webkit-media-controls-panel {
    background-color: rgba(0, 0, 0, 0.2);
  }

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

    .speaker-button,
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

    .speaker-button,
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
