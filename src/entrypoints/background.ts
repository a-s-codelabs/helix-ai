import type { CollectionType, ImageItem, Recipe } from '@/types/formatter';

export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  // Handle messages from content scripts and pages
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fetchUrl') {
      handleFetchUrl(message.data.url)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // Async response
    }

    if (message.action === 'extractWithClaude') {
      handleExtractWithClaude(message.data.content, message.data.type)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // Async response
    }

    return false;
  });
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
