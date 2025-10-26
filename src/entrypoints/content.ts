/*@ts-ignore */
import App from './telescope-ui/App.svelte';
/*@ts-ignore */
import SelectionPopupContainer from './selection-popup/SelectionPopupContainer.svelte';
/*@ts-ignore */
import WriterAssistant from './writer-popup/WriterAssistant.svelte';
import { mount, unmount } from 'svelte';
import { searchStore } from '../lib/searchStore';
import { selectionPopupStore } from '../lib/selectionPopupStore';
import { writerPopupStore } from '../lib/writerPopupStore';
import type { SelectionAction } from './selection-popup/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    let ui: any = null;
    let isVisible = false;

    // Selection popup state
    let selectionPopupUI: any = null;

    // Writer assistant state
    let writerAssistantUI: any = null;

    // Create the UI
    const createUI = async () => {
      if (ui) return ui;

      try {
        ui = await createShadowRootUi(ctx, {
          position: 'inline',
          name: 'telescope-ui',
          anchor: 'body',
          onMount: (container) => {
            // Position the container at the very top of the body
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.right = '0';
            container.style.bottom = '0';
            container.style.zIndex = '99999';
            // container.style.pointerEvents = 'none';

            // Create the Svelte app inside the UI container
            const app = mount(App, { target: container });
            return app;
          },
          onRemove: (app) => {
            unmount(app as any);
            ui = undefined; // Reset ui after unmounting
          },
        });

        return ui;
      } catch (error) {
        console.error('Failed to create UI:', error);
        throw error;
      }
    };

    // Create selection popup UI
    const createSelectionPopupUI = async () => {
      if (selectionPopupUI) return selectionPopupUI;

      try {
        selectionPopupUI = await createShadowRootUi(ctx, {
          position: 'inline',
          name: 'selection-popup-ui',
          anchor: 'body',
          onMount: (container) => {
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '0';
            container.style.height = '0';
            container.style.zIndex = '2147483647';
            container.style.pointerEvents = 'none';

            const app = mount(SelectionPopupContainer, {
              target: container,
              props: {
                onAction: handleSelectionAction,
                onClose: hideSelectionPopup,
              },
            });

            // Enable pointer events for the popup
            container.style.pointerEvents = 'auto';

            return app;
          },
          onRemove: (app) => {
            unmount(app as any);
            selectionPopupUI = null;
          },
        });

        return selectionPopupUI;
      } catch (error) {
        console.error('Failed to create selection popup UI:', error);
        throw error;
      }
    };

    // Create writer assistant UI
    const createWriterAssistantUI = async () => {
      if (writerAssistantUI) return writerAssistantUI;

      try {
        writerAssistantUI = await createShadowRootUi(ctx, {
          position: 'inline',
          name: 'writer-assistant-ui',
          anchor: 'body',
          onMount: (container) => {
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '0';
            container.style.height = '0';
            container.style.zIndex = '2147483647';
            container.style.pointerEvents = 'none';

            const app = mount(WriterAssistant, {
              target: container,
            });

            // Enable pointer events for the popup
            container.style.pointerEvents = 'auto';

            return app;
          },
          onRemove: (app) => {
            unmount(app as any);
            writerAssistantUI = null;
          },
        });

        return writerAssistantUI;
      } catch (error) {
        console.error('Failed to create writer assistant UI:', error);
        throw error;
      }
    };

    // Get selection position
    const getSelectionPosition = (): { x: number; y: number } | null => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Center horizontally, position above the selection
      const x = rect.left + rect.width / 2;
      const y = rect.top;

      return { x, y };
    };

    // Show selection popup
    const showSelectionPopup = async () => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();

      if (!selectedText || selectedText.length === 0) {
        hideSelectionPopup();
        return;
      }

      const position = getSelectionPosition();
      if (!position) return;

      // Ensure the UI is created
      if (!selectionPopupUI) {
        await createSelectionPopupUI();
        selectionPopupUI.mount();
      }

      // Update state
      selectionPopupStore.show(position.x, position.y, selectedText);
    };

    // Hide selection popup
    const hideSelectionPopup = () => {
      selectionPopupStore.hide();

      // Keep the UI mounted but hidden for better performance
      // Only remove it when the content script is invalidated
    };

    // Handle selection action
    const handleSelectionAction = (action: SelectionAction, text: string) => {
      console.log(`Action: ${action}, Text: ${text}`);

      // TODO: Implement action handlers
      switch (action) {
        case 'summarise':
          console.log('Summarising:', text);
          // TODO: Send to AI for summarization
          break;
        case 'translate':
          console.log('Translating:', text);
          // TODO: Send to AI for translation
          break;
        case 'addToChat':
          console.log('Adding to chat:', text);
          // TODO: Add to chat interface
          break;
      }
    };

    // Handle text selection
    const handleSelectionChange = () => {
      // Use a debounce to avoid too many calls
      clearTimeout((window as any).__selectionTimeout);
      (window as any).__selectionTimeout = setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        if (selectedText && selectedText.length > 0) {
          showSelectionPopup();
        } else {
          hideSelectionPopup();
        }
      }, 100);
    };

    // Handle mouse up (for better UX)
    const handleMouseUp = (event: MouseEvent) => {
      // Ignore clicks on the popup itself
      if ((event.target as HTMLElement).closest('.selection-popup')) {
        return;
      }

      // Small delay to let the selection stabilize
      setTimeout(() => {
        handleSelectionChange();
      }, 10);
    };

    // Listen for text selection
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleMouseUp);

    // Writer Assistant - Textarea/Input detection
    let currentFocusedElement: HTMLTextAreaElement | HTMLInputElement | null =
      null;

    const isWritableElement = (
      element: Element | null
    ): element is HTMLTextAreaElement | HTMLInputElement => {
      if (!element) return false;

      if (element.tagName === 'TEXTAREA') return true;

      if (element.tagName === 'INPUT') {
        const input = element as HTMLInputElement;
        const writableTypes = [
          'text',
          'email',
          'search',
          'url',
          'tel',
          'password',
        ];
        return writableTypes.includes(input.type);
      }

      // Check for contenteditable
      if ((element as HTMLElement).contentEditable === 'true') {
        return false; // We'll handle contenteditable separately if needed
      }

      return false;
    };

    const showWriterButton = async (
      element: HTMLTextAreaElement | HTMLInputElement
    ) => {
      // Ensure the UI is created
      if (!writerAssistantUI) {
        await createWriterAssistantUI();
        writerAssistantUI.mount();
      }

      // Get element position
      const rect = element.getBoundingClientRect();

      // Position the button at the top-right corner of the element
      const x = rect.right - 20;
      const y = rect.top + 20;

      // Update state
      currentFocusedElement = element;
      writerPopupStore.show(x, y, element);
    };

    const hideWriterButton = () => {
      writerPopupStore.hide();
      currentFocusedElement = null;
    };

    const handleTextareaFocus = (event: FocusEvent) => {
      const target = event.target;

      if (isWritableElement(target as Element | null)) {
        // Small delay to ensure the element is fully focused
        setTimeout(() => {
          if (document.activeElement === target) {
            showWriterButton(target as HTMLTextAreaElement | HTMLInputElement);
          }
        }, 100);
      }
    };

    const handleTextareaBlur = (event: FocusEvent) => {
      const target = event.target;

      if (isWritableElement(target as Element | null)) {
        // Delay to check if we're clicking on the writer button or popup
        setTimeout(() => {
          // Check if popup dialog is open - don't hide while user is interacting
          let isPopupOpen = false;
          const unsubscribe = writerPopupStore.subscribe((state) => {
            isPopupOpen = state.popupOpen;
          });
          unsubscribe();

          if (!isPopupOpen) {
            hideWriterButton();
          }
        }, 150);
      }
    };

    const handleTextareaClick = (event: MouseEvent) => {
      const target = event.target;

      if (
        isWritableElement(target as Element) &&
        target === currentFocusedElement
      ) {
        // Element is already focused, just ensure button is visible
        showWriterButton(target as HTMLTextAreaElement | HTMLInputElement);
      }
    };

    // Listen for textarea/input interactions
    document.addEventListener('focusin', handleTextareaFocus, true);
    document.addEventListener('focusout', handleTextareaBlur, true);
    document.addEventListener('click', handleTextareaClick, true);

    // Handle keyboard shortcuts
    const handleKeyDown = async (event: KeyboardEvent) => {
      // Check for Cmd+E (Mac) or Ctrl+E (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'e') {
        event.preventDefault();

        if (!isVisible) {
          await createUI();
          ui.mount();
          searchStore.show();
          isVisible = true;
        } else {
          searchStore.hide();
          ui.remove();
          isVisible = false;
        }
      }

      // Handle Escape key
      if (event.key === 'Escape' && isVisible) {
        searchStore.hide();
        ui.remove();
        isVisible = false;
      }
    };

    // Listen for keyboard events
    document.addEventListener('keydown', handleKeyDown);

    // Listen for messages from popup and background
    const handleMessage = (message: any, sender: any, sendResponse: any) => {
      if (message.action === 'openTelescope') {
        (async () => {
          try {
            // If already visible, hide it first, then show it again
            if (isVisible) {
              searchStore.hide();
              ui.remove();
              isVisible = false;
            }

            // Wait for the page to be ready
            if (document.readyState === 'loading') {
              await new Promise((resolve) => {
                document.addEventListener('DOMContentLoaded', resolve, {
                  once: true,
                });
              });
            }

            await createUI();
            ui.mount();
            searchStore.show();
            isVisible = true;
          } catch (error) {
            console.error('Failed to open telescope:', error);
          }
        })();
        return true; // Indicate we will send a response asynchronously
      }

      // Handle page content extraction request from side panel
      if (message.type === 'EXTRACT_PAGE_CONTENT') {
        console.log('Content script: Received EXTRACT_PAGE_CONTENT request');
        (async () => {
          try {
            // Import the necessary functions
            const { cleanHTML, htmlToMarkdown, processTextForLLM } =
              await import('../lib/utils/converters');

            // Extract page content
            const html = document.documentElement.outerHTML;
            const cleanedHTML = cleanHTML(html);
            const markdown = htmlToMarkdown(cleanedHTML);
            const processedMarkdown = processTextForLLM(markdown);

            // Add metadata
            const metadata = `# ${document.title || 'Web Page'}

**URL:** ${window.location.href}
**Converted:** ${new Date().toISOString()}

---

`;

            // Truncate for AI context
            const maxLength = 6_000;
            const finalContent = metadata + processedMarkdown;
            const pageContext =
              finalContent.length > maxLength
                ? finalContent.substring(0, maxLength) +
                  '\n\n... [Content truncated for AI context]'
                : finalContent;

            console.log('Content script: Extracted page context, sending back');
            sendResponse({ success: true, pageContext });
          } catch (error) {
            console.error(
              'Content script: Error extracting page content:',
              error
            );
            sendResponse({
              success: false,
              error: 'Failed to extract page content',
              pageContext: `# ${document.title || 'Web Page'}

**URL:** ${window.location.href}

**Error:** Failed to convert to markdown

---

${document.body.textContent || 'No content available'}`,
            });
          }
        })();
        return true; // Indicate we will send a response asynchronously
      }
    };

    // Use Chrome messaging system
    chrome.runtime.onMessage.addListener(handleMessage);

    // Clean up on script removal
    ctx.onInvalidated(() => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('focusin', handleTextareaFocus, true);
      document.removeEventListener('focusout', handleTextareaBlur, true);
      document.removeEventListener('click', handleTextareaClick, true);
      chrome.runtime.onMessage.removeListener(handleMessage);

      if (ui && isVisible) {
        searchStore.hide();
        ui.remove();
      }

      if (selectionPopupUI) {
        selectionPopupUI.remove();
      }

      if (writerAssistantUI) {
        writerAssistantUI.remove();
      }

      // Clear any pending selection timeout
      clearTimeout((window as any).__selectionTimeout);
    });
  },
});
