<script lang="ts">
  import { onMount } from "svelte";
  import { globalStorage } from "@/lib/globalStorage";
  import type { Source } from "@/lib/dbSchema";

  let showDownloadingDropdown = $state(false);
  let isDownloading = $state(false);
  let showDropdown = $state(false);
  let downloadStatuses = $state<Record<string, any>>({});
  let downloadHistory = $state<any[]>([]);
  let lastDownloadCount = $state(0);

  let { hasChatBox = false } = $props();
  function playCompletionSound() {
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.2
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.error("Could not play completion sound:", error);
    }
  }

  function getSourceDisplayName(source: Source): string {
    const sourceNames: Record<Source, string> = {
      prompt: "Language Model",
      summarize: "Summarizer",
      translator: "Translator",
      "language-detector": "Language Detector",
      writer: "Writer",
      rewriter: "Rewriter",
    };
    return sourceNames[source] || source;
  }

  async function checkDownloadStatus() {
    try {
      const status = await globalStorage().get("downloadStatus");
      if (status) {
        downloadStatuses = status;

        const activeDownloads = Object.values(status).filter(
          (download: any) => download.loaded < 1
        );

        showDownloadingDropdown = Object.keys(status).length > 0;

        const wasDownloading = isDownloading;
        isDownloading = activeDownloads.length > 0;

        if (wasDownloading && !isDownloading && activeDownloads.length === 0) {
          playCompletionSound();
        }

        const allDownloads = Object.values(status)
          .filter((download: any) => download.createdAt)
          .sort((a: any, b: any) => b.createdAt - a.createdAt)
          .slice(0, 5);

        downloadHistory = allDownloads;
      }
    } catch (error) {
      console.error("Error checking download status:", error);
    }
  }

  onMount(() => {
    checkDownloadStatus();

    const unwatch = globalStorage().watch(
      "local:global:downloadStatus",
      checkDownloadStatus
    );

    const pollInterval = setInterval(checkDownloadStatus, 1000);

    return () => {
      unwatch?.();
      clearInterval(pollInterval);
    };
  });

  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  function formatProgress(loaded: number): string {
    return `${Math.round(loaded * 100)}%`;
  }

  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }
</script>

