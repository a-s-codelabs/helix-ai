import { globalStorage } from '@/lib/globalStorage';

export default defineBackground(() => {
  // Setup context menu for images: Helix AI -> Add to chat
  const PARENT_ID = 'helix_ai_menu';
  const ADD_TO_CHAT_ID = 'helix_ai_add_to_chat';

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
        // Open side panel on the current window
        if (tab && tab.windowId !== undefined && chrome.sidePanel) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
        }

        // Store action for the side panel to pick up
        await globalStorage().set('action_state', {
          actionSource: 'context-image',
          content: imageUrl,
        } as any);
      } catch (e) {
        console.error('Error handling Helix AI -> Add to chat', e);
      }
    });
  }
  // Handle keyboard shortcuts via Commands API
  if (chrome.commands && chrome.commands.onCommand) {
    chrome.commands.onCommand.addListener(async (command) => {
      console.log(`Command received: ${command}`);
      if (command === 'open-floating-telescope') {
        try {
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          const activeTab = tabs[0];
          if (activeTab?.id) {
            chrome.tabs.sendMessage(activeTab.id, {
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
    console.log(`BACKGROUND: MESSAGE`, message.type);
    if (message.type === 'OPEN_TO_SIDE_PANEL') {
      openSidePanel(message, sender);
      return true;
    }

    // if (message.type === 'GET_TELESCOPE_STATE') {
    //   try {
    //     chrome.storage?.local.get(['telescopeState'], (result) => {
    //       console.log(
    //         'Background: Retrieved telescope state:',
    //         result.telescopeState
    //       );
    //       sendResponse({ state: result.telescopeState || null });
    //     });
    //   } catch (error) {
    //     console.error('Background: Error in GET_TELESCOPE_STATE:', error);
    //     sendResponse({ state: null });
    //   }

    //   return true;
    // }

    if (message.type === 'CLEAR_TELESCOPE_STATE') {
      console.log('Background: Received CLEAR_TELESCOPE_STATE message');

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

    if (message.type === 'GET_PAGE_CONTENT') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];

        if (!activeTab || !activeTab.id) {
          console.error('Background: No active tab found');
          sendResponse({ success: false, error: 'No active tab found' });
          return;
        }

        chrome.tabs.sendMessage(
          activeTab.id,
          { type: 'EXTRACT_PAGE_CONTENT' },
          (response) => {
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
      });

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
  // if (message.state && chrome.storage) {
  //   chrome.storage.local.set({
  //     telescopeState: {
  //       messages: message.state.messages || [],
  //       isStreaming: message.state.isStreaming || false,
  //       streamingMessageId: message.state.streamingMessageId || null,
  //       inputValue: message.state.inputValue || '',
  //       inputImageAttached: message.state.inputImageAttached || [],
  //       searchIndex: message.state.searchIndex || 1,
  //       totalResults: message.state.totalResults || 0,
  //       currentState: message.state.currentState || 'ask',
  //       timestamp: Date.now(),
  //       source: message.state.source || 'move',
  //       actionSource: message.state.actionSource,
  //       targetLanguage: message.state.targetLanguage,
  //     },
  //   //   });
  // }
}
