<script lang="ts">
  import MicIcon from "../telescope-ui/icons/Mic.svelte";
  import StopIcon from "../telescope-ui/icons/Stop.svelte";
  import CloseIcon from "../telescope-ui/icons/Close.svelte";
  import { globalStorage } from "@/lib/globalStorage";

  interface Props {
    onClose?: () => void;
  }

  let { onClose }: Props = $props();

  let isRecording = $state(false);
  let mediaRecorder: MediaRecorder | null = $state(null);
  let audioChunks: Blob[] = $state([]);
  let recordingTime = $state(0);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        await handleAudioComplete(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        stopRecording();
      };

      mediaRecorder = recorder;
      recorder.start();
      isRecording = true;
      recordingTime = 0;

      timerInterval = setInterval(() => {
        recordingTime++;
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Failed to access microphone. Please grant permission.");
      onClose?.();
    }
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;

      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }
  }

  async function handleAudioComplete(audioBlob: Blob) {
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const blobId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const storage = globalStorage();
      const currentBlobs = (await storage.get("audioBlobs")) || {};
      await storage.set("audioBlobs", {
        ...currentBlobs,
        [blobId]: base64,
      });

      await storage.set("action_state", {
        actionSource: "audio",
        blobId: blobId,
      });

      onClose?.();
    } catch (error) {
      console.error("Error processing audio:", error);
      alert("Failed to save audio recording.");
    }
  }

  function handleCancel() {
    stopRecording();
    onClose?.();
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  $effect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
      if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
      }
    };
  });
</script>

