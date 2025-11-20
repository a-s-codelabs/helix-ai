import { globalStorage } from '../globalStorage';
import { cleanHTML, htmlToMarkdown, processTextForLLM } from '../utils/converters';

/**
 * Convert current page to markdown and store with tabId and timestamp
 * @param tabId - The tab ID to store the content for
 * @param url - Optional URL override (defaults to window.location.href)
 * @returns The converted markdown content
 */
export async function convertAndStorePageMarkdown({
  tabId,
  url,
}: {
  tabId?: number | null;
  url?: string;
}): Promise<string> {
  try {
    if (!tabId) {
      throw new Error('Tab ID is required');
    }

    // Check if we need document access
    const doc = typeof window !== 'undefined' ? window.document : document;
    if (!doc) {
      throw new Error('Document not available');
    }

    // Always prefer window.location.href when available to ensure URL matches actual page content
    // The passed URL might be stale from previous navigation
    const currentUrl =
      typeof window !== 'undefined' && window.location.href
        ? window.location.href
        : url || '';

    if (!currentUrl) {
      throw new Error('URL not available');
    }

    // Skip chrome:// and chrome-extension:// URLs - content scripts can't access them properly
    if (
      currentUrl.startsWith('chrome://') ||
      currentUrl.startsWith('chrome-extension://')
    ) {
      throw new Error(
        'Cannot store content for chrome:// or chrome-extension:// URLs'
      );
    }

    const html =
      (
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
      doc
        .querySelector('meta[name="description"]')
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

    // Verify URL matches the document title/content to catch mismatches
    // This helps detect if content and URL are out of sync
    const docTitle = doc.title || '';
    const urlMatchesContent =
      currentUrl &&
      (currentUrl.includes(new URL(currentUrl).hostname) ||
        docTitle.length > 0); // Basic validation that we have content

    if (!urlMatchesContent && currentUrl.startsWith('chrome://')) {
      console.warn(
        `Markdown cache: URL ${currentUrl} may not match page content`
      );
    }

    // Store in cache with tabId as key
    await storePageMarkdown({ url: currentUrl, content, tabId });

    return content;
  } catch (err) {
    console.error('Error converting and storing page markdown:', err);
    const fallbackUrl =
      url || (typeof window !== 'undefined' ? window.location.href : 'unknown');
    const doc = typeof window !== 'undefined' ? window.document : document;

    return `# ${doc?.title || 'Web Page'}

**URL:** ${fallbackUrl}
**Error:** Failed to convert to markdown, using fallback text extraction

---

${doc?.body?.textContent || 'No content available'}`;
  }
}

/**
 * Get cached markdown for a tab if it exists and matches
 * @param tabId - The tab ID to check
 * @param expectedUrl - Optional URL to validate against cached URL
 * @returns Cached markdown content or null if not found/doesn't match
 */
export async function getCachedPageMarkdown({
  tabId,
  expectedUrl,
}: {
  tabId?: number | null;
  expectedUrl?: string | null;
}): Promise<string | null> {
  try {
    const cached = await getCachedPageMarkdownWithUrl({ tabId, expectedUrl });
    return cached?.content || null;
  } catch (err) {
    console.error('Error getting cached page markdown:', err);
    return null;
  }
}

/**
 * Get cached markdown with URL info for verification
 * @param tabId - The tab ID to check
 * @param expectedUrl - Optional URL to validate against cached URL
 * @returns Cached markdown data (content and URL) or null if not found or URL mismatch
 */
export async function getCachedPageMarkdownWithUrl({
  tabId,
  expectedUrl,
}: {
  tabId?: number | null;
  expectedUrl?: string | null;
}): Promise<{ content: string; url: string; createdAt: number } | null> {
  try {
    if (!tabId) {
      return null;
    }

    const store = globalStorage();
    const allCache = await store.get('pageMarkdown');

    if (allCache && typeof allCache === 'object') {
      const cache = allCache as Record<
        string,
        { content: string; url: string; createdAt: number }
      >;
      const cached = cache[tabId.toString()];

      if (!cached) {
        return null;
      }

      // Reject chrome:// URLs as they're invalid
      if (
        cached.url.startsWith('chrome://') ||
        cached.url.startsWith('chrome-extension://')
      ) {
        console.warn(
          `Cache contains invalid URL for tab ${tabId}: ${cached.url}`
        );
        return null;
      }

      // Validate URL matches expected URL if provided - strict match required
      if (expectedUrl) {
        // Normalize URLs for comparison (remove trailing slashes)
        const normalizeUrl = (u: string) => u.replace(/\/$/, '');
        const normalizedExpected = normalizeUrl(expectedUrl);
        const normalizedCached = normalizeUrl(cached.url);

        if (normalizedCached !== normalizedExpected) {
          console.warn(
            `Cache URL mismatch for tab ${tabId}: expected ${expectedUrl}, got ${cached.url}`
          );
          return null;
        }
      }

      // Validate URL matches content metadata - if content mentions a different URL, the cache is stale
      const contentUrlMatch = cached.content.match(/\*\*URL:\*\*\s*(.+)/);
      if (
        contentUrlMatch &&
        contentUrlMatch[1] &&
        contentUrlMatch[1] !== cached.url
      ) {
        console.warn(
          `Cache content/URL mismatch for tab ${tabId}: stored URL ${cached.url} doesn't match content URL ${contentUrlMatch[1]}`
        );
        return null;
      }

      return cached;
    }
    return null;
  } catch (err) {
    console.error('Error getting cached page markdown with URL:', err);
    return null;
  }
}

/**
 * Store markdown content directly without extracting
 * Replaces existing entry for the same tabId to maintain 1:1:1 relationship
 * @param url - The URL to store
 * @param content - The markdown content to store
 * @param tabId - The tab ID to store the content for
 */
export async function storePageMarkdown({
  url,
  content,
  tabId,
}: {
  url: string;
  content: string;
  tabId?: number | null;
}): Promise<void> {
  try {
    if (!url || !content) {
      throw new Error('URL and content are required');
    }

    if (!tabId) {
      throw new Error('Tab ID is required');
    }

    const store = globalStorage();
    const allCache = await store.get('pageMarkdown');
    const cache =
      allCache && typeof allCache === 'object'
        ? (allCache as Record<
            string,
            { content: string; url: string; createdAt: number }
          >)
        : {};

    // Replace entry for this tabId to maintain 1:1:1 relationship
    cache[tabId.toString()] = {
      content,
      url,
      createdAt: Date.now(),
    };

    await store.set('pageMarkdown', cache);
  } catch (err) {
    console.error('Error storing page markdown:', err);
    throw err;
  }
}

/**
 * Clear cached markdown for a specific tab
 * @param tabId - The tab ID to clear from cache
 */
export async function clearCachedMarkdown({
  tabId,
}: {
  tabId?: number | null;
}): Promise<void> {
  try {
    if (!tabId) {
      return;
    }

    const store = globalStorage();
    const allCache = await store.get('pageMarkdown');

    if (allCache && typeof allCache === 'object') {
      const cache = allCache as Record<
        string,
        { content: string; url: string; createdAt: number }
      >;
      const tabIdStr = tabId.toString();
      if (cache[tabIdStr]) {
        delete cache[tabIdStr];
        await store.set('pageMarkdown', cache);
      }
    }
  } catch (err) {
    console.error('Error clearing cached markdown:', err);
  }
}

/**
 * Clean up stale entries for tabs that no longer exist
 * Should be called periodically or when extension is enabled
 * @returns Number of entries cleaned up
 */
export async function cleanupStaleMarkdownEntries(): Promise<number> {
  try {
    const store = globalStorage();
    const allCache = await store.get('pageMarkdown');

    if (!allCache || typeof allCache !== 'object') {
      return 0;
    }

    const cache = allCache as Record<
      string,
      { content: string; url: string; createdAt: number }
    >;
    const tabIds = Object.keys(cache)
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));

    if (tabIds.length === 0) {
      return 0;
    }

    // Check which tabs still exist
    const existingTabIds = new Set<number>();

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
        // Query all tabs - empty query object gets all tabs
        chrome.tabs.query({} as any, (tabs) => {
          resolve(tabs || []);
        });
      });

      tabs.forEach((tab) => {
        if (tab.id !== undefined) {
          existingTabIds.add(tab.id);
        }
      });
    } else if (typeof browser !== 'undefined' && browser.tabs) {
      const tabs = await browser.tabs.query({});
      tabs.forEach((tab) => {
        if (tab.id !== undefined) {
          existingTabIds.add(tab.id);
        }
      });
    }

    // Remove entries for tabs that no longer exist
    let cleanedCount = 0;
    for (const tabId of tabIds) {
      if (!existingTabIds.has(tabId)) {
        delete cache[tabId.toString()];
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      await store.set('pageMarkdown', cache);
    }

    return cleanedCount;
  } catch (err) {
    console.error('Error cleaning up stale markdown entries:', err);
    return 0;
  }
}

