import { globalStorage } from '@/lib/globalStorage';
import { getFeatureConfig } from '@/lib/featureConfig';

export default defineBackground(() => {
  // Setup context menu for images: Helix AI -> Add to chat
  const PARENT_ID = 'helix_ai_menu';
  const ADD_TO_CHAT_ID = 'helix_ai_add_to_chat';

  // Message type constants
  const MESSAGE_TYPE_OPEN_TO_SIDE_PANEL = 'OPEN_TO_SIDE_PANEL';
  const MESSAGE_TYPE_OPEN_SHORTCUTS_PAGE = 'OPEN_SHORTCUTS_PAGE';
  const MESSAGE_TYPE_CLEAR_TELESCOPE_STATE = 'CLEAR_TELESCOPE_STATE';
  const MESSAGE_TYPE_GET_PAGE_CONTENT = 'GET_PAGE_CONTENT';
  const MESSAGE_TYPE_EXTRACT_PAGE_CONTENT = 'EXTRACT_PAGE_CONTENT';
  const MESSAGE_TYPE_GET_TAB_ID = 'GET_TAB_ID';
  const MESSAGE_TYPE_REQUEST_AUDIO = 'REQUEST_AUDIO';

  /**
   * Get the active tab ID
   * @returns Promise resolving to the active tab ID or null if not found
   */
  async function getTabId(): Promise<{ tabId: number | null, url: string | null }> {
    try {
      const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          resolve(tabs || []);
        });
      });
      return {
        tabId: tabs[0]?.id || null,
        url: tabs[0]?.url || null,
      };
    } catch (error) {
      console.error('Background: Error getting tab ID:', error);
      return {
        tabId: null,
        url: null,
      };
    }
  }

  async function createContextMenus() {
    try {
      const ctx = (chrome as any).contextMenus;
      if (!ctx) return;
      await ctx.removeAll().catch(() => void 0);
      ctx.create({
        id: PARENT_ID,
        title: 'Helix AI',
        contexts: ['image'],
      });
      ctx.create({
        id: ADD_TO_CHAT_ID,
        parentId: PARENT_ID,
        title: 'Add to chat',
        contexts: ['image'],
      });
    } catch (err) {
      console.error('Failed to create context menus', err);
    }
  }

  if (chrome.runtime && (chrome.runtime as any).onInstalled) {
    (chrome.runtime as any).onInstalled.addListener(() => {
      createContextMenus();
    });
  }
  if (chrome.runtime && (chrome.runtime as any).onStartup) {
    (chrome.runtime as any).onStartup.addListener(() => {
      createContextMenus();
    });
  }

  const ctx = (chrome as any).contextMenus;
  if (ctx && ctx.onClicked) {
    ctx.onClicked.addListener(async (info: any, tab: any) => {
      if (info.menuItemId !== ADD_TO_CHAT_ID) return;
      const imageUrl = info.srcUrl || '';
      try {
        if (tab && tab.windowId !== undefined && chrome.sidePanel) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
        }
        await globalStorage().set('action_state', {
          actionSource: 'context-image',
          content: imageUrl,
        } as any);
      } catch (e) {
        console.error('Error handling Helix AI -> Add to chat', e);
      }
    });
  }

  if (chrome.commands && chrome.commands.onCommand) {
    chrome.commands.onCommand.addListener(async (command: string) => {
      if (command === 'open-floating-telescope') {
        try {

          globalStorage().append({
            key: "config",
            value: {
              assignedTelescopeCommand: true,
            },
          });

          const featureConfig = await getFeatureConfig();
          if (!featureConfig.floatingTelescopeEnabled) {
            console.warn('Floating telescope is disabled');
            return;
          }

          const { tabId } = await getTabId();
          if (tabId) {
            chrome.tabs.sendMessage(tabId, {
              action: 'openTelescope',
            });
          }
        } catch (error) {
          console.error('Error opening floating telescope:', error);
        }
      }
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MESSAGE_TYPE_OPEN_TO_SIDE_PANEL) {
      openSidePanel(message, sender);
      return true;
    }

    if (message.type === MESSAGE_TYPE_GET_TAB_ID) {
      (async () => {
        try {
          const { tabId, url } = await getTabId();
          sendResponse({ success: true, tabId, url });
        } catch (error) {
          console.error("Background: Error in GET_TAB_ID", error);
          sendResponse({ success: false, error: (error as Error).message });
        }
      })();
      return true; // Keep message channel open for async response
    }

    if (message.type === MESSAGE_TYPE_OPEN_SHORTCUTS_PAGE) {
      chrome.tabs.create(
        { url: 'chrome://extensions/shortcuts' },
        (tab: chrome.tabs.Tab) => {
          if (chrome.runtime.lastError) {
            console.error(
              'Error opening shortcuts page:',
              chrome.runtime.lastError.message
            );
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
            });
          } else {
            sendResponse({ success: true });
          }
        }
      );
      return true;
    }

    if (message.type === MESSAGE_TYPE_CLEAR_TELESCOPE_STATE) {

      try {
        if (chrome.storage) {
          chrome.storage.local.remove(['telescopeState'], () => {
            console.log('Background: Telescope state cleared successfully');
          });
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error('Background: Error in CLEAR_TELESCOPE_STATE:', error);
        sendResponse({ success: false, error: (error as Error).message });
      }

      return true;
    }

    if (message.type === MESSAGE_TYPE_REQUEST_AUDIO) {
      (async () => {
        const tabId = message.tabId || (await getTabId()).tabId;
        if (!tabId) {
          console.error('Background: No tab ID provided for audio request');
          sendResponse({ success: false, error: 'No tab ID found' });
          return;
        }

        chrome.tabs.sendMessage(
          tabId,
          { type: MESSAGE_TYPE_REQUEST_AUDIO },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                'Background: Error communicating with content script for audio:',
                chrome.runtime.lastError.message
              );
              sendResponse({
                success: false,
                error: 'Content script not available. Please reload the page.',
              });
              return;
            }
            sendResponse(response || { success: true });
          }
        );
      })();

      return true;
    }

    if (message.type === MESSAGE_TYPE_GET_PAGE_CONTENT) {
      (async () => {
        const { tabId } = await getTabId();
        if (!tabId) {
          console.error('Background: No active tab found');
          sendResponse({ success: false, error: 'No active tab found' });
          return;
        }

        const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            resolve(tabs || []);
          });
        });
        const activeTab = tabs[0];
        const tabUrl = activeTab?.url || '';

        chrome.tabs.sendMessage(
          tabId,
          { type: MESSAGE_TYPE_EXTRACT_PAGE_CONTENT },
          async (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                'Background: Error communicating with content script:',
                chrome.runtime.lastError.message
              );
              sendResponse({
                success: false,
                error: 'Content script not available. Please reload the page.',
              });
              return;
            }

            if (response && response.success && response.pageContext) {
              // Store in cache if we have the tab ID and URL
              if (tabId && tabUrl) {
                try {
                  const { storePageMarkdown } = await import('@/lib/chatStore/markdown-cache-helper');
                  await storePageMarkdown({ url: tabUrl, content: response.pageContext, tabId });
                } catch (storeErr) {
                  console.warn('Background: Failed to store markdown in cache:', storeErr);
                }
              }

              sendResponse({
                success: true,
                pageContext: response.pageContext,
              });
            } else {
              console.error(
                'Background: Failed to get page content:',
                response?.error
              );
              sendResponse({
                success: false,
                error: response?.error || 'Failed to extract page content',
              });
            }
          }
        );
      })();

      return true;
    }

    return false;
  });

  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.onUpdated.addListener(
      async (tabId: number, changeInfo: any, tab: any) => {
        if (changeInfo.status === 'complete' && tab.url) {
          try {
            if (chrome.sidePanel) {
              await chrome.sidePanel.setOptions({
                tabId,
                enabled: true,
              });
            }
          } catch (error) {
            console.error(
              'Background: Error setting side panel options:',
              error
            );
          }
        }
      }
    );
  }
});

function openSidePanel(message: any, sender: any) {
  chrome.sidePanel
    .open({
      windowId: sender.tab?.windowId,
    })
    .catch((error) => {
      console.error('Error opening side panel:', error);
    });
}
