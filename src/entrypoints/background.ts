export default defineBackground(() => {
  // Enable side panel for all tabs by default
  if (typeof chrome !== 'undefined' && chrome.sidePanel) {
    chrome.sidePanel
      .setPanelBehavior({
        openPanelOnActionClick: true,
      })
      .catch((error) => {
        console.error('Error setting panel behavior:', error);
      });
  }

  // Handle messages from content scripts and pages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle side panel messages
    if (message.type === 'APPEND_TO_SIDE_PANEL') {
      console.log('Background: Received APPEND_TO_SIDE_PANEL message:', message);

      (async () => {
        try {
          console.log('Background: Starting side panel operations...');

          // Open the side panel first
          if (chrome.sidePanel) {
            console.log('Background: Opening side panel...', message);
            await chrome.sidePanel.open({
              windowId: sender.tab?.windowId,
            });
            console.log('Background: Side panel opened successfully');
          } else {
            console.error('Background: chrome.sidePanel not available');
            sendResponse({
              success: false,
              error: 'Side panel API not available',
            });
            return;
          }

          // Store the current state in a shared location
          if (message.state && chrome.storage) {
            console.log('Background: Storing telescope state...');
            chrome.storage.local.set(
              {
                telescopeState: {
                  messages: message.state.messages || [],
                  isStreaming: message.state.isStreaming || false,
                  streamingMessageId: message.state.streamingMessageId || null,
                  inputValue: message.state.inputValue || '',
                  inputImageAttached: message.state.inputImageAttached || [],
                  searchIndex: message.state.searchIndex || 1,
                  totalResults: message.state.totalResults || 0,
                  currentState: message.state.currentState || 'ask',
                  timestamp: Date.now(),
                  source: "append"
                },
              },
              () => {
                console.log('Background: Telescope state stored successfully');
              }
            );
          }

          console.log('Background: Sending success response...');
          sendResponse({ success: true });
        } catch (error) {
          console.error('Background: Error in MOVE_TO_SIDE_PANEL:', error);
          sendResponse({ success: false, error: (error as Error).message });
        }
      })();

      return true; // Keep the message channel open for async response
    }

    // Handle side panel messages
    if (message.type === 'MOVE_TO_SIDE_PANEL') {
      console.log('Background: Received MOVE_TO_SIDE_PANEL message:', message);

      (async () => {
        try {
          console.log('Background: Starting side panel operations...');

          // Open the side panel first
          if (chrome.sidePanel) {
            console.log('Background: Opening side panel...', message);
            await chrome.sidePanel.open({
              windowId: sender.tab?.windowId,
            });
            console.log('Background: Side panel opened successfully');
          } else {
            console.error('Background: chrome.sidePanel not available');
            sendResponse({
              success: false,
              error: 'Side panel API not available',
            });
            return;
          }

          // Store the current state in a shared location
          if (message.state && chrome.storage) {
            console.log('Background: Storing telescope state...');
            chrome.storage.local.set(
              {
                telescopeState: {
                  messages: message.state.messages || [],
                  isStreaming: message.state.isStreaming || false,
                  streamingMessageId: message.state.streamingMessageId || null,
                  inputValue: message.state.inputValue || '',
                  inputImageAttached: message.state.inputImageAttached || [],
                  searchIndex: message.state.searchIndex || 1,
                  totalResults: message.state.totalResults || 0,
                  currentState: message.state.currentState || 'ask',
                  timestamp: Date.now(),
                  source: "move"
                },
              },
              () => {
                console.log('Background: Telescope state stored successfully');
              }
            );
          }

          console.log('Background: Sending success response...');
          sendResponse({ success: true });
        } catch (error) {
          console.error('Background: Error in MOVE_TO_SIDE_PANEL:', error);
          sendResponse({ success: false, error: (error as Error).message });
        }
      })();

      return true; // Keep the message channel open for async response
    }

    // Handle GET_TELESCOPE_STATE message
    if (message.type === 'GET_TELESCOPE_STATE') {
      console.log('Background: Received GET_TELESCOPE_STATE message');

      (async () => {
        try {
          if (chrome.storage) {
            chrome.storage.local.get(['telescopeState'], (result) => {
              console.log(
                'Background: Retrieved telescope state:',
                result.telescopeState
              );
              sendResponse({ state: result.telescopeState || null });
            });
          } else {
            sendResponse({ state: null });
          }
        } catch (error) {
          console.error('Background: Error in GET_TELESCOPE_STATE:', error);
          sendResponse({ state: null });
        }
      })();

      return true; // Keep the message channel open for async response
    }

    // Handle CLEAR_TELESCOPE_STATE message
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

    // Handle GET_PAGE_CONTENT message
    if (message.type === 'GET_PAGE_CONTENT') {
      console.log('Background: Received GET_PAGE_CONTENT message');

      // Get the active tab using callback style
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];

        if (!activeTab || !activeTab.id) {
          console.error('Background: No active tab found');
          sendResponse({ success: false, error: 'No active tab found' });
          return;
        }

        console.log(
          'Background: Sending message to content script in tab',
          activeTab.id
        );

        // Send message to content script to get page content
        chrome.tabs.sendMessage(
          activeTab.id,
          { type: 'EXTRACT_PAGE_CONTENT' },
          (response) => {
            // Check for runtime errors
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
              console.log(
                'Background: Received page content from content script'
              );
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

      return true; // Keep the message channel open for async response
    }

    return false;
  });

  // Listen for side panel opened event
  if (typeof chrome !== 'undefined' && chrome.sidePanel) {
    chrome.sidePanel.onOpened?.addListener((info: any) => {
      console.log('Background: Side panel opened:', info);
    });
  }

  // Listen for tab updates to potentially show/hide side panel based on URL
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
