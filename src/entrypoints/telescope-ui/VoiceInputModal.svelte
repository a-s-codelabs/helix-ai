<script lang="ts">
  import MicIcon from './icons/Mic.svelte';
  import CloseIcon from './icons/Close.svelte';
  import StopIcon from './icons/Stop.svelte';
  import { globalStorage } from '../../lib/globalStorage';
  // import { chatStore } from '@/lib/chatStore'; // delegated to parent via onTranscribe

  let {
    isOpen = false,
    onClose,
    onTranscribe,
  }: {
    isOpen: boolean;
    onClose?: () => void;
    onTranscribe?: (text: string) => void;
  } = $props();

  let isRecording = $state(false);
  let isTranscribing = $state(false);
  // let transcribedText = $state(''); // transcription removed in favor of raw audio storage
  let errorMessage = $state('');
  let permissionDenied = $state(false);
  let isWaiting = $state(false);
  let mediaRecorder = $state<MediaRecorder | null>(null);
  let audioChunks = $state<Blob[]>([]);
  let recognition = $state<any>(null);
  let mediaStream = $state<MediaStream | null>(null);
  let recordedBlob = $state<Blob | null>(null);

  async function requestMicPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch (err: any) {
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        permissionDenied = true;
        errorMessage = '';
      } else {
        errorMessage = 'Unable to access microphone. Please check browser settings.';
      }
      return false;
    }
  }

  async function startRecording() {
    // transcribedText = '';
    recordedBlob = null;
    errorMessage = '';
    permissionDenied = false;
    isRecording = true;

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        permissionDenied = true;
        errorMessage = '';
      } else {
        errorMessage = 'Unable to access microphone. Please check browser settings.';
      }
      isRecording = false;
      return;
    }

    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
      audioChunks = [];
      mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          audioChunks = [...audioChunks, e.data];
        }
      };
      mediaRecorder.onstop = () => {
        const type = mediaRecorder?.mimeType || 'audio/webm';
        recordedBlob = new Blob(audioChunks, { type });
        audioChunks = [];
      };
      mediaRecorder.start();
    } catch (error) {
      console.error('Failed to start media recorder:', error);
      errorMessage = 'Failed to start voice recording.';
      isRecording = false;
      try {
        mediaStream?.getTracks().forEach((t) => t.stop());
      } catch {}
      mediaStream = null;
    }
  }

  function stopRecording() {
    // if (recognition) {
    //   recognition.stop();
    //   recognition = null;
    // }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
      } catch {}
    }
    try {
      mediaStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    mediaStream = null;
    isRecording = false;
  }

  async function handleSend() {
    // Store recorded voice as binary in chrome storage
    if (recordedBlob && recordedBlob.size > 0) {
      try {
        // Convert to base64 data URL to ensure JSON-safe storage
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ''));
          reader.onerror = (e) => reject(e);
          reader.readAsDataURL(recordedBlob!);
        });
        await globalStorage().set('voice_audio', {
          data: dataUrl,
          mime: recordedBlob.type || 'audio/webm',
          ts: Date.now(),
        });
        // Send the actual voice as a markdown link to the data URL
        // This renders as a clickable link in chat. Delegated to parent so it can route
        // to the correct context (sidepanel vs floating telescope).
        onTranscribe?.(`[Voice message](${dataUrl})`);
      } catch (e) {
        console.error('Failed to save voice audio:', e);
        errorMessage = 'Failed to save recorded audio.';
        return;
      }
      handleClose();
    }
  }

  function handleClose() {
    stopRecording();
    // transcribedText = '';
    errorMessage = '';
    permissionDenied = false;
    onClose?.();
  }

  $effect(() => {
    if (!isOpen) {
      stopRecording();
      // transcribedText = '';
      errorMessage = '';
      permissionDenied = false;
      isWaiting = false;
    }
  });

  async function handleTryAgain() {
    isWaiting = true;
    errorMessage = '';
    permissionDenied = false;
    setTimeout(async () => {
      isWaiting = false;
      await startRecording();
    }, 2000);
  }
