<script lang="ts">
  import { onMount } from "svelte";
  import { globalStorage } from "@/lib/globalStorage";
  import { Source } from "@/lib/dbSchema";

  let showDownloadingDropdown = $state(false);
  let isDownloading = $state(false);
  let showDropdown = $state(false);
  let downloadStatuses = $state<Record<string, any>>({});
  let downloadHistory = $state<any[]>([]);
  let lastDownloadCount = $state(0);

  // Play completion sound
  function playCompletionSound() {
    try {
      // Create a simple beep sound using Web Audio API
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
      console.log("Could not play completion sound:", error);
    }
  }

  // Get source display name
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

  // Check download status
  async function checkDownloadStatus() {
    try {
      console.log("==== Check for status ====");
      const status = await globalStorage().get("downloadStatus");
      console.log("==== Status ====", status);
      if (status) {
        downloadStatuses = status;

        // Check if any downloads are active
        const activeDownloads = Object.values(status).filter(
          (download: any) => download.loaded < 1
        );

        showDownloadingDropdown = Object.keys(status).length > 0;

        const wasDownloading = isDownloading;
        isDownloading = activeDownloads.length > 0;

        // Play sound when download completes
        if (wasDownloading && !isDownloading && activeDownloads.length === 0) {
          playCompletionSound();
        }

        // Update download history (last 5)
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

  // Watch for download status changes
  onMount(() => {
    // Initial check
    checkDownloadStatus();

    // Watch for changes
    const unwatch = globalStorage().watch(
      "local:global:downloadStatus",
      checkDownloadStatus
    );

    // Also poll periodically as backup
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

<div class="sidepanel-header">
  <p>Telescope</p>
  {#if showDownloadingDropdown}
    <div
      class="dropdown-container"
      onclick={toggleDropdown}
      onkeydown={(e) => e.key === "Enter" && toggleDropdown()}
      role="button"
      tabindex="0"
    >
      <span class="dropdown-icon">
        <!-- ChevDown SVG icon -->
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
            <div class="history-header">Modal download history</div>
            {#each downloadHistory as download}
              <div class="download-item">
                <div class="download-info">
                  <span class="download-source"
                    >{getSourceDisplayName(download.source)}</span
                  >
                  <span class="download-time"
                    >{formatTimestamp(download.createdAt)}</span
                  >
                </div>
                <div class="download-progress">
                  {#if download.loaded < 1}
                    <div class="progress-bar">
                      <div
                        class="progress-fill"
                        style="width: {download.loaded * 100}%"
                      ></div>
                    </div>
                    <span class="progress-text"
                      >{formatProgress(download.loaded)}</span
                    >
                  {:else if download.loaded >= 1}
                    <span class="completed">✓ Complete</span>
                  {:else}
                    <span class="pending">Pending</span>
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
    background: #0a0a0a;
    user-select: none;
    padding: 0 0.7em;
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
    background: #23223a;
    color: #fff;
    box-shadow: 0 2px 8px 0 #0005;
    border-radius: 8px;
    padding: 0.65em 1.25em;
    min-width: 250px;
    max-width: 300px;
    z-index: 99;
    font-size: 0.93rem;
    margin-top: 0.2em;
  }

  .download-history {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }

  .history-header {
    letter-spacing: 0.12em;
    font-weight: 600;
    margin-bottom: 0.5em;
    padding-bottom: 0.5em;
    border-bottom: 1px solid #444;
  }

  .download-item {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
    padding: 0.5em;
    background: #1a1a2e;
    border-radius: 4px;
  }

  .download-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
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
    background: #333;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #00baff, #0088cc);
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 0.8em;
    color: #00baff;
    min-width: 35px;
    text-align: right;
  }

  .completed {
    font-size: 0.8em;
    color: #4caf50;
    font-weight: 500;
  }

  .pending {
    font-size: 0.8em;
    color: #ff9800;
  }

  .no-downloads {
    text-align: center;
    color: #666;
    font-style: italic;
    padding: 1em;
  }
</style>
