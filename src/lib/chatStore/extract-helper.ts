import { globalStorage } from "../globalStorage";
import {
  cleanHTML,
  htmlToMarkdown,
  processTextForLLM,
} from '../utils/converters';
import { storePageMarkdown } from './markdown-cache-helper';

export async function extractPageContent({
  tabId,
}: {
  tabId: number;
}): Promise<string> {
  try {
    const html = (
      document.querySelector('article') ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.querySelector('#main') ||
      document.documentElement
    ).outerHTML;
    const cleanedHTML = cleanHTML(html);
    const markdown = htmlToMarkdown(cleanedHTML);
    const processedMarkdown = processTextForLLM(markdown);

    const metaDescription =
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute?.('content') || '';
    const currentUrl = window.location.href;
    const metadata = `# ${document.title || 'Web Page'}
**Title:** ${document.title}
**Description:** ${metaDescription}
**URL:** ${currentUrl}
**Date:** ${new Date().toISOString()}

---

`;

    const maxLength = 60_000;
    const finalContent = metadata + processedMarkdown;

    const data =
      finalContent.length > maxLength
        ? finalContent.substring(0, maxLength) +
        '\n\n... [Content truncated for AI context]'
        : finalContent;

    // Store using the same format as markdown-cache-helper for consistency
    try {
      await storePageMarkdown({ url: currentUrl, content: data, tabId });
    } catch (storeErr) {
      console.warn('Failed to store page markdown in extract-helper:', storeErr);
    }

    return data;
  } catch (err) {
    console.error('Error extracting page content:', err);
    return `# ${document.title || 'Web Page'}


**Error:** Failed to convert to markdown, using fallback text extraction

---

${document.body.textContent || 'No content available'}`;
  }
}