<script lang="ts">
  import { scale } from "svelte/transition";
  import type { SelectionAction } from "./types";
  import Summarise from "../telescope-ui/icons/Summarise.svelte";
  import Translate from "../telescope-ui/icons/Translate.svelte";
  import AddToChat from "../telescope-ui/icons/AddToChat.svelte";
  import Down from "../telescope-ui/icons/Down.svelte";
  import { sidePanelUtils } from "../../lib/sidePanelStore";
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
    { id: "summarise", icon: Summarise, label: "Summarise" },
    { id: "translate", icon: Translate, label: "Translate" },
  ];

  let showLanguageDropdown = $state(false);
  let dropdownShouldBeAtTop = $state(false);
  let dropdownElement: HTMLDivElement | undefined = $state();

  // Use a subset of supported languages for the dropdown (most common ones)
  const languages = SUPPORTED_LANGUAGES.slice(0, 8); // Top 8 languages

  // Helper to grab selected text from the document
  function getSelectedText(): string {
    return (
      (window.getSelection?.() || document.getSelection?.())?.toString() || ""
    );
  }

  // Check dropdown position and adjust if it hits the top
  function checkDropdownPosition() {
    if (!dropdownElement || !showLanguageDropdown) return;

    const rect = dropdownElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // If dropdown would go below the viewport or has less than 100px space below
    const spaceBelow = viewportHeight - rect.bottom;
    const shouldBeAtTop = spaceBelow < 100;

    dropdownShouldBeAtTop = shouldBeAtTop;
  }

  // Use effect to observe dropdown position changes
  let observer: MutationObserver | undefined;

  $effect(() => {
    if (showLanguageDropdown && dropdownElement) {
      // Check position immediately
      checkDropdownPosition();

      // Set up mutation observer to watch for changes
      observer = new MutationObserver(() => {
        checkDropdownPosition();
      });

      observer.observe(dropdownElement, {
        attributes: true,
        attributeFilter: ["style", "class"],
        childList: true,
        subtree: true,
      });

      // Also check on scroll and resize
      window.addEventListener("scroll", checkDropdownPosition, true);
      window.addEventListener("resize", checkDropdownPosition);

      return () => {
        observer?.disconnect();
        window.removeEventListener("scroll", checkDropdownPosition, true);
        window.removeEventListener("resize", checkDropdownPosition);
      };
    } else {
      dropdownShouldBeAtTop = false;
    }
  });

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
    } else if (action === "summarise") {
      globalStorage().set("action_state", {
        actionSource: "summarise",
        content: selectedText,
      });
      onClose?.();
      return;
    } else if (action === "translate") {
      globalStorage().set("action_state", {
        actionSource: "translate",
        content: selectedText,
        targetLanguage: null,
      });
      onClose?.();
      return;
    }
  }

  async function handleLanguageSelection(languageCode: string) {
    const selectedText = getSelectedText();

    // Handle translate directly with the selected text and target language
    const success = await sidePanelUtils.moveToSidePanel({
      messages: [
        {
          id: Date.now(),
          type: "user",
          content: selectedText,
          timestamp: new Date(),
        },
      ],
      isStreaming: false,
      streamingMessageId: null,
      inputValue: "",
      inputImageAttached: [],
      searchIndex: 1,
      totalResults: 0,
      currentState: "ask",
      source: "translate",
      actionSource: "translate",
      targetLanguage: languageCode,
      timestamp: Date.now(),
    });

    showLanguageDropdown = false;
    onClose?.();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      if (showLanguageDropdown) {
        showLanguageDropdown = false;
      } else {
        onClose?.();
      }
    }
  }

  function handleClickOutside(event: MouseEvent) {
    // Close language dropdown when clicking outside
    if (showLanguageDropdown) {
      showLanguageDropdown = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} onmousedown={handleClickOutside} />

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
      <div
        class="action-wrapper"
        class:active={action.id === "translate" && showLanguageDropdown}
        onmousedown={(e) => e.stopPropagation()}
      >
        <button
          class="action-button"
          onclick={() => handleAction(action.id)}
          type="button"
          aria-label={action.label}
        >
          <span class="action-icon">
            <!-- svelte-ignore svelte_component_deprecated -->
            <svelte:component this={action.icon} />
          </span>
          <span class="action-label">{action.label}</span>
          {#if action.id === "translate"}
            <span class="dropdown-icon">
              <svelte:component this={Down} />
            </span>
          {/if}
        </button>
        {#if action.id === "translate" && showLanguageDropdown}
          <div
            bind:this={dropdownElement}
            class="language-dropdown"
            class:dropdown-at-top={dropdownShouldBeAtTop}
            transition:scale={{ duration: 150, start: 0.9 }}
            onmousedown={(e) => e.stopPropagation()}
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
  }

  .action-wrapper.active .action-button {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: transparent;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 500;
    outline: none;
  }

  .action-button:hover {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .action-button:active {
    transform: scale(0.95);
    background: rgba(59, 130, 246, 0.25);
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
  }

  .action-label {
    line-height: 1;
  }

  .dropdown-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-left: 4px;
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

  .language-dropdown.dropdown-at-top {
    top: auto;
    bottom: calc(100% + 8px);
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

  .language-option:hover {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
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
      padding: 8px;
    }

    .popup-content {
      gap: 2px;
    }
  }
</style>