<div class="mic-recorder-container">
  <div class="mic-recorder">
    <div class="background-gradient"></div>
    <div class="background-glow background-glow-blue"></div>
    <div class="background-glow background-glow-purple"></div>

    <div class="mic-recorder-header">
      <button class="close-button" onclick={handleCancel} aria-label="Close">
        <CloseIcon />
      </button>
    </div>

    <div class="mic-recorder-content">
      {#if !isRecording}
        <button class="start-button" onclick={startRecording} aria-label="Start recording">
          <div class="start-button-glow"></div>
          <div class="start-button-main">
            <MicIcon />
            <span>Start Recording</span>
          </div>
          <div class="start-button-ring"></div>
        </button>
      {:else}
        <div class="recording-content">
          <div class="recording-indicator">
            <div class="pulse-ring pulse-ring-1"></div>
            <div class="pulse-ring pulse-ring-2"></div>
            <div class="recording-indicator-outer">
              <div class="recording-indicator-inner">
                <MicIcon />
              </div>
            </div>
          </div>
          <div class="recording-time">{formatTime(recordingTime)}</div>
          <button class="stop-button" onclick={stopRecording} aria-label="Stop recording">
            <div class="stop-button-glow"></div>
            <div class="stop-button-main">
              <StopIcon />
              <span>Stop</span>
            </div>
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .mic-recorder-container {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  .mic-recorder {
    position: relative;
    background: linear-gradient(to bottom right, #020617, #0f172a, #020617);
    border-radius: 16px;
    padding: 24px;
    min-width: 320px;
    min-height: 400px;
    box-shadow:
      0 10px 25px -5px rgba(0, 0, 0, 0.3),
      0 8px 10px -6px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .background-gradient {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.05), transparent 50%);
    pointer-events: none;
  }

  .background-glow {
    position: absolute;
    width: 384px;
    height: 384px;
    border-radius: 50%;
    filter: blur(96px);
    pointer-events: none;
  }

  .background-glow-blue {
    top: 0;
    left: 0;
    background: rgba(59, 130, 246, 0.05);
    transform: translate(-50%, -50%);
  }

  .background-glow-purple {
    bottom: 0;
    right: 0;
    background: rgba(168, 85, 247, 0.05);
    transform: translate(50%, 50%);
  }

  .mic-recorder-header {
    position: relative;
    display: flex;
    justify-content: flex-end;
    margin-bottom: 16px;
    z-index: 10;
  }

  .close-button {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .close-button :global(svg) {
    width: 20px;
    height: 20px;
  }

  .mic-recorder-content {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10;
    min-height: 300px;
  }

  /* Start button styles */
  .start-button {
    position: relative;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
  }

  .start-button:hover {
    transform: scale(1.05);
  }

  .start-button-glow {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: rgba(59, 130, 246, 0.2);
    filter: blur(32px);
    transition: all 0.3s ease;
  }

  .start-button:hover .start-button-glow {
    background: rgba(59, 130, 246, 0.3);
  }

  .start-button-main {
    position: relative;
    width: 192px;
    height: 192px;
    border-radius: 50%;
    background: linear-gradient(to bottom right, #3b82f6, #2563eb);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.3);
    transition: all 0.3s ease;
  }

  .start-button:hover .start-button-main {
    box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.5);
  }

  .start-button-main :global(svg) {
    width: 48px;
    height: 48px;
    color: white;
    margin-bottom: 4px;
  }

  .start-button-main span {
    color: white;
    font-size: 14px;
    font-weight: 500;
  }

  .start-button-ring {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid rgba(96, 165, 250, 0.3);
    transition: all 0.3s ease;
  }

  .start-button:hover .start-button-ring {
    border-color: rgba(96, 165, 250, 0.5);
  }

  .recording-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  .recording-indicator {
    position: relative;
    width: 192px;
    height: 192px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pulse-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.2);
  }

  .pulse-ring-1 {
    animation: pulse-ring-1 2s ease-in-out infinite;
  }

  .pulse-ring-2 {
    animation: pulse-ring-2 2s ease-in-out infinite;
  }

  @keyframes pulse-ring-1 {
    0%, 100% {
      transform: scale(1);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.3);
      opacity: 0;
    }
  }

  @keyframes pulse-ring-2 {
    0%, 100% {
      transform: scale(1);
      opacity: 0.3;
    }
    50% {
      transform: scale(1.5);
      opacity: 0;
    }
  }

  .pulse-ring-2 {
    animation-delay: 0.5s;
  }

  .recording-indicator-outer {
    position: relative;
    width: 192px;
    height: 192px;
    border-radius: 50%;
    background: linear-gradient(to bottom right, rgba(127, 29, 29, 0.5), rgba(69, 10, 10, 0.5));
    backdrop-filter: blur(4px);
    border: 1px solid rgba(239, 68, 68, 0.3);
    box-shadow: 0 20px 25px -5px rgba(239, 68, 68, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .recording-indicator-inner {
    width: 128px;
    height: 128px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse-inner 1.5s ease-in-out infinite;
  }

  @keyframes pulse-inner {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  .recording-indicator-inner :global(svg) {
    width: 32px;
    height: 32px;
    color: #f87171;
  }

  .recording-time {
    font-size: 48px;
    font-weight: 600;
    color: #ffffff;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.05em;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  }

  .stop-button {
    position: relative;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: all 0.3s ease;
  }

  .stop-button:hover {
    transform: scale(1.05);
  }

  .stop-button-glow {
    position: absolute;
    inset: -8px;
    border-radius: 16px;
    background: rgba(239, 68, 68, 0.2);
    filter: blur(24px);
    transition: all 0.3s ease;
  }

  .stop-button:hover .stop-button-glow {
    background: rgba(239, 68, 68, 0.3);
  }

  .stop-button-main {
    position: relative;
    padding: 16px 32px;
    border-radius: 16px;
    background: linear-gradient(to bottom right, #ef4444, #dc2626);
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.2);
    transition: all 0.3s ease;
  }

  .stop-button:hover .stop-button-main {
    background: linear-gradient(to bottom right, #dc2626, #b91c1c);
    box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.4);
  }

  .stop-button-main :global(svg) {
    width: 20px;
    height: 20px;
    color: white;
    fill: white;
  }

  .stop-button-main span {
    color: white;
    font-size: 14px;
    font-weight: 600;
  }
</style>

