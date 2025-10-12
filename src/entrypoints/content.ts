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
      // Check for Cmd+F (Mac) or Ctrl+F (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
        event.preventDefault();
        
        if (!isVisible) {
          await createUI();
          ui.mount();
          searchStore.show();
          isVisible = true;
        } else {
          searchStore.hide();
          ui.unmount();
          ui = undefined; // Reset ui after unmounting
          isVisible = false;
        }
      }
      
      // Handle Escape key
      if (event.key === 'Escape' && isVisible) {
        searchStore.hide();
        ui.unmount();
        ui = undefined; // Reset ui after unmounting
        isVisible = false;
      }
    };

    // Listen for keyboard events
    document.addEventListener('keydown', handleKeyDown);

    // Listen for messages from popup
    const handleMessage = async (message: any) => {
      if (message.action === 'openTelescope') {
        if (!isVisible) {
          try {
            // Wait for the page to be ready
            if (document.readyState === 'loading') {
              await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
              });
            }
            
            await createUI();
            ui.mount();
            searchStore.show();
            isVisible = true;
          } catch (error) {
            console.error('Failed to open telescope:', error);
          }
        }
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
        ui.unmount();
      }
    });
  },
});