</script>

{#if isOpen}
  <div class="modal-overlay" onclick={handleClose}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>Voice Input</h2>
        <button class="close-button" onclick={handleClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>

      <div class="modal-body">
        <div class="recording-indicator">
          {#if isRecording}
            <div class="pulse-circle">
              <MicIcon />
            </div>
            <p class="recording-text">Recording... Speak now</p>
          {:else if permissionDenied}
            <div class="mic-icon-container">
              <MicIcon />
            </div>
            {#if isWaiting}
              <p class="permission-denied-text">Waiting...</p>
            {:else}
              <p class="permission-denied-text">
                Didn't get that. <button class="try-again-link" onclick={handleTryAgain}>Try again</button>
              </p>
            {/if}
          {:else}
            <div class="mic-icon-container">
              <MicIcon />
            </div>
            <p class="idle-text">
              {#if recordedBlob}
                Recording complete
              {:else}
                Click the button below to start recording
              {/if}
            </p>
          {/if}
        </div>

        {#if errorMessage}
          <div class="error-message">
            {errorMessage}
          </div>
        {/if}

        {#if false}
          <!-- Transcription UI removed in favor of raw audio storage -->
        {/if}

        <div class="modal-actions">
          {#if !isRecording}
            <button class="action-button record-button" onclick={startRecording}>
              <MicIcon />
              <span>Start Recording</span>
            </button>
          {:else}
            <button class="action-button stop-button" onclick={stopRecording}>
              <StopIcon />
              <span>Stop Recording</span>
            </button>
          {/if}

          {#if recordedBlob && !isRecording}
            <button class="action-button send-button" onclick={handleSend}>
              Save Voice
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100001;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: #1f2937;
    border-radius: 16px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    border: 1px solid #374151;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid #374151;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #ffffff;
    font-family: 'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .close-button {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: #374151;
    color: #ffffff;
  }

  .modal-body {
    padding: 24px;
  }

  .recording-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 0;
  }

  .pulse-circle {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: #ef4444;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    animation: pulse 1.5s ease-in-out infinite;
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }

  .pulse-circle :global(svg) {
    width: 48px;
    height: 48px;
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
    }
    70% {
      box-shadow: 0 0 0 20px rgba(239, 68, 68, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
    }
  }

  .mic-icon-container {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: #374151;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
  }

  .mic-icon-container :global(svg) {
    width: 48px;
    height: 48px;
  }

  .recording-text,
  .idle-text,
  .permission-denied-text {
    margin-top: 16px;
    font-size: 16px;
    color: #e5e7eb;
    font-weight: 500;
  }

  .permission-denied-text {
    color: #9ca3af;
  }

  .try-again-link {
    background: none;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
    padding: 0;
    text-decoration: underline;
    font-family: inherit;
    transition: color 0.2s ease;
  }

  .try-again-link:hover {
    color: #2563eb;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
    color: #fca5a5;
    font-size: 14px;
  }

  .transcription-box {
    margin: 20px 0;
  }

  .transcription-box label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: #e5e7eb;
  }

  .transcription-box textarea {
    width: 94%;
    background: #111827;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 12px;
    color: #ffffff;
    font-size: 14px;
    font-family: 'Sora', inherit;
    resize: vertical;
    outline: none;
    transition: border-color 0.2s ease;
  }

  .transcription-box textarea:focus {
    border-color: #3b82f6;
  }

  .modal-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 20px;
  }

  .action-button {
    padding: 12px 24px;
    border-radius: 10px;
    border: none;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: 'Sora', inherit;
  }

  .action-button :global(svg) {
    width: 20px;
    height: 20px;
  }

  .record-button {
    background: #3b82f6;
    color: white;
  }

  .record-button:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .stop-button {
    background: #ef4444;
    color: white;
  }

  .stop-button:hover {
    background: #dc2626;
  }

  .send-button {
    background: #10b981;
    color: white;
  }

  .send-button:hover {
    background: #059669;
    transform: translateY(-1px);
  }
</style>

