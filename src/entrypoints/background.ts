import { globalStorage } from '@/lib/globalStorage';
import { getFeatureConfig } from '@/lib/featureConfig';

const SIDEPANEL_HTML_PATH = 'sidepanel.html';
const CHROME_SHORTCUTS_URL = 'chrome://extensions/shortcuts';
const FIREFOX_SHORTCUTS_URL = 'about:addons';

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
   * Always queries for the current active tab to ensure freshness
   * @returns Promise resolving to the active tab ID or null if not found
   */
  async function getTabId(): Promise<{
    tabId: number | null;
    url: string | null;
  }> {
    const storage = globalStorage();
    const fallbackStored = await storage.get('active_tab_id');
    const fallback = {
      tabId:
        typeof fallbackStored === 'object' &&
        fallbackStored &&
        typeof (fallbackStored as any).tabId === 'number'
          ? ((fallbackStored as any).tabId as number)
          : null,
      url:
        typeof fallbackStored === 'object' &&
        fallbackStored &&
        typeof (fallbackStored as any).url === 'string'
          ? ((fallbackStored as any).url as string)
          : null,
    };

    try {
      // Always query for the current active tab (never use stale cache)
      const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          resolve(tabs || []);
        });
      });
      const activeTab = tabs[0];
      const tabId = activeTab?.id ?? null;
      const url = activeTab?.url ?? null;

      if (tabId !== null) {
        // Always update storage with the fresh active tab info
        await storage.set('active_tab_id', { tabId, url });
        console.log(
          'Background: getTabId() updated active_tab_id to tabId',
          tabId,
          'URL:',
          url
        );
        return { tabId, url };
      }

      // Only use fallback if we couldn't get active tab
      console.warn(
        'Background: No active tab found, using fallback:',
        fallback
      );
      return fallback;
    } catch (error) {
      console.error('Background: Error getting tab ID:', error);
      return fallback;
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
        if (tab && tab.windowId !== undefined) {
          await openPanelForWindow(tab.windowId);
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
            key: 'config',
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
          console.error('Background: Error in GET_TAB_ID', error);
          sendResponse({ success: false, error: (error as Error).message });
        }
      })();
      return true; // Keep message channel open for async response
    }

    if (message.type === MESSAGE_TYPE_OPEN_SHORTCUTS_PAGE) {
      const shortcutsUrl = hasSidebarActionSupport()
        ? FIREFOX_SHORTCUTS_URL
        : CHROME_SHORTCUTS_URL;
      chrome.tabs.create({ url: shortcutsUrl }, (tab: chrome.tabs.Tab) => {
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
      });
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
        // Use provided tabId if available, otherwise get active tab
        let tabId: number | null = null;
        let tabUrl: string | null = null;

        if (message.tabId && typeof message.tabId === 'number') {
          // Use the specific tabId provided
          tabId = message.tabId;
          try {
            const tab = await new Promise<chrome.tabs.Tab>(
              (resolve, reject) => {
                chrome.tabs.get(tabId!, (tab) => {
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                  } else {
                    resolve(tab);
                  }
                });
              }
            );
            tabUrl = tab?.url || null;
            console.log(
              'Background: Using provided tabId',
              tabId,
              'with URL',
              tabUrl
            );
          } catch (err) {
            console.warn(
              'Background: Failed to get tab info for provided tabId',
              tabId,
              ':',
              err
            );
            // Fallback to active tab
            const tabInfo = await getTabId();
            tabId = tabInfo.tabId;
            tabUrl = tabInfo.url;
          }
        } else {
          // Get active tab
          const tabInfo = await getTabId();
          tabId = tabInfo.tabId;
          tabUrl = tabInfo.url;
        }

        if (!tabId) {
          console.error('Background: No tab found');
          sendResponse({ success: false, error: 'No tab found' });
          return;
        }

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
                  const { storePageMarkdown } = await import(
                    '@/lib/chatStore/markdown-cache-helper'
                  );
                  await storePageMarkdown({
                    url: tabUrl,
                    content: response.pageContext,
                    tabId,
                  });
                } catch (storeErr) {
                  console.warn(
                    'Background: Failed to store markdown in cache:',
                    storeErr
                  );
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

  /**
   * Update active_tab_id in storage
   * This is called whenever a tab is activated or updated
   */
  async function updateActiveTabId(
    tabId: number,
    url: string | null = null
  ): Promise<void> {
    try {
      // If URL not provided, get it from the tab
      if (!url) {
        try {
          const tab = await new Promise<chrome.tabs.Tab | null>((resolve) => {
            chrome.tabs.get(tabId, (result) => {
              if (chrome.runtime.lastError) {
                resolve(null);
                return;
              }
              resolve(result || null);
            });
          });
          url = tab?.url || null;
        } catch (err) {
          console.warn(
            'Background: Failed to get tab URL for tabId',
            tabId,
            ':',
            err
          );
        }
      }

      // Check if this tab is actually the active tab before updating
      try {
        const activeTabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            resolve(tabs || []);
          });
        });
        const activeTab = activeTabs[0];

        // Only update if this is the active tab
        if (activeTab?.id === tabId) {
          await globalStorage().set('active_tab_id', {
            tabId,
            url,
          });
          console.log(
            'Background: Updated active_tab_id to tabId',
            tabId,
            'URL:',
            url
          );
        }
      } catch (err) {
        console.warn('Background: Failed to verify active tab:', err);
        // Still update if verification fails (better than not updating)
        await globalStorage().set('active_tab_id', {
          tabId,
          url,
        });
      }
    } catch (error) {
      console.error('Background: Error updating active tab ID:', error);
    }
  }

  if (typeof chrome !== 'undefined' && chrome.tabs) {
    // Listen for tab updates (URL changes, page loads, etc.)
    chrome.tabs.onUpdated.addListener(
      async (tabId: number, changeInfo: any, tab: any) => {
        // Update when URL changes (even if page isn't fully loaded)
        if (changeInfo.url && tab.url) {
          await updateActiveTabId(tabId, tab.url);
        }

        // Also update when page finishes loading
        if (changeInfo.status === 'complete' && tab.url) {
          try {
            if (chrome.sidePanel) {
              await chrome.sidePanel.setOptions({
                tabId,
                enabled: true,
              });
            }
            await updateActiveTabId(tabId, tab.url);
          } catch (error) {
            console.error(
              'Background: Error setting side panel options:',
              error
            );
          }
        }
      }
    );

    // Listen for tab activation (when user switches tabs)
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        // Immediately update with the tabId, then get URL
        await updateActiveTabId(activeInfo.tabId);

        // Also try to get the full tab info for better URL
        const tab = await new Promise<chrome.tabs.Tab | null>((resolve) => {
          chrome.tabs.get(activeInfo.tabId, (result) => {
            if (chrome.runtime.lastError) {
              resolve(null);
              return;
            }
            resolve(result || null);
          });
        });

        if (tab?.url) {
          await updateActiveTabId(activeInfo.tabId, tab.url);
        }
      } catch (error) {
        console.error('Background: Error tracking active tab:', error);
      }
    });
  }
});

function hasSidebarActionSupport(): boolean {
  return Boolean((chrome as any)?.sidebarAction?.open);
}

async function openPanelForWindow(windowId?: number): Promise<boolean> {
  try {
    if (chrome.sidePanel) {
      await chrome.sidePanel.open({ windowId });
      return true;
    }

    const sidebarAction = (chrome as any).sidebarAction;
    if (!sidebarAction) {
      return false;
    }

    const panelUrl =
      chrome.runtime && typeof chrome.runtime.getURL === 'function'
        ? chrome.runtime.getURL(SIDEPANEL_HTML_PATH)
        : SIDEPANEL_HTML_PATH;

    if (typeof sidebarAction.setPanel === 'function') {
      await sidebarAction.setPanel({
        windowId,
        panel: panelUrl,
      });
    }

    if (typeof sidebarAction.open === 'function') {
      await sidebarAction.open(
        typeof windowId === 'number' ? { windowId } : undefined
      );
      return true;
    }
  } catch (error) {
    console.error('Error opening Helix side interface:', error);
  }

  return false;
}

function openSidePanel(message: any, sender: any) {
  void openPanelForWindow(sender.tab?.windowId);
}
