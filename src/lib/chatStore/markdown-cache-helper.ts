import { globalStorage } from '../globalStorage';
import { cleanHTML, htmlToMarkdown, processTextForLLM } from '../utils/converters';

/**
 * Convert current page to markdown and store with tabId and timestamp
 * @param tabId - The tab ID to store the content for
 * @param url - Optional URL override (defaults to window.location.href)
 * @returns The converted markdown content
 */
export async function convertAndStorePageMarkdown({ tabId, url }: { tabId?: number | null; url?: string }): Promise<string> {
  try {
    if (!tabId) {
      throw new Error('Tab ID is required');
    }

    const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
    if (!currentUrl) {
      throw new Error('URL not available');
    }

    // Check if we need document access
    const doc = typeof window !== 'undefined' ? window.document : document;
    if (!doc) {
      throw new Error('Document not available');
    }

    const html = (
      doc.querySelector('article') ||
      doc.querySelector('main') ||
      doc.querySelector('[role="main"]') ||
      doc.querySelector('#main') ||
      doc.documentElement
    )?.outerHTML || '';

    const cleanedHTML = cleanHTML(html);
    const markdown = htmlToMarkdown(cleanedHTML);
    const processedMarkdown = processTextForLLM(markdown);

    const metaDescription =
      doc.querySelector('meta[name="description"]')
        ?.getAttribute?.('content') || '';

    const metadata = `# ${doc.title || 'Web Page'}
**Title:** ${doc.title}
**Description:** ${metaDescription}
**URL:** ${currentUrl}
**Date:** ${new Date().toISOString()}

---

`;

    const maxLength = 60_000;
    const finalContent = metadata + processedMarkdown;

    const content =
      finalContent.length > maxLength
        ? finalContent.substring(0, maxLength) +
        '\n\n... [Content truncated for AI context]'
        : finalContent;

    // Store in cache with tabId as key
    await storePageMarkdown({ url: currentUrl, content, tabId });

    return content;
  } catch (err) {
    console.error('Error converting and storing page markdown:', err);
    const fallbackUrl = url || (typeof window !== 'undefined' ? window.location.href : 'unknown');
    const doc = typeof window !== 'undefined' ? window.document : document;

    return `# ${doc?.title || 'Web Page'}

**URL:** ${fallbackUrl}
**Error:** Failed to convert to markdown, using fallback text extraction

---

${doc?.body?.textContent || 'No content available'}`;
  }
}

/**
 * Get cached markdown for a URL if it exists and matches
 * @param url - The URL to check
 * @returns Cached markdown content or null if not found/doesn't match
 */
export async function getCachedPageMarkdown({ tabId }: { tabId?: number | null }): Promise<string | null> {
  try {
    const store = globalStorage();
    const allCache = await store.get('pageMarkdown');

    if (allCache && typeof allCache === 'object') {
      const cache = allCache as Record<string, { content: string; url: string; createdAt: number }>;
      const cached = cache[tabId?.toString() || ''];

      return cached?.content || null;

      // if (cached && typeof cached === 'object' && 'content' in cached && 'url' in cached) {
      //   // Verify URL matches
      //   if (cached. === tabId?.toString() || '') {
      //     return cached.content;
      //   }
      // }
    }
    return null;
  } catch (err) {
    console.error('Error getting cached page markdown:', err);
    return null;
  }
}

/**
 * Store markdown content directly without extracting
 * @param url - The URL to store
 * @param content - The markdown content to store
 * @param tabId - The tab ID to store the content for
 */
export async function storePageMarkdown({ url, content, tabId }: { url: string, content: string, tabId?: number | null }): Promise<void> {
  try {
    if (!url || !content) {
      throw new Error('URL and content are required');
    }

    if (!tabId) {
      throw new Error('Tab ID is required');
    }

    await globalStorage().append({
      key: 'pageMarkdown',
      value: {
        [tabId.toString()]: {
          content,
          url,
          createdAt: Date.now(),
        },
      },
    });
  } catch (err) {
    console.error('Error storing page markdown:', err);
    throw err;
  }
}

/**
 * Clear cached markdown for a specific URL
 * @param tabId - The tab ID to clear from cache
 */
export async function clearCachedMarkdown({ tabId }: { tabId?: number | null }): Promise<void> {
  try {
    const store = globalStorage();
    const allCache = await store.get('pageMarkdown');

    if (allCache && typeof allCache === 'object') {
      const cache = allCache as Record<string, { content: string; url: string; createdAt: number }>;
      if (cache[tabId?.toString() || '']) {
        delete cache[tabId?.toString() || ''];
        await store.set('pageMarkdown', cache);
      }
    }
  } catch (err) {
    console.error('Error clearing cached markdown:', err);
  }
}

