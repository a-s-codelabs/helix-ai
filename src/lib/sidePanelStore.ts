import { writable } from 'svelte/store';
import { globalStorage } from './globalStorage';

export interface TelescopeState {
  messages: any[];
  isStreaming: boolean;
  streamingMessageId: number | null;
  inputValue: string;
  inputImageAttached: string[];
  searchIndex: number;
  totalResults: number;
  currentState: 'ask' | 'chat';
  source: 'append' | 'move' | 'translate' | "addtochat";
  actionSource: "summarise" | "translate" | "prompt" | "popup";
  targetLanguage: string | null;
  timestamp: number;
}

export const sidePanelStore = writable<{
  isInSidePanel: boolean;
  telescopeState: TelescopeState | null;
}>({
  isInSidePanel: false,
  telescopeState: null,
});

export const sidePanelUtils = {
  async moveToSidePanel(state?: TelescopeState): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        console.error('Chrome runtime not available');
        return resolve(false);
      }
      const timeout = setTimeout(() => {
        console.error('Timeout: No response from service worker');
        resolve(false);
      }, 5000);

      chrome.runtime.sendMessage(
        {
          type: 'OPEN_TO_SIDE_PANEL',
          state,
        },
        (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            console.error(
              'Chrome runtime error:',
              chrome.runtime.lastError.message
            );
            resolve(false);
            return;
          }

          if (response?.success && state) {
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
  },

  // Get telescope state from storage
  // async getTelescopeState(): Promise<TelescopeState | null> {
  //   return globalStorage().get("action_state");
  // },

  // // Clear telescope state
  // async clearTelescopeState(): Promise<boolean> {
  //   try {
  //     return new Promise((resolve) => {
  //       // Check if Chrome runtime is available
  //       if (typeof chrome === 'undefined' || !chrome.runtime) {
  //         console.error('Chrome runtime not available');
  //         resolve(false);
  //         return;
  //       }

  //       // Set a timeout to prevent hanging
  //       const timeout = setTimeout(() => {
  //         console.error('Timeout: No response from service worker');
  //         resolve(false);
  //       }, 5000); // 5 second timeout

  //       chrome.runtime.sendMessage(
  //         {
  //           type: 'CLEAR_TELESCOPE_STATE',
  //         },
  //         (response) => {
  //           clearTimeout(timeout);

  //           // Check for runtime errors
  //           if (chrome.runtime.lastError) {
  //             console.error(
  //               'Chrome runtime error:',
  //               chrome.runtime.lastError.message
  //             );
  //             resolve(false);
  //             return;
  //           }

  //           if (response?.success) {
  //             sidePanelStore.update((store) => ({
  //               ...store,
  //               isInSidePanel: false,
  //               telescopeState: null,
  //             }));
  //             resolve(true);
  //           } else {
  //             console.error('Failed to clear telescope state:', response);
  //             resolve(false);
  //           }
  //         }
  //       );
  //     });
  //   } catch (error) {
  //     console.error('Error clearing telescope state:', error);
  //     return false;
  //   }
  // },

  isInSidePanelMode(): boolean {
    let isInSidePanel = false;
    sidePanelStore.subscribe((store) => {
      isInSidePanel = store.isInSidePanel;
    })();
    return isInSidePanel;
  },

  async getPageContent(): Promise<string | null> {
    try {
      return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
          console.error('Chrome runtime not available');
          resolve(null);
          return;
        }

        const timeout = setTimeout(() => {
          console.error('Timeout: No response from background script');
          resolve(null);
        }, 10000);

        chrome.runtime.sendMessage(
          {
            type: 'GET_PAGE_CONTENT',
          },
          (response) => {
            clearTimeout(timeout);

            if (chrome.runtime.lastError) {
              console.error(
                'Chrome runtime error:',
                chrome.runtime.lastError.message
              );
              resolve(null);
              return;
            }

            if (response?.success && response.pageContext) {
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
