// Shared state management for side panel functionality
import { writable } from 'svelte/store';

export interface TelescopeState {
  messages: any[];
  isStreaming: boolean;
  streamingMessageId: number | null;
  inputValue: string;
  inputImageAttached: string[];
  searchIndex: number;
  totalResults: number;
  currentState: 'ask' | 'search' | 'chat';
  timestamp: number;
}

// Store for managing side panel state
export const sidePanelStore = writable<{
  isInSidePanel: boolean;
  telescopeState: TelescopeState | null;
}>({
  isInSidePanel: false,
  telescopeState: null,
});

// Utility functions for side panel state management
export const sidePanelUtils = {

  async appendToSidePanel(state: TelescopeState): Promise<boolean> {
    console.log('sidePanelUtils.moveToSidePanel called with state:', state);

    try {
      // Check if Chrome runtime is available
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        console.error('Chrome runtime not available');
        return false;
      }

      console.log('Chrome runtime available, using service worker approach...');
      console.log(
        'Note: chrome.sidePanel API is only available in service worker, not in content scripts'
      );

      // Use service worker approach (chrome.sidePanel is not available in content scripts)
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.error('Timeout: No response from service worker');
          resolve(false);
        }, 5000); // 5 second timeout

        chrome.runtime.sendMessage(
          {
            type: 'APPEND_TO_SIDE_PANEL',
            state,
          },
          (response) => {
            clearTimeout(timeout);
            console.log('Received response from service worker:', response);

            // Check for runtime errors
            if (chrome.runtime.lastError) {
              console.error(
                'Chrome runtime error:',
                chrome.runtime.lastError.message
              );
              resolve(false);
              return;
            }

            if (response?.success) {
              console.log(
                'Successfully moved to side panel via service worker'
              );
              sidePanelStore.update((store) => ({
                ...store,
                isInSidePanel: true,
                telescopeState: state,
              }));
              resolve(true);
            } else {
              console.error(
                'Failed to move to side panel via service worker:',
                response
              );
              resolve(false);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error moving to side panel:', error);
      return false;
    }
  },

  // Move telescope to side panel
  async moveToSidePanel(state: TelescopeState): Promise<boolean> {
    console.log('sidePanelUtils.moveToSidePanel called with state:', state);

    try {
      // Check if Chrome runtime is available
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        console.error('Chrome runtime not available');
        return false;
      }

      console.log('Chrome runtime available, using service worker approach...');
      console.log(
        'Note: chrome.sidePanel API is only available in service worker, not in content scripts'
      );

      // Use service worker approach (chrome.sidePanel is not available in content scripts)
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.error('Timeout: No response from service worker');
          resolve(false);
        }, 5000); // 5 second timeout

        chrome.runtime.sendMessage(
          {
            type: 'MOVE_TO_SIDE_PANEL',
            state,
          },
          (response) => {
            clearTimeout(timeout);
            console.log('Received response from service worker:', response);

            // Check for runtime errors
            if (chrome.runtime.lastError) {
              console.error(
                'Chrome runtime error:',
                chrome.runtime.lastError.message
              );
              resolve(false);
              return;
            }

            if (response?.success) {
              console.log(
                'Successfully moved to side panel via service worker'
              );
              sidePanelStore.update((store) => ({
                ...store,
                isInSidePanel: true,
                telescopeState: state,
              }));
              resolve(true);
            } else {
              console.error(
                'Failed to move to side panel via service worker:',
                response
              );
              resolve(false);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error moving to side panel:', error);
      return false;
    }
  },

  // Get telescope state from storage
  async getTelescopeState(): Promise<TelescopeState | null> {
    try {
      return new Promise((resolve) => {
        // Check if Chrome runtime is available
        if (typeof chrome === 'undefined' || !chrome.runtime) {
          console.error('Chrome runtime not available');
          resolve(null);
          return;
        }

        // Set a timeout to prevent hanging
        const timeout = setTimeout(() => {
          console.error('Timeout: No response from service worker');
          resolve(null);
        }, 5000); // 5 second timeout

        chrome.runtime.sendMessage(
          {
            type: 'GET_TELESCOPE_STATE',
          },
          (response) => {
            clearTimeout(timeout);

            // Check for runtime errors
            if (chrome.runtime.lastError) {
              console.error(
                'Chrome runtime error:',
                chrome.runtime.lastError.message
              );
              resolve(null);
              return;
            }
            resolve(response?.state || null);
          }
        );
      });
    } catch (error) {
      console.error('Error getting telescope state:', error);
      return null;
    }
  },

  // Clear telescope state
  async clearTelescopeState(): Promise<boolean> {
    try {
      return new Promise((resolve) => {
        // Check if Chrome runtime is available
        if (typeof chrome === 'undefined' || !chrome.runtime) {
          console.error('Chrome runtime not available');
          resolve(false);
          return;
        }

        // Set a timeout to prevent hanging
        const timeout = setTimeout(() => {
          console.error('Timeout: No response from service worker');
          resolve(false);
        }, 5000); // 5 second timeout

        chrome.runtime.sendMessage(
          {
            type: 'CLEAR_TELESCOPE_STATE',
          },
          (response) => {
            clearTimeout(timeout);

            // Check for runtime errors
            if (chrome.runtime.lastError) {
              console.error(
                'Chrome runtime error:',
                chrome.runtime.lastError.message
              );
              resolve(false);
              return;
            }

            if (response?.success) {
              sidePanelStore.update((store) => ({
                ...store,
                isInSidePanel: false,
                telescopeState: null,
              }));
              resolve(true);
            } else {
              console.error('Failed to clear telescope state:', response);
              resolve(false);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error clearing telescope state:', error);
      return false;
    }
  },

  // Check if we're in side panel mode
  isInSidePanelMode(): boolean {
    let isInSidePanel = false;
    sidePanelStore.subscribe((store) => {
      isInSidePanel = store.isInSidePanel;
    })();
    return isInSidePanel;
  },

  // Get page content from active tab (for side panel mode)
  async getPageContent(): Promise<string | null> {
    try {
      console.log(
        'sidePanelUtils.getPageContent: Requesting page content from background'
      );

      return new Promise((resolve) => {
        // Check if Chrome runtime is available
        if (typeof chrome === 'undefined' || !chrome.runtime) {
          console.error('Chrome runtime not available');
          resolve(null);
          return;
        }

        // Set a timeout to prevent hanging
        const timeout = setTimeout(() => {
          console.error('Timeout: No response from background script');
          resolve(null);
        }, 10000); // 10 second timeout

        chrome.runtime.sendMessage(
          {
            type: 'GET_PAGE_CONTENT',
          },
          (response) => {
            clearTimeout(timeout);

            // Check for runtime errors
            if (chrome.runtime.lastError) {
              console.error(
                'Chrome runtime error:',
                chrome.runtime.lastError.message
              );
              resolve(null);
              return;
            }

            if (response?.success && response.pageContext) {
              console.log(
                'sidePanelUtils.getPageContent: Received page content'
              );
              resolve(response.pageContext);
            } else {
              console.error('Failed to get page content:', response?.error);
              resolve(null);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error getting page content:', error);
      return null;
    }
  },
};
