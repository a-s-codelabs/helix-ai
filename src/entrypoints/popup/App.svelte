<script lang="ts">
  import { onMount } from "svelte";
  import { globalStorage } from "@/lib/globalStorage";
  import HelixIcon from "@/entrypoints/telescope-ui/icons/Helix.svelte";

  // State management
  let floatingTelescopeEnabled = $state(true);
  let selectionTelescopeEnabled = $state(true);

  // Reference to main element for outside click detection
  let mainElement: HTMLElement;

  // Load settings from storage
  async function loadSettings() {
    try {
      const config = await globalStorage().get("config");
      if (config && typeof config === "object") {
        floatingTelescopeEnabled = (config as any).floatingTelescopeEnabled ?? true;
        selectionTelescopeEnabled = (config as any).selectionTelescopeEnabled ?? true;
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }

  // Save settings to storage
  async function saveSettings() {
    try {
      const currentConfig = await globalStorage().get("config");
      await globalStorage().set("config", {
        ...(currentConfig || {}),
        floatingTelescopeEnabled,
        selectionTelescopeEnabled,
      } as any);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }

  function openTelescopeSidePanel() {
    if (typeof chrome !== "undefined" && chrome.sidePanel && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentWindowId = tabs[0]?.windowId;
        if (currentWindowId) {
          chrome.sidePanel
            .open({ windowId: currentWindowId })
            .then(() => {
              window.close();
            })
            .catch((error: Error) => {
              console.error("Error opening side panel:", error);
            });
        }
      });
    }
  }

  function openTelescopeFloating() {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { action: "openTelescope" },
            () => {
              if (!chrome.runtime.lastError) {
                setTimeout(() => {
                  window.close();
                }, 100);
              }
            }
          );
        }
      });
    }
  }

  // Handle clicks outside the popup to close it
  function handleClickOutside(event: MouseEvent) {
    if (mainElement && !mainElement.contains(event.target as Node)) {
      window.close();
    }
  }

  // Format keyboard shortcut to lowercase style
  function formatShortcut(shortcut: string): string {
    if (!shortcut) return "ctrl + e";
    return shortcut
      .toLowerCase()
      .replace(/\bctrl\b/g, "ctrl")
      .replace(/\bcommand\b/g, "cmd")
      .replace(/\balt\b/g, "alt")
      .replace(/\bshift\b/g, "shift")
      .replace(/\+/g, " + ");
  }

  // Get current keyboard shortcut
  async function getKeyboardShortcut(): Promise<string> {
    try {
      if (chrome.commands) {
        const commands = await chrome.commands.getAll();
        const floatingCmd = commands.find(
          (cmd) => cmd.name === "open-floating-telescope"
        );
        return formatShortcut(floatingCmd?.shortcut || "Ctrl+E");
      }
    } catch (error) {
      console.error("Error getting keyboard shortcut:", error);
    }
    return "ctrl + e";
  }

  let keyboardShortcut = $state("ctrl + e");

  // Set up event listeners and load settings
  onMount(async () => {
    await loadSettings();
    keyboardShortcut = await getKeyboardShortcut();
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      saveSettings();
    };
  });

  // Watch for toggle changes to auto-save
  $effect(() => {
    floatingTelescopeEnabled;
    selectionTelescopeEnabled;
    saveSettings();
  });
</script>

<main bind:this={mainElement}>
  <div class="header">
    <div class="header-title">
      <HelixIcon size={24} />
      <h1>Helix</h1>
    </div>
  </div>

  <div class="open-telescope-section">
    <h2>Open telescope</h2>
    <div class="button-group">
      <button class="action-button" onclick={openTelescopeSidePanel}>
        open in sidepanel
      </button>
      <button class="action-button" onclick={openTelescopeFloating}>
        open in floating
      </button>
    </div>
  </div>

  <div class="keybinding-section">
    <h3>Keybinding</h3>
    <div class="keybinding-row">
      <span class="keybinding-label">Floating telescope</span>
      <span class="keybinding-shortcut">{keyboardShortcut}</span>
    </div>
  </div>

  <div class="enable-section">
    <div class="enable-row">
      <span class="enable-label">Enable floating telescope</span>
      <label class="toggle">
        <input type="checkbox" bind:checked={floatingTelescopeEnabled} />
        <span class="slider"></span>
      </label>
    </div>
    <div class="enable-row">
      <span class="enable-label">Enable selection telescope</span>
      <label class="toggle">
        <input type="checkbox" bind:checked={selectionTelescopeEnabled} />
        <span class="slider"></span>
      </label>
    </div>
  </div>
</main>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap");

  /* CSS Reset */
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  main {
    width: 400px;
    min-height: auto;
    padding: 20px;
    font-family: "Sora", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
    background: #131723;
    color: #F2F8FC;
    box-sizing: border-box;
  }

  .header {
    margin-bottom: 20px;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header h1 {
    font-size: 24px;
    font-weight: 700;
    color: #F2F8FC;
    margin: 0;
  }

  .open-telescope-section {
    margin-bottom: 24px;
  }

  .open-telescope-section h2 {
    font-size: 14px;
    font-weight: 600;
    color: #F2F8FC;
    margin-bottom: 12px;
  }

  .button-group {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .action-button {
    flex: 1;
    min-width: 140px;
    height: 36px;
    background: #262832;
    color: #F2F8FC;
    border: 1px solid #404040;
    border-radius: 4px;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: lowercase;
  }

  .action-button:hover {
    background: #3b82f6;
    border-color: #3b82f6;
    transform: translateY(-1px);
  }

  .action-button:active {
    transform: translateY(0);
  }

  .keybinding-section {
    margin-bottom: 24px;
  }

  .keybinding-section h3 {
    font-size: 14px;
    font-weight: 600;
    color: #F2F8FC;
    margin-bottom: 12px;
  }

  .keybinding-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
  }

  .keybinding-label {
    font-size: 13px;
    color: #9ca3af;
    font-weight: 400;
  }

  .keybinding-shortcut {
    font-size: 13px;
    color: #F2F8FC;
    font-weight: 500;
    text-transform: lowercase;
  }

  .enable-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .enable-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .enable-label {
    font-size: 13px;
    color: #9ca3af;
    font-weight: 400;
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
</style>

