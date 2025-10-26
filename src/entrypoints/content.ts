/*@ts-ignore */
import App from './telescope-ui/App.svelte';
import { mount, unmount } from 'svelte';
import { searchStore } from '../lib/searchStore';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    let ui: any = null;
    let isVisible = false;

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
      chrome.runtime.onMessage.removeListener(handleMessage);
      if (ui && isVisible) {
        searchStore.hide();
        ui.remove();
      }
    });
  },
});
