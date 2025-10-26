<script lang="ts">
  import Counter from "../../lib/Counter.svelte";
  import { onMount, onDestroy } from 'svelte';

  // State management
  let telescopeEnabled = $state(true);
  let useDefaultKeyBinding = $state(true);
  let textToSpeechEnabled = $state(true);
  let languagePreference = $state("English");
  let answerFormat = $state("Direct Answer");

  // Reference to main element for outside click detection
  let mainElement: HTMLElement;

  // Language options
  const languageOptions = [
    "English", "Spanish", "French", "German", "Italian", "Portuguese", "Chinese", "Japanese", "Korean"
  ];

  // Answer format options
  const answerFormatOptions = [
    "Direct Answer", "Summary", "Detailed Explanation"
  ];

  function openTelescopeSidePanel() {
    // Open the side panel
    if (typeof chrome !== "undefined" && chrome.sidePanel && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentWindowId = tabs[0]?.windowId;
        if (currentWindowId) {
          chrome.sidePanel.open({ windowId: currentWindowId })
            .then(() => {
              console.log("Side panel opened successfully");
              // Close the popup after opening side panel
              window.close();
            })
            .catch((error: Error) => {
              console.error("Error opening side panel:", error);
            });
        }
      });
    } else {
      console.error("Side panel API not available");
    }
  }

  function openTelescopeSearch() {
    // Send message to content script to open telescope
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { action: "openTelescope" },
            (response: any) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Error sending message:",
                  chrome.runtime.lastError
                );
              } else {
                console.log("Message sent successfully");
              }
            }
          );
          // Close the popup after opening telescope
          window.close();
        }
      });
    }
  }

  function openTelescopeDemo() {
    // Open the telescope UI demo page
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL("telescope-ui.html") });
    }
  }

  function handleSubmit() {
    // Save settings and close popup
    console.log("Settings saved:", {
      telescopeEnabled,
      useDefaultKeyBinding,
      textToSpeechEnabled,
      languagePreference,
      answerFormat
    });
    window.close();
  }

  // Handle clicks outside the popup to close it
  function handleClickOutside(event: MouseEvent) {
    if (mainElement && !mainElement.contains(event.target as Node)) {
      window.close();
    }
  }

  // Set up event listeners
  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  });
</script>