<div class="sidepanel-header" class:has-chat-box={hasChatBox}>
  <span class="brand-name">Telescope</span>


  {#if showDownloadingDropdown}
    <div
      class="dropdown-container"
      onclick={toggleDropdown}
      onkeydown={(e) => e.key === "Enter" && toggleDropdown()}
      role="button"
      tabindex="0"
    >
      <span class="dropdown-icon">
        <div class="w-8 flex items-center justify-center p-[10px]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-download-icon lucide-download"
            ><path d="M12 15V3" /><path
              d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
            /><path d="m7 10 5 5 5-5" /></svg
          >
          {#if isDownloading}
            <span class="loading-circle"></span>
          {/if}
        </div>
      </span>
      {#if showDropdown}
        <div class="dropdown-menu">
          <div class="download-history">
            <div class="history-header">
              <span class="history-title">Downloads</span>
              <span class="history-sub">Recent activity</span>
            </div>
            {#each downloadHistory as download}
              <div class="download-item">
                <div class="download-info">
                  <div class="download-left">
                    <span class="download-dot" aria-hidden="true"></span>
                    <span class="download-source">{getSourceDisplayName(download.source)}</span>
                  </div>
                  <span class="download-time">{formatTimestamp(download.createdAt)}</span>
                </div>
                <div class="download-progress">
                  {#if download.loaded < 1}
                    <div class="progress-bar is-active">
                      <div
                        class="progress-fill"
                        style="width: {download.loaded * 100}%"
                      ></div>
                    </div>
                    <span class="chip chip-info">{formatProgress(download.loaded)}</span>
                  {:else if download.loaded >= 1}
                    <span class="chip chip-success">✓ Complete</span>
                  {:else}
                    <span class="chip chip-warn">Pending</span>
                  {/if}
                </div>
              </div>
            {/each}
            {#if downloadHistory.length === 0}
              <div class="no-downloads">No downloads yet</div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .sidepanel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: transparent;
    user-select: none;
    padding: 0 0.7em;
    height: 42px;
  }
  .sidepanel-header.has-chat-box {
    background: #131723;
    border-bottom: 1px solid #23253a;
    box-shadow: 0 1px 0 0 #0b0e18;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #e5e7eb;
    font-weight: 600;
    letter-spacing: 0.2px;
    padding: 6px 10px;
    border-radius: 10px;
    background: linear-gradient(180deg, #0f1422, #0b1020);
    border: 1px solid #23253a;
    box-shadow: inset 0 1px 0 0 #1b2132; /* subtle inner */
  }
  .brand-icon {
    color: #00baff;
    display: inline-flex;
  }
  .brand-name {
    font-size: 0.95rem;
  }
  .brand-badge {
    font-size: 10px;
    line-height: 1;
    color: #00baff;
    background: #062635;
    border: 1px solid #0b3f57;
    padding: 3px 6px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .dropdown-container {
    position: relative;
    display: inline-block;
    cursor: pointer;
    margin-left: 1em;
    border-radius: 4px;
    outline: none;
  }

  .dropdown-container:focus {
    outline: 2px solid #00baff;
    outline-offset: 2px;
  }
  .dropdown-icon {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .loading-circle {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin: auto;
    width: 22px;
    height: 22px;
    border: 2.5px solid #00baff44;
    border-bottom-color: #00baff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    pointer-events: none;
    margin-left: -5px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .dropdown-menu {
    position: absolute;
    top: 110%;
    right: 0;
    background: #0e1322;
    color: #fff;
    box-shadow: 0 8px 24px rgba(0,0,0,0.45);
    border-radius: 12px;
    padding: 0.85em 1.1em 1em 1.1em;
    min-width: 280px;
    max-width: 320px;
    z-index: 99;
    font-size: 0.93rem;
    margin-top: 0.2em;
    border: 1px solid #1d2334;
  }

  .download-history {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }

  .history-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 0.75em;
    padding-bottom: 0.6em;
    border-bottom: 1px solid #23283b;
  }
  .history-title {
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #e5e7eb;
  }
  .history-sub {
    font-size: 12px;
    color: #7d889a;
  }

  .download-item {
    display: flex;
    flex-direction: column;
    gap: 0.4em;
    padding: 0.6em 0.6em 0.55em 0.6em;
    background: linear-gradient(180deg, #0f1526, #0d1324);
    border-radius: 10px;
    border: 1px solid #1b2132;
  }

  .download-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .download-left {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .download-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: #00baff;
    box-shadow: 0 0 0 2px rgba(0,186,255,0.2);
  }

  .download-source {
    font-weight: 500;
    color: #00baff;
  }

  .download-time {
    font-size: 0.8em;
    color: #888;
  }

  .download-progress {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }

  .progress-bar {
    flex: 1;
    height: 4px;
    background: #1a2133;
    border-radius: 999px;
    overflow: hidden;
    position: relative;
  }
  .progress-bar.is-active::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: shimmer 1.2s linear infinite;
    pointer-events: none;
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #00baff, #0088cc);
    transition: width 0.3s ease;
  }
  .chip {
    font-size: 11px;
    line-height: 1;
    padding: 6px 8px;
    border-radius: 999px;
    border: 1px solid transparent;
    font-weight: 600;
  }
  .chip-info { color: #00baff; background: #062635; border-color: #0b3f57; }
  .chip-success { color: #4caf50; background: #083017; border-color: #1b5e20; }
  .chip-warn { color: #ffb74d; background: #3a2608; border-color: #5d3a0c; }

  .no-downloads {
    text-align: center;
    color: #666;
    font-style: italic;
    padding: 1em;
  }
</style>
