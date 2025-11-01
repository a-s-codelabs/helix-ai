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
        
        // Stop all tracks
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

      // Start timer
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
      // Convert blob to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      // Generate unique ID
      const blobId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store audio blob
      const storage = globalStorage();
      const currentBlobs = (await storage.get("audioBlobs")) || {};
      await storage.set("audioBlobs", {
        ...currentBlobs,
        [blobId]: base64,
      });

      // Send audio to sidepanel via action_state
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
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
    <div class="mic-recorder-header">
      <button class="close-button" onclick={handleCancel} aria-label="Close">
        <CloseIcon />
      </button>
    </div>
    
    <div class="mic-recorder-content">
      {#if !isRecording}
        <button class="start-button" onclick={startRecording} aria-label="Start recording">
          <MicIcon />
          <span>Start Recording</span>
        </button>
      {:else}
        <div class="recording-content">
          <div class="recording-indicator">
            <div class="pulse"></div>
            <MicIcon />
          </div>
          <div class="recording-time">{formatTime(recordingTime)}</div>
          <button class="stop-button" onclick={stopRecording} aria-label="Stop recording">
            <StopIcon />
            <span>Stop</span>
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
    background: rgba(17, 24, 39, 0.95);
    border-radius: 16px;
    padding: 24px;
    min-width: 280px;
    box-shadow:
      0 10px 25px -5px rgba(0, 0, 0, 0.3),
      0 8px 10px -6px rgba(0, 0, 0, 0.2),
      0 0 0 1px rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
  }

  .mic-recorder-header {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 16px;
  }

  .close-button {
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: #374151;
    color: #ffffff;
  }

  .mic-recorder-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .start-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 24px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 50%;
    width: 120px;
    height: 120px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .start-button:hover {
    background: #2563eb;
    transform: scale(1.05);
  }

  .recording-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .recording-indicator {
    position: relative;
    width: 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .recording-indicator svg {
    position: relative;
    z-index: 2;
    width: 48px;
    height: 48px;
    color: #ef4444;
  }

  .pulse {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.3);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.2);
      opacity: 0.7;
    }
  }

  .recording-time {
    font-size: 24px;
    font-weight: 600;
    color: #ffffff;
    font-variant-numeric: tabular-nums;
  }

  .stop-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .stop-button:hover {
    background: #dc2626;
    transform: scale(1.05);
  }
</style>

