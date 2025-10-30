<script lang="ts">
  import { onMount } from "svelte";
  import { globalStorage } from "@/lib/globalStorage";
  import HelixIcon from "@/entrypoints/telescope-ui/icons/Helix.svelte";
  import { saveProviderKey, loadProviderKey } from "@/lib/secureStore";
  import { getDefaultModels } from "@/lib/ai/providerClient";

  let floatingTelescopeEnabled = $state(true);
  let selectionTelescopeEnabled = $state(true);
  let writerTelescopeEnabled = $state(true);

  let aiProvider = $state<"builtin" | "openai" | "anthropic" | "gemini">(
    "builtin"
  );
  let aiModel = $state<string>("");
  let openaiKey = $state("");
  let anthropicKey = $state("");
  let geminiKey = $state("");

  let mainElement: HTMLElement;
  let savedKeys = $state({ openai: false, anthropic: false, gemini: false });

  async function loadSettings() {
    try {
      const config = await globalStorage().get("config");
      if (config && typeof config === "object") {
        floatingTelescopeEnabled =
          (config as any).floatingTelescopeEnabled ?? true;
        selectionTelescopeEnabled =
          (config as any).selectionTelescopeEnabled ?? true;
        writerTelescopeEnabled = (config as any).writerTelescopeEnabled ?? true;
        aiProvider = (config as any).aiProvider ?? "builtin";
        aiModel = (config as any).aiModel ?? "";
        // Load keys (decrypted) for convenience in UI; do not persist back unless changed
        openaiKey = (await loadProviderKey("openai")) || "";
        anthropicKey = (await loadProviderKey("anthropic")) || "";
        geminiKey = (await loadProviderKey("gemini")) || "";
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }

  async function saveSettings() {
    try {
      const currentConfig = await globalStorage().get("config");
      await globalStorage().set("config", {
        ...(currentConfig || {}),
        floatingTelescopeEnabled,
        selectionTelescopeEnabled,
        writerTelescopeEnabled,
        aiProvider,
        aiModel,
      } as any);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }

  async function saveApiKey(provider: "openai" | "anthropic" | "gemini") {
    try {
      if (provider === "openai" && openaiKey.trim()) {
        await saveProviderKey("openai", openaiKey);
        savedKeys.openai = true;
        setTimeout(() => {
          savedKeys.openai = false;
        }, 2000);
      } else if (provider === "anthropic" && anthropicKey.trim()) {
        await saveProviderKey("anthropic", anthropicKey);
        savedKeys.anthropic = true;
        setTimeout(() => {
          savedKeys.anthropic = false;
        }, 2000);
      } else if (provider === "gemini" && geminiKey.trim()) {
        await saveProviderKey("gemini", geminiKey);
        savedKeys.gemini = true;
        setTimeout(() => {
          savedKeys.gemini = false;
        }, 2000);
      }
    } catch (error) {
      console.error(`Error saving ${provider} key:`, error);
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

  async function openTelescopeFloating() {
    if (!floatingTelescopeEnabled) {
      return;
    }

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

  function handleClickOutside(event: MouseEvent) {
    if (mainElement && !mainElement.contains(event.target as Node)) {
      window.close();
    }
  }

  function formatShortcut(shortcut: string): string {
    if (!shortcut) return "ctrl + y";
    return shortcut
      .toLowerCase()
      .replace(/\bctrl\b/g, "ctrl")
      .replace(/\bcommand\b/g, "cmd")
      .replace(/\balt\b/g, "alt")
      .replace(/\bshift\b/g, "shift")
      .replace(/\+/g, " + ");
  }

  async function getKeyboardShortcut(): Promise<string> {
    try {
      if (chrome.commands) {
        const commands = await chrome.commands.getAll();
        const floatingCmd = commands.find(
          (cmd) => cmd.name === "open-floating-telescope"
        );
        const config = await globalStorage().get("config");
        if (config && typeof config === "object") {
          await globalStorage().append({
            key: "config",
            value: {
              assignedTelescopeCommand: !!floatingCmd?.shortcut,
            },
          });
        }
        return formatShortcut(floatingCmd?.shortcut || "Ctrl+Y");
      }
    } catch (error) {
      console.error("Error getting keyboard shortcut:", error);
    }
    return "ctrl + y";
  }

  let keyboardShortcut = $state("ctrl + y");

  $effect(() => {
    // Reset model if provider changes and model not in defaults
    const models = aiProvider === "builtin" ? [] : getDefaultModels(aiProvider);
    if (aiProvider !== "builtin" && aiModel && !models.includes(aiModel)) {
      aiModel = models[0] || "";
    }
  });

  async function openShortcutsPage() {
    try {
      chrome.runtime.sendMessage(
        {
          type: "OPEN_SHORTCUTS_PAGE",
        },
        () => {
          setTimeout(() => {
            window.close();
          }, 100);
        }
      );
    } catch (error) {
      console.error("Error opening shortcuts page:", error);
    }
  }

  async function refreshShortcut() {
    keyboardShortcut = await getKeyboardShortcut();
  }

  function openASCodelabs() {
    chrome.tabs.create({ url: "https://ascodelabs.com" });
  }

  onMount(() => {
    void loadSettings();
    void getKeyboardShortcut().then((shortcut) => shortcut);
    document.addEventListener("mousedown", handleClickOutside);

    const handleFocus = () => {
      refreshShortcut();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("focus", handleFocus);
      saveSettings();
    };
  });

  $effect(() => {
    floatingTelescopeEnabled;
    selectionTelescopeEnabled;
    writerTelescopeEnabled;
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
      <button
        class="action-button"
        onclick={openTelescopeFloating}
        disabled={!floatingTelescopeEnabled}
      >
        Open in Floating
      </button>
      <button class="action-button" onclick={openTelescopeSidePanel}>
        Open in Sidepanel
      </button>
    </div>
  </div>

  <div class="keybinding-section">
    <h3>AI Platform</h3>
    <div class="ai-platform-row">
      <div class="ai-platform-row-input">
        <label class="enable-label" for="platform-select"
          >Select a platform</label
        >
        <select
          id="platform-select"
          class="option-dropdown ai-platform-field"
          bind:value={aiProvider}
          onchange={() => saveSettings()}
        >
          <option value="builtin">Built-in (private and secure)</option>
          <option value="openai">OpenAI</option>
          <!-- <option value="anthropic">Claude</option> -->
          <option value="gemini">Gemini</option>
        </select>
      </div>
    </div>

    {#if aiProvider !== "builtin"}
      <div class="ai-platform-row">
        <div class="ai-platform-row-input">
          <label class="enable-label" for="model-select">Model</label>
          <select
            id="model-select"
            class="option-dropdown ai-platform-field"
            bind:value={aiModel}
            onchange={() => saveSettings()}
          >
            {#each getDefaultModels(aiProvider) as m}
              <option value={m}>{m}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="ai-platform-row">
        {#if aiProvider === "openai"}
          <div class="ai-platform-row-input">
            <label class="enable-label" for="openai-key">OpenAI API Key</label>
            <input
              id="openai-key"
              type="password"
              class="option-input ai-platform-field"
              bind:value={openaiKey}
              placeholder="sk-..."
            />
          </div>
          <button
            class="save-key-button"
            onclick={() => saveApiKey("openai")}
            disabled={!openaiKey.trim()}
          >
            {savedKeys.openai ? "✓ Saved" : "Save"}
          </button>
        {:else if aiProvider === "anthropic"}
          <div class="ai-platform-row-input">
            <label class="enable-label" for="anthropic-key"
              >Claude API Key</label
            >
            <input
              id="anthropic-key"
              type="password"
              class="option-input ai-platform-field"
              bind:value={anthropicKey}
              placeholder="anthropic_key..."
            />
          </div>
          <button
            class="save-key-button"
            onclick={() => saveApiKey("anthropic")}
            disabled={!anthropicKey.trim()}
          >
            {savedKeys.anthropic ? "✓ Saved" : "Save"}
          </button>
        {:else if aiProvider === "gemini"}
          <div class="ai-platform-row-input">
            <label class="enable-label" for="gemini-key">Gemini API Key</label>
            <input
              id="gemini-key"
              type="password"
              class="option-input ai-platform-field"
              bind:value={geminiKey}
              placeholder="AIzx..."
            />
          </div>
          <button
            class="save-key-button"
            onclick={() => saveApiKey("gemini")}
            disabled={!geminiKey.trim()}
          >
            {savedKeys.gemini ? "✓ Saved" : "Save"}
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <div class="keybinding-section">
    <h3>Keybinding</h3>
    <div class="keybinding-row">
      <span class="keybinding-label">Floating telescope</span>
      <button
        class="keybinding-shortcut-btn"
        onclick={openShortcutsPage}
        title="Click to edit keyboard shortcut"
      >
        <span class="keybinding-shortcut">{keyboardShortcut}</span>
        <svg
          class="edit-icon"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M10.5 3.5L10 4L8 2L8.5 1.5C8.77614 1.22386 9.22386 1.22386 9.5 1.5L10.5 2.5C10.7761 2.77614 10.7761 3.22386 10.5 3.5ZM7.5 3.5L9.5 5.5L4 11H2V9L7.5 3.5Z"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />
        </svg>
      </button>
    </div>
  </div>

  <div class="enable-section">
    <div class="enable-row">
      <span class="enable-label">Enable Floating telescope</span>
      <label class="toggle">
        <input type="checkbox" bind:checked={floatingTelescopeEnabled} />
        <span class="slider"></span>
      </label>
    </div>
    <div class="enable-row">
      <span class="enable-label">Enable Selection telescope</span>
      <label class="toggle">
        <input type="checkbox" bind:checked={selectionTelescopeEnabled} />
        <span class="slider"></span>
      </label>
    </div>
    <div class="enable-row">
      <span class="enable-label">Enable Writer telescope</span>
      <label class="toggle">
        <input type="checkbox" bind:checked={writerTelescopeEnabled} />
        <span class="slider"></span>
      </label>
    </div>
  </div>

  <div class="footer">
    <span class="footer-text">Created by </span>
    <button class="footer-link" onclick={openASCodelabs}>A S Codelabs</button>
  </div>
</main>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap");

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  main {
    width: 400px;
    min-height: auto;
    padding: 20px;
    font-family:
      "Sora",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
    background: #131723;
    color: #f2f8fc;
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
    color: #f2f8fc;
    margin: 0;
  }

  .open-telescope-section {
    margin-bottom: 24px;
  }

  .open-telescope-section h2 {
    font-size: 14px;
    font-weight: 600;
    color: #f2f8fc;
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
    color: #f2f8fc;
    border: 1px solid #404040;
    border-radius: 4px;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-button:hover {
    background: #3b82f6;
    border-color: #3b82f6;
    transform: translateY(-1px);
  }

  .action-button:active {
    transform: translateY(0);
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #262832;
    border-color: #404040;
  }

  .action-button:disabled:hover {
    background: #262832;
    border-color: #404040;
    transform: none;
  }

  .keybinding-section {
    margin-bottom: 24px;
  }

  .keybinding-section h3 {
    font-size: 14px;
    font-weight: 600;
    color: #f2f8fc;
    margin-bottom: 12px;
  }

  .option-dropdown {
    background: #131723;
    border: 1px solid #374151;
    border-radius: 6px;
    color: #e5e7eb;
    font-size: 14px;
    padding: 8px 12px;
    cursor: pointer;
    outline: none;
    transition: all 0.2s ease;
    font-family: inherit;
  }
  .ai-platform-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .ai-platform-field {
    width: 140px;
  }

  .ai-platform-row-input {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .option-input {
    background: #131723;
    border: 1px solid #374151;
    border-radius: 6px;
    color: #e5e7eb;
    font-size: 14px;
    padding: 8px 12px;
    outline: none;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .save-key-button {
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    padding: 8px 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    white-space: nowrap;
    width: 140px;
    margin-top: 10px;
    align-self: flex-end;
  }

  .save-key-button:hover:not(:disabled) {
    background: #2563eb;
  }

  .save-key-button:disabled {
    background: #374151;
    color: #9ca3af;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .save-key-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateX(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
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

  .keybinding-shortcut-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .keybinding-shortcut-btn:hover {
    background: #262832;
    border-color: #404040;
  }

  .keybinding-shortcut-btn:active {
    background: #1f2129;
  }

  .keybinding-shortcut {
    font-size: 13px;
    color: #f2f8fc;
    font-weight: 500;
    text-transform: lowercase;
  }

  .edit-icon {
    color: #9ca3af;
    flex-shrink: 0;
    transition: color 0.2s ease;
  }

  .keybinding-shortcut-btn:hover .edit-icon {
    color: #3b82f6;
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

  .footer {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #374151;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .footer-text {
    font-size: 12px;
    color: #9ca3af;
    font-weight: 400;
  }

  .footer-link {
    background: none;
    border: none;
    color: #3b82f6;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    padding: 0;
    text-decoration: none;
    transition: color 0.2s ease;
    font-family: inherit;
  }

  .footer-link:hover {
    color: #60a5fa;
    text-decoration: underline;
  }
</style>