<main bind:this={mainElement}>
  <div class="header">
    <div class="header-content">
      <h1>Helix</h1>
      <p class="subtitle">AI search assistant for smarter website queries.</p>
    </div>
    <button class="header-button" onclick={openTelescopeSidePanel}>
      Open Telescope
    </button>
  </div>

  <div class="settings-section">
    <h3>Key binding</h3>
    <div class="checkbox-row">
      <span class="checkbox-text">Use default key binding</span>
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={useDefaultKeyBinding} />
        <span class="checkmark"></span>
      </label>
    </div>

    <div class="key-binding-container">
      <div class="search-input-container">
        <input
          type="text"
          value="Search Telescope"
          readonly
          class="search-input"
          onclick={openTelescopeSearch}
        />
        <div class="key-combination">
          <kbd>CTRL</kbd>
          <span class="plus">+</span>
          <kbd>E</kbd>
        </div>
      </div>
      <div class="info-text">
        <svg class="info-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4"></path>
          <path d="M12 8h.01"></path>
        </svg>
        Press the search key twice to trigger default browser search.
      </div>
    </div>
  </div>

  <div class="settings-section">
    <div class="section-header">
      <h3>Text-to-Speech</h3>
      <label class="toggle">
        <input type="checkbox" bind:checked={textToSpeechEnabled} />
        <span class="slider"></span>
      </label>
    </div>
    <div class="info-text">
      <svg class="info-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 16v-4"></path>
        <path d="M12 8h.01"></path>
      </svg>
      Converts answers into speech so you can listen instead of reading.
    </div>
  </div>

  <div class="settings-section">
    <h3>Language Preference</h3>
    <div class="dropdown-container">
      <select bind:value={languagePreference} class="dropdown">
        {#each languageOptions as option}
          <option value={option}>{option}</option>
        {/each}
      </select>
    </div>
    <div class="info-text">
      <svg class="info-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 16v-4"></path>
        <path d="M12 8h.01"></path>
      </svg>
      Choose your preferred language for AI responses and results.
    </div>
  </div>

  <div class="settings-section">
    <h3>Answer Format</h3>
    <div class="dropdown-container">
      <select bind:value={answerFormat} class="dropdown">
        {#each answerFormatOptions as option}
          <option value={option}>{option}</option>
        {/each}
      </select>
    </div>
    <div class="info-text">
      <svg class="info-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 16v-4"></path>
        <path d="M12 8h.01"></path>
      </svg>
      Select how answers should be displayed Direct, Summary or Detailed Explanation.
    </div>
  </div>

  <button class="submit-button" onclick={handleSubmit}>
    Submit
  </button>
</main>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap");

  /* CSS Reset to prevent external interference */
  * {
    box-sizing: border-box;
  }

  /* Prevent horizontal overflow globally */
  * {
    max-width: 100%;
    overflow-x: hidden;
  }

  main {
    width: 400px !important;
    height: auto;
    padding: 0 0 80px 0 !important;
    margin: 0 !important;
    font-family:
      "Sora",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
    background: #0a0a0a;
    color: #ffffff;
    border-radius: 0;
    box-sizing: border-box;
    overflow: hidden;
    max-width: none !important;
    text-align: left !important;
    position: relative;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 20px 20px 20px;
    margin-bottom: 8px;
  }

  .header-content h1 {
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 8px 0;
    color: #ffffff;
  }

  .subtitle {
    color: #9ca3af;
    font-size: 12px;
    margin: 0;
    line-height: 1.4;
    margin-left: 6px;
  }

  .header-button {
    width: 140px;
    height: 36px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0;
    padding: 8px 12px;
    text-wrap: nowrap;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-sizing: border-box;

  }

  .header-button:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .header-button:active {
    transform: translateY(0);
  }


  .settings-section {
    padding: 0 20px;
    margin-bottom: 6px;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }

  .settings-section h3 {
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
    margin: 0 0 6px 0;
  }


  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .section-header h3 {
    margin: 0;
  }

  .checkbox-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .checkbox-label {
    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    display: none;
  }

  .checkmark {
    width: 20px;
    height: 20px;
    background: #3b82f6;
    border-radius: 0;
    position: relative;
    transition: all 0.2s ease;
  }

  .checkmark::after {
    content: "";
    position: absolute;
    left: 6px;
    top: 2px;
    width: 6px;
    height: 10px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    opacity: 1;
  }

  .checkbox-label input[type="checkbox"]:not(:checked) + .checkmark {
    background: #262832;
    border: 1px solid #404040;
  }

  .checkbox-label input[type="checkbox"]:not(:checked) + .checkmark::after {
    opacity: 0;
  }

  .checkbox-text {
    color: #9ca3af;
    font-size: 13px;
    margin: 0;
    flex: 1;
  }

  .key-binding-container {
    margin-top: 12px;
    width: 100%;
    overflow: hidden;
  }

  .search-input-container {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 6px;
    width: 100%;
    height: 44px;
    box-sizing: border-box;
    overflow: hidden;
    background: #262832;
    border: 1px solid #404040;
    border-radius: 0;
    padding: 6px 12px;
  }

  .search-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    color: #ffffff;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-sizing: border-box;
    outline: none;
  }

  .search-input:hover {
    color: #ffffff;
  }

  .search-input-container:hover {
    border-color: #555;
    background: #2a2a2a;
  }

  .key-combination {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    white-space: nowrap;
    min-width: fit-content;
  }

  .key-combination span {
    color: #d1d5db;
    font-size: 12px;
  }

  .plus {
    color: #d1d5db;
    font-size: 12px;
    font-weight: 500;
  }

  kbd {
    background: #3E424B;
    border: 1px solid #4b5563;
    border-radius: 0;
    padding: 2px 6px;
    font-family: monospace;
    font-size: 10px;
    color: #ffffff;
    min-width: 32px;
    text-align: center;
    flex-shrink: 0;
    white-space: nowrap;
    font-weight: 500;
  }

  .info-text {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    color: #9ca3af;
    font-size: 12px;
    line-height: 1.4;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    max-width: calc(100% - 10px);
    margin-bottom: 16px;
  }

  .info-icon {
    color: #6b7280;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .dropdown-container {
    margin-bottom: 6px;
  }

  .dropdown {
    width: 100%;
    background: #262832;
    border: 1px solid #404040;
    border-radius: 0;
    padding: 8px 12px;
    color: #ffffff;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }

  .dropdown:hover {
    border-color: #555;
    background: #2a2a2a;
  }

  .dropdown:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .dropdown option {
    background: #262832;
    color: #ffffff;
  }

  .toggle {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    cursor: pointer;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #262832;
    border: 1px solid #404040;
    transition: 0.2s;
    border-radius: 24px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 2px;
    bottom: 2px;
    background-color: #9ca3af;
    transition: 0.2s;
    border-radius: 50%;
  }

  .toggle input:checked + .slider {
    background-color: #3b82f6;
    border-color: #3b82f6;
  }

  .toggle input:checked + .slider:before {
    transform: translateX(20px);
    background-color: white;
  }

  .submit-button {
    width: 225px;
    height: 48px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0;
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    position: absolute;
    bottom: 20px;
    right: 20px;
    box-sizing: border-box;
    z-index: 10;
  }


  .submit-button:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .submit-button:active {
    transform: translateY(0);
  }
</style>
