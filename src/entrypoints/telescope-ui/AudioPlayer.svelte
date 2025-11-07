<script lang="ts">
  let { audioUrl }: { audioUrl: string } = $props();

  let audioElement = $state<HTMLAudioElement | undefined>(undefined);
  let isPlaying = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);

  // Generate waveform bars data
  const waveformBars = Array.from({ length: 20 }, () => ({
    height: Math.random() * 60 + 20, // Random height between 20-80px
  }));

  function formatTime(seconds: number): string {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function togglePlay() {
    if (!audioElement) return;
    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play();
    }
  }

  function handleTimeUpdate() {
    if (!audioElement) return;
    currentTime = audioElement.currentTime;
  }

  function handleLoadedMetadata() {
    if (!audioElement) return;
    duration = audioElement.duration;
  }

  function handlePlay() {
    isPlaying = true;
  }

  function handlePause() {
    isPlaying = false;
  }

  function handleEnded() {
    isPlaying = false;
    currentTime = 0;
  }
</script>

<div class="audio-player-wrapper">
  <button class="play-button" onclick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
    {#if isPlaying}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="4" width="4" height="16" fill="currentColor" />
        <rect x="14" y="4" width="4" height="16" fill="currentColor" />
      </svg>
    {:else}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 5V19L19 12L8 5Z" fill="currentColor" />
      </svg>
    {/if}
  </button>

  <div class="waveform-container">
    {#each waveformBars as bar, index}
      <div
        class="waveform-bar"
        class:active={isPlaying}
        style="height: {bar.height}%; animation-delay: {index * 0.05}s;"
      ></div>
    {/each}
  </div>

  <div class="duration">
    {#if isPlaying}
      {formatTime(currentTime)}
    {:else if duration > 0}
      {formatTime(duration)}
    {:else}
      {formatTime(0)}
    {/if}
  </div>

  <audio
    bind:this={audioElement}
    src={audioUrl}
    ontimeupdate={handleTimeUpdate}
    onloadedmetadata={handleLoadedMetadata}
    onplay={handlePlay}
    onpause={handlePause}
    onended={handleEnded}
  ></audio>
</div>

<style>
  .audio-player-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #2d3035;
    border-radius: 9999px;
    padding: 8px 16px;
    min-width: 200px;
    max-width: 320px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .play-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #4285f4;
    border: none;
    cursor: pointer;
    color: white;
    flex-shrink: 0;
    transition: all 0.2s ease;
    padding: 0;
  }

  .play-button:hover {
    background: #3367d6;
    transform: scale(1.05);
  }

  .play-button:active {
    transform: scale(0.95);
  }

  .waveform-container {
    display: flex;
    align-items: center;
    gap: 3px;
    flex: 1;
    height: 32px;
    justify-content: center;
  }

  .waveform-bar {
    width: 3px;
    background: #b0b0b0;
    border-radius: 2px;
    transition: height 0.1s ease;
    min-height: 4px;
  }

  .waveform-bar.active {
    animation: waveform-pulse 1.2s ease-in-out infinite;
  }

  @keyframes waveform-pulse {
    0%, 100% {
      opacity: 0.4;
      transform: scaleY(0.8);
    }
    50% {
      opacity: 1;
      transform: scaleY(1);
    }
  }

  .duration {
    color: #b0b0b0;
    font-size: 12px;
    font-family: "Sora", sans-serif;
    font-weight: 500;
    flex-shrink: 0;
    min-width: 36px;
    text-align: right;
  }
</style>

