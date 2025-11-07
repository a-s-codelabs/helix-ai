<script lang="ts">
  import { scale } from "svelte/transition";
  import type { SelectionAction } from "./types";
  import Summarize from "../telescope-ui/icons/Summarize.svelte";
  import Translate from "../telescope-ui/icons/Translate.svelte";
  import AddToChat from "../telescope-ui/icons/AddToChat.svelte";
  import Down from "../telescope-ui/icons/Down.svelte";
  import { SUPPORTED_LANGUAGES } from "../../lib/languageHelper";
  import { globalStorage } from "@/lib/globalStorage";

  interface Props {
    x: number;
    y: number;
    isAtTop?: boolean;
    onClose?: () => void;
  }

  let { x, y, isAtTop = false, onClose }: Props = $props();

  const actions: Array<{ id: SelectionAction; icon: any; label: string }> = [
    { id: "addToChat", icon: AddToChat, label: "Add to Chat" },
    { id: "summarize", icon: Summarize, label: "Summarize" },
    { id: "translate", icon: Translate, label: "Translate" },
  ];

  let showLanguageDropdown = $state(false);

  const languages = SUPPORTED_LANGUAGES.slice(0, 8);

  function getSelectedText(): string {
    return (
      (window.getSelection?.() || document.getSelection?.())?.toString() || ""
    );
  }

  async function handleAction(action: SelectionAction) {
    const selectedText = getSelectedText();

    chrome.runtime.sendMessage({
      type: "OPEN_TO_SIDE_PANEL",
    });
    if (action === "addToChat") {
      globalStorage().set("action_state", {
        actionSource: "addToChat",
        content: selectedText,
      });
      onClose?.();
      return;
    } else if (action === "summarize") {
      globalStorage().set("action_state", {
        actionSource: "summarize",
        content: selectedText,
      });
      onClose?.();
      return;
    }
  }

  async function handleLanguageSelection(languageCode: string) {
    const selectedText = getSelectedText();

    chrome.runtime.sendMessage({
      type: "OPEN_TO_SIDE_PANEL",
    });
    globalStorage().set("action_state", {
      actionSource: "translate",
      content: selectedText,
      targetLanguage: languageCode,
    });
    onClose?.();
    showLanguageDropdown = false;
    onClose?.();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      onClose?.();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="selection-popup"
  class:at-top={isAtTop}
  style:left="{x}px"
  style:top="{y}px"
  transition:scale={{ duration: 150, start: 0.9 }}
  role="menu"
  aria-label="Text selection actions"
>
  {#if !isAtTop}
    <div class="popup-arrow"></div>
  {:else}
    <div class="popup-arrow popup-arrow-inverted"></div>
  {/if}
  <div class="popup-content">
    {#each actions as action (action.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="action-wrapper"
        class:active={action.id === "translate" && showLanguageDropdown}
        onmousedown={(e) => e.stopPropagation()}
        aria-label={action.label}
      >
        <button
          class="action-button"
          onclick={() => {
            if (action.id === "translate") {
              showLanguageDropdown = true;
            } else {
              handleAction(action.id);
            }
          }}
          type="button"
          aria-label={action.label}
        >
          <span class="action-icon">
            <action.icon />
          </span>
          <span class="action-label">{action.label}</span>
          {#if action.id === "translate"}
            <span class="dropdown-icon">
              <Down />
            </span>
          {/if}
        </button>
        {#if action.id === "translate" && showLanguageDropdown}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="language-dropdown"
            onmousedown={(e) => e.stopPropagation()}
            role="button"
            tabindex="0"
          >
            {#each languages as language (language.code)}
              <button
                class="language-option"
                onclick={() => handleLanguageSelection(language.code)}
                type="button"
              >
                <span class="language-flag">{language.flag}</span>
                <span class="language-name">{language.name}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .selection-popup {
    position: fixed;
    z-index: 2147483647;
    transform: translate(-50%, -100%);
    margin-top: -12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
      Ubuntu, Cantarell, sans-serif;
    font-size: 14px;
  }

  .selection-popup.at-top {
    transform: translate(-50%, 0);
    margin-top: 0;
  }

  .popup-arrow {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid rgba(17, 24, 39, 0.95);
  }

  .popup-arrow-inverted {
    bottom: auto;
    top: -6px;
    border-top: none;
    border-bottom: 6px solid rgba(17, 24, 39, 0.95);
  }

  .popup-content {
    display: flex;
    gap: 4px;
    padding: 6px;
    background: rgba(17, 24, 39, 0.95);
    border-radius: 32px;
    box-shadow:
      0 10px 25px -5px rgba(0, 0, 0, 0.3),
      0 8px 10px -6px rgba(0, 0, 0, 0.2),
      0 0 0 1px rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
  }

  .action-wrapper {
    position: relative;
    min-width: 0;
    color: #929398;
  }

  .action-wrapper:hover {
    color: #60a5fa;
  }

  .action-wrapper.active .action-button {
    /* background: rgba(59, 130, 246, 0.15); */
    color: #60a5fa;
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: transparent;
    /* color: #ffffff; */
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 500;
    outline: none;
    min-width: 0;
    overflow: hidden;
    max-width: 148px;
    color: #929398;
  }

  .action-button:hover {
    color: #60a5fa;
  }

  .action-button:active {
    transform: scale(0.95);
  }

  .action-button:focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  .action-icon {
    font-size: 16px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: #2b2e39;
    border-radius: 50%;
    padding: 4px;
    flex-shrink: 0;
  }

  .action-label {
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
    flex: 1 1 auto;
    min-width: 0;
    display: block;
  }

  .dropdown-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    /* margin-left: 4px; */
    flex-shrink: 0;
  }

  .language-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    min-width: 140px;
    background: rgba(17, 24, 39, 0.95);
    border-radius: 8px;
    box-shadow:
      0 10px 25px -5px rgba(0, 0, 0, 0.3),
      0 8px 10px -6px rgba(0, 0, 0, 0.2),
      0 0 0 1px rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    overflow: hidden;
  }

  .language-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    color: #ffffff;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: 13px;
    font-weight: 500;
    outline: none;
  }

  .language-flag {
    font-size: 16px;
    line-height: 1;
  }

  .language-name {
    flex: 1;
  }

  .language-option:focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: -2px;
  }

  @media (max-width: 640px) {
    .action-label {
      display: none;
    }

    .action-button {
      /* padding: 8px; */
      min-width: 0;

      /* background: red; */
    }

    /* .popup-content {
      gap: 2px;
    } */
  }
</style>
