import { globalStorage } from "../globalStorage";
import {
  cleanHTML,
  htmlToMarkdown,
  processTextForLLM,
} from '../utils/converters';

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

    // 2. Clean HTML (remove CSS, scripts, etc.)
    const cleanedHTML = cleanHTML(html);
    // console.log('##HELIX cleanedHTML', cleanedHTML);

    // 3. Convert to markdown
    const markdown = htmlToMarkdown(cleanedHTML);

    // 4. Process for LLM
    const processedMarkdown = processTextForLLM(markdown);

    const metaDescription =
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute?.('content') || '';
    // 5. Add metadata
    const metadata = `# ${document.title || 'Web Page'}
**Title:** ${document.title}
**Description:** ${metaDescription}
**URL:** ${window.location.href}
**URL:** ${window.location.href}
**Date:** ${new Date().toISOString()}

---

`;

    // 6. Truncate for AI context
    const maxLength = 60_000;
    const finalContent = metadata + processedMarkdown;

    const data =
      finalContent.length > maxLength
        ? finalContent.substring(0, maxLength) +
        '\n\n... [Content truncated for AI context]'
        : finalContent;
    globalStorage().append({ key: 'pageMarkdown', value: { [`tab_id_${tabId}`]: data } });
    return data;
  } catch (err) {
    console.error('Error extracting page content:', err);
    return `# ${document.title || 'Web Page'}


**Error:** Failed to convert to markdown, using fallback text extraction

---

${document.body.textContent || 'No content available'}`;
  }
}