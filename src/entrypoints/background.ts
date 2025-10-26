import type { CollectionType, ImageItem, Recipe } from '@/types/formatter';

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
    if (message.action === 'fetchUrl') {
      handleFetchUrl(message.data.url)
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Async response
    }

    if (message.action === 'extractWithClaude') {
      handleExtractWithClaude(message.data.content, message.data.type)
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Async response
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

/**
 * Fetch URL content from background to avoid CORS
 */
async function handleFetchUrl(url: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    // Validate URL
    new URL(url);

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error('URL does not return HTML content. Please paste the content manually.');
    }

    const html = await response.text();

    // Simple HTML cleaning - extract text content
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove scripts, styles, etc.
    doc.querySelectorAll('script, style, noscript, iframe, nav, header, footer, aside').forEach((el) => {
      el.remove();
    });

    // Extract title
    const title = doc.querySelector('title')?.textContent?.trim() || '';

    // Extract main content
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.recipe',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-content',
      '#content',
      'body',
    ];

    let mainContent = null;
    for (const selector of contentSelectors) {
      mainContent = doc.querySelector(selector);
      if (mainContent) break;
    }

    const textContent = mainContent ? mainContent.textContent : doc.body.textContent;
    const cleanText = textContent?.replace(/\s+/g, ' ').trim() || '';

    // Extract images
    const imgElements = doc.querySelectorAll('img');
    const images: string[] = [];
    imgElements.forEach((img) => {
      const imgUrl = img.getAttribute('src') || img.getAttribute('data-src');
      if (imgUrl && imgUrl.startsWith('http')) {
        images.push(imgUrl);
      }
    });

    let content = title ? `${title}\n\n${cleanText}` : cleanText;

    if (images.length > 0) {
      const uniqueImages = [...new Set(images)];
      content += '\n\nImages found:\n' + uniqueImages.slice(0, 30).join('\n');
    }

    return { success: true, content };
  } catch (error) {
    console.error('Error fetching URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch URL',
    };
  }
}

/**
 * Extract data using Claude AI
 * Note: Claude API key should be stored in env variables
 */
async function handleExtractWithClaude(
  content: string,
  type: CollectionType
): Promise<{ success: boolean; data?: { title: string; data: Recipe | { images: ImageItem[] } }; error?: string }> {
  try {
    // Get Claude API key from environment or storage
    const apiKey = import.meta.env.VITE_API_CLAUDE_KEY;

    if (!apiKey) {
      throw new Error('Claude API key not configured. Please set VITE_API_CLAUDE_KEY in your .env file.');
    }

    const model = 'claude-3-5-haiku-20241022';
    const systemPrompt =
      type === 'recipe'
        ? `You are a recipe extraction expert. Extract recipe data from the provided content and return it as valid JSON.

The JSON structure should be:
{
  "title": "Recipe title",
  "servings": number or null,
  "ingredients": [
    {"name": "ingredient name", "amount": "amount" or null, "unit": "unit" or null}
  ],
  "main": ["step 1", "step 2", ...],
  "optional": ["optional step 1", ...] or []
}

Extract all relevant information. If servings or optional steps are not mentioned, use null or empty array respectively.
Return ONLY the JSON, no additional text.`
        : `You are an image extraction expert. Extract image data from the provided content and return it as valid JSON.

The JSON structure should be:
{
  "title": "Collection title",
  "images": [
    {"url": "image url", "title": "image title", "alt": "alt text" or null}
  ]
}

Extract all image URLs and their associated titles/descriptions. If alt text is not available, use null.
Return ONLY the JSON, no additional text.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Extract ${type} data from this content:\n\n${content}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Claude API error: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    const textContent = result.content?.find((block: any) => block.type === 'text');

    if (!textContent) {
      throw new Error('No text response from Claude');
    }

    // Parse JSON from response
    const jsonText = textContent.text.trim();
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Claude response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (type === 'recipe') {
      return {
        success: true,
        data: {
          title: parsed.title,
          data: parsed as Recipe,
        },
      };
    } else {
      return {
        success: true,
        data: {
          title: parsed.title || 'Image Collection',
          data: { images: parsed.images },
        },
      };
    }
  } catch (error) {
    console.error('Error extracting with Claude:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract data with Claude',
    };
  }
}
