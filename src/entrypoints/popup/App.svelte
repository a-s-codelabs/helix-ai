<script lang="ts">
  import svelteLogo from "../../assets/svelte.svg";
  import Counter from "../../lib/Counter.svelte";

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
</script>

<main>
  <div class="header">
    <h1>Telescope Search</h1>
    <p class="subtitle">AI-powered search and analysis</p>
  </div>

  <div class="actions">
    <button class="primary-button" onclick={openTelescopeSearch}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
      </svg>
      Open Search !
    </button>

    <button class="secondary-button" onclick={openTelescopeDemo}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <path d="M9 9h6v6H9z"></path>
      </svg>
      Demo Interface
    </button>
  </div>

  <div class="shortcuts">
    <h3>Keyboard Shortcuts</h3>
    <div class="shortcut-item">
      <kbd>Cmd+F</kbd>
      <span>Open search on current page</span>
    </div>
    <div class="shortcut-item">
      <kbd>Escape</kbd>
      <span>Close search interface</span>
    </div>
  </div>

  <div class="card">
    <Counter />
  </div>
</main>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap");

  main {
    width: 320px;
    padding: 20px;
    font-family:
      "Sora",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
    background: #0a0a0a;
    color: #ffffff;
    min-height: 400px;
  }

  .header {
    text-align: center;
    margin-bottom: 24px;
  }

  .header h1 {
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 8px 0;
    color: #ffffff;
  }

  .subtitle {
    color: #9ca3af;
    font-size: 14px;
    margin: 0;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
  }

  .primary-button,
  .secondary-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    font-family: inherit;
  }

  .primary-button {
    background: #3b82f6;
    color: white;
  }

  .primary-button:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .secondary-button {
    background: #262832;
    color: #d1d5db;
    border: 1px solid #404040;
  }

  .secondary-button:hover {
    background: #404040;
    border-color: #555;
  }

  .shortcuts {
    background: #1a1a1a;
    border: 1px solid #404040;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .shortcuts h3 {
    color: #d1d5db;
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 12px 0;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .shortcut-item:last-child {
    margin-bottom: 0;
  }

  .shortcut-item span {
    color: #9ca3af;
    font-size: 13px;
  }

  kbd {
    background: #262832;
    border: 1px solid #404040;
    border-radius: 4px;
    padding: 4px 8px;
    font-family: monospace;
    font-size: 11px;
    color: #d1d5db;
    min-width: 40px;
    text-align: center;
  }

  .card {
    background: #1a1a1a;
    border: 1px solid #404040;
    border-radius: 8px;
    padding: 16px;
  }
</style>
