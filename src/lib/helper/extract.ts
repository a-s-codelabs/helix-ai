
import {
  cleanHTML,
  htmlToMarkdown,
  processTextForLLM,
} from '../utils/converters';

export async function extractPageContent(): Promise<string> {
  try {
    const html = (
      document.querySelector("article") ||
      document.querySelector("main") ||
      document.querySelector("[role=\"main\"]") ||
      document.querySelector("#main") ||
      document.documentElement
    ).outerHTML;
    const cleanedHTML = cleanHTML(html);
    const markdown = htmlToMarkdown(cleanedHTML);
    const processedMarkdown = processTextForLLM(markdown);
    const metaDescription = document.querySelector("meta[name=\"description\"]")?.getAttribute?.("content") || "";
    const metadata = `# ${document.title || 'Web Page'}
**Title:** ${document.title}
**Description:** ${metaDescription}
**URL:** ${window.location.href}
**URL:** ${window.location.href}
**Date:** ${new Date().toISOString()}

---

Processed HTML Markdow content below

`;

    const maxLength = 60_000;
    const finalContent = metadata + processedMarkdown;

    return finalContent.length > maxLength
      ? finalContent.substring(0, maxLength) +
      '\n\n... [Content truncated for AI context]'
      : finalContent;
  } catch (err) {
    console.error('Error extracting page content:', err);
    return `# ${document.title || 'Web Page'}


**Error:** Failed to convert to markdown, using fallback text extraction

---

${document.body.textContent || 'No content available'}`;
  }
}