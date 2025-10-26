/*@ts-ignore */
import App from './telescope-ui/App.svelte';
/*@ts-ignore */
import SelectionPopupContainer from './selection-popup/SelectionPopupContainer.svelte';
import { mount, unmount } from 'svelte';
import { get } from 'svelte/store';
import { selectionPopupStore } from '../lib/selectionPopupStore';
import type { SelectionAction } from './selection-popup/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    let ui: any = null;
    let isVisible = false;

    // Selection popup state
    let selectionPopupUI: any = null;

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

      // Ensure popup stays within viewport bounds
      const popupWidth = 200; // Approximate popup width
      const popupHeight = 60; // Approximate popup height
      const margin = 20; // Margin from viewport edges

      let { x, y } = position;

      // Adjust horizontal position if popup would go off-screen
      if (x - popupWidth / 2 < margin) {
        x = margin + popupWidth / 2;
      } else if (x + popupWidth / 2 > window.innerWidth - margin) {
        x = window.innerWidth - margin - popupWidth / 2;
      }

      // Adjust vertical position if popup would go off-screen
      let isAtTop = false;
      if (y - popupHeight - margin < 0) {
        // If popup would go above viewport, position it at the top with extra margin
        y = margin + 40; // Extra margin when at top
        isAtTop = true;
      } else if (y > window.innerHeight - margin) {
        // If popup would go below viewport, position it at the bottom
        y = window.innerHeight - margin;
      }

      // Ensure the UI is created
      if (!selectionPopupUI) {
        await createSelectionPopupUI();
        selectionPopupUI.mount();
      }

      // Update state with positioning info
      selectionPopupStore.show(x, y, selectedText, isAtTop);
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

    // Helper to check if the selection popup is currently visible
    const isSelectionPopupVisible = () => {
      // Checks via the store (works since we always mount but can update the store state)
      // Use get method since it's a Svelte writable
      return get(selectionPopupStore.getState()).visible;
    };

    // Helper to update the popup position according to current selection
    const updateSelectionPopupPosition = () => {
      // If the popup is not showing, don't do anything
      if (!isSelectionPopupVisible()) return;

      // Find new position and selected text
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();
      if (!selectedText || selectedText.length === 0) {
        hideSelectionPopup();
        return;
      }

      const position = getSelectionPosition();
      if (!position) {
        hideSelectionPopup();
        return;
      }

      // Ensure popup stays within viewport bounds
      const popupWidth = 200; // Approximate popup width
      const popupHeight = 60; // Approximate popup height
      const margin = 20; // Margin from viewport edges

      let { x, y } = position;

      // Adjust horizontal position if popup would go off-screen
      if (x - popupWidth / 2 < margin) {
        x = margin + popupWidth / 2;
      } else if (x + popupWidth / 2 > window.innerWidth - margin) {
        x = window.innerWidth - margin - popupWidth / 2;
      }

      // Adjust vertical position if popup would go off-screen
      let isAtTop = false;
      if (y - popupHeight - margin < 0) {
        // If popup would go above viewport, position it at the top with extra margin
        y = margin + 40; // Extra margin when at top
        isAtTop = true;
      } else if (y > window.innerHeight - margin) {
        // If popup would go below viewport, position it at the bottom
        y = window.innerHeight - margin;
      }

      selectionPopupStore.show(x, y, selectedText, isAtTop);
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

    // --- Enhance for object observer: recalculate position on resize/scroll ---
    let resizeScrollObserver: (() => void) | null = null;

    const setupSelectionPopupRepositioning = () => {
      // Clean up before adding new observers
      if (resizeScrollObserver) {
        resizeScrollObserver();
      }

      // Debounced update handler
      let timeout: number | null = null;
      const onRecalc = () => {
        if (timeout) clearTimeout(timeout);
        timeout = window.setTimeout(() => {
          updateSelectionPopupPosition();
        }, 50);
      };

      // Listen for window resize and scroll
      window.addEventListener('resize', onRecalc);
      window.addEventListener('scroll', onRecalc, true); // true to catch scroll on any ancestor

      // Listen for DOM mutations that could affect layout (optional, heavy in complex pages)
      let mutationObserver: MutationObserver | null = null;
      if (typeof MutationObserver !== 'undefined') {
        mutationObserver = new MutationObserver(() => {
          onRecalc();
        });
        mutationObserver.observe(document.body, {
          attributes: true,
          childList: true,
          subtree: true,
        });
      }

      // Cleanup function to remove listeners/observers
      resizeScrollObserver = () => {
        window.removeEventListener('resize', onRecalc);
        window.removeEventListener('scroll', onRecalc, true);
        if (mutationObserver) mutationObserver.disconnect();
      };
    };

    // Set up observers when popup first appears, clean up when it hides
    // Listen to store changes to know when popup is visible
    selectionPopupStore.getState().subscribe((current) => {
      if (current.visible) {
        setupSelectionPopupRepositioning();
      } else if (resizeScrollObserver) {
        resizeScrollObserver();
        resizeScrollObserver = null;
      }
    });

    // Handle keyboard shortcuts
    const handleKeyDown = async (event: KeyboardEvent) => {
      // Check for Cmd+E (Mac) or Ctrl+E (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'e') {
        event.preventDefault();

        if (!isVisible) {
          await createUI();
          ui.mount();
          isVisible = true;
        } else {
          ui.remove();
          isVisible = false;
        }
      }

      // Handle Escape key
      if (event.key === 'Escape' && isVisible) {
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
      chrome.runtime.onMessage.removeListener(handleMessage);

      if (ui && isVisible) {
        ui.remove();
      }

      if (selectionPopupUI) {
        selectionPopupUI.remove();
      }

      // Clear any pending selection timeout
      clearTimeout((window as any).__selectionTimeout);
    });
  },
});
