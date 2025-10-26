import DOMPurify from 'dompurify';
import {
  parser,
  parser_end,
  parser_write,
  default_renderer,
} from 'streaming-markdown';

/**
 * Streaming markdown parser with security sanitization
 * Based on Chrome's best practices for rendering streamed LLM responses
 * @see https://developer.chrome.com/docs/ai/render-llm-responses#render_streamed_plain_text
 */
export class SecureStreamingMarkdown {
  private parser: any;
  private chunks: string = '';
  private outputElement: HTMLElement;
  private isInsecure: boolean = false;

  constructor(outputElement: HTMLElement) {
    this.outputElement = outputElement;
    // Create a renderer that appends to the output element
    const renderer = default_renderer(outputElement);
    this.parser = parser(renderer);
  }

  /**
   * Process a new chunk of markdown content
   * @param chunk - The new chunk to process
   * @returns true if processing should continue, false if insecure content detected
   */
  processChunk(chunk: string): boolean {
    if (this.isInsecure) {
      return false;
    }

    // Add chunk to accumulated content
    this.chunks += chunk;

    // Sanitize all chunks received so far for security
    const sanitized = DOMPurify.sanitize(this.chunks, {
      ALLOWED_TAGS: [
        'strong',
        'em',
        'br',
        'a',
        'p',
        'code',
        'pre',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      ALLOWED_URI_REGEXP:
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });

    // Check if the output was insecure
    if (DOMPurify.removed.length > 0) {
      console.warn(
        'Insecure content detected, stopping rendering:',
        DOMPurify.removed
      );
      this.isInsecure = true;
      // Reset the parser and flush remaining markdown
      parser_end(this.parser);
      return false;
    }

    // Parse each chunk individually using streaming markdown
    // This appends to existing rendered output instead of replacing it
    parser_write(this.parser, chunk);

    return true;
  }

  /**
   * Finalize the parsing process
   */
  finalize(): void {
    if (!this.isInsecure) {
      parser_end(this.parser);
    }
  }

  /**
   * Reset the parser for new content
   */
  reset(): void {
    this.chunks = '';
    this.isInsecure = false;
    // Create a new renderer and parser
    const renderer = default_renderer(this.outputElement);
    this.parser = parser(renderer);
  }

  /**
   * Check if the content was marked as insecure
   */
  get isContentInsecure(): boolean {
    return this.isInsecure;
  }

  /**
   * Get the accumulated chunks
   */
  get accumulatedChunks(): string {
    return this.chunks;
  }
}

/**
 * Simple markdown formatter for basic text formatting
 * Handles bold (**text**), italic (*text*), links [text](url), plain URLs, tables, code blocks, ordered/unordered lists, and line breaks
 */
export function formatBasicMarkdown(text: string): string {
  // First, extract and convert tables to HTML
  let result = text;

  // Match markdown tables (lines starting with |)
  const tableRegex = /^(\|.+\|)\s*\n(\|[-:\s|]+\|)\s*\n((?:\|.+\|\s*\n?)+)/gm;

  result = result.replace(
    tableRegex,
    (match, headerRow, separatorRow, bodyRows) => {
      // Parse header
      const headers = headerRow
        .split('|')
        .slice(1, -1)
        .map((h: string) => h.trim());

      // Parse body rows
      const rows = bodyRows
        .trim()
        .split('\n')
        .map((row: string) =>
          row
            .split('|')
            .slice(1, -1)
            .map((cell: string) => cell.trim())
        );

      // Build HTML table
      let tableHtml = '<table>';

      // Header
      tableHtml += '<thead><tr>';
      headers.forEach((header: string) => {
        tableHtml += `<th>${header}</th>`;
      });
      tableHtml += '</tr></thead>';

      // Body
      tableHtml += '<tbody>';
      rows.forEach((row: string[]) => {
        tableHtml += '<tr>';
        row.forEach((cell: string) => {
          tableHtml += `<td>${cell}</td>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody></table>';

      return tableHtml;
    }
  );

  // Handle ordered lists (1. item, 2. item, etc.)
  // Match consecutive lines starting with number, period, and space
  result = result.replace(/^(\d+\.\s+.+(?:\n\d+\.\s+.+)*)/gm, (match) => {
    const items = match
      .split('\n')
      .map((line) => line.replace(/^\d+\.\s+/, '').trim())
      .filter((item) => item.length > 0);
    const listItems = items.map((item) => `<li>${item}</li>`).join('');
    return `<ol>${listItems}</ol>`;
  });

  // Handle unordered lists (-, *, or + followed by space)
  // Match consecutive lines starting with -, *, or +
  result = result.replace(/^([*\-+]\s+.+(?:\n[*\-+]\s+.+)*)/gm, (match) => {
    const items = match
      .split('\n')
      .map((line) => line.replace(/^[*\-+]\s+/, '').trim())
      .filter((item) => item.length > 0);
    const listItems = items.map((item) => `<li>${item}</li>`).join('');
    return `<ul>${listItems}</ul>`;
  });

  return (
    result
      // Handle fenced code blocks (```language\ncode\n```) - must be done before inline code
      // Support both \n and \r\n line endings, optional language identifier, and various formats
      .replace(
        /```(\w+)?\s*\r?\n([\s\S]*?)\r?\n?```/g,
        (match, language, code) => {
          // Strip markdown formatting from code content
          let cleanCode = code
            // Remove markdown links [text](url)
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
            // Remove bold **text**
            .replace(/\*\*(.*?)\*\*/g, '$1')
            // Remove italic *text*
            .replace(/(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g, '$1')
            // Remove headings #
            .replace(/^#{1,6}\s+/gm, '')
            // Remove horizontal rules
            .replace(/^[-*_]{3,}\s*$/gm, '')
            // Remove list markers
            .replace(/^[\s]*[-*+]\s+/gm, '')
            .replace(/^[\s]*\d+\.\s+/gm, '');

          // Escape HTML entities in code to prevent injection
          const escapedCode = cleanCode
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
          return `<pre><code>${escapedCode}</code></pre>`;
        }
      )
      // Handle inline code (`code`) - must be done after code blocks
      // Use negative lookahead to avoid matching triple backticks
      .replace(/(?<!`)`(?!``)([^`\n]+)`(?!`)/g, (match, code) => {
        // Escape HTML entities in inline code
        const escapedCode = code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
        return `<code>${escapedCode}</code>`;
      })
      // Handle headings (h1-h6) - must be processed before other inline formatting
      // Match headings at the start of a line with at least one space after #
      .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
      .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
      .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
      .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
      // Handle markdown links [text](url) - convert to clickable links (must be done BEFORE plain URL detection)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        // Normalize URL - add protocol if missing and remove trailing slash
        let normalizedUrl = url.trim().replace(/\/$/, '');
        if (normalizedUrl.startsWith('www.')) {
          normalizedUrl = `https://${normalizedUrl}`;
        } else if (!/^(https?|ftp):\/\//i.test(normalizedUrl)) {
          // If no protocol and doesn't start with www., assume https://
          normalizedUrl = `https://${normalizedUrl}`;
        }
        return `<a href="${normalizedUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      })
      // Handle plain URLs - convert to clickable links
      // Matches http://, https://, ftp://, www. URLs that are NOT already in HTML tags
      .replace(
        /(^|[^"'=])(https?:\/\/|ftp:\/\/|www\.)([^\s<>"']+)/gi,
        (match, prefix, protocol, rest) => {
          // Check if this URL is inside an HTML tag attribute (simple heuristic)
          // If prefix is part of an attribute like href=" or src=", skip it
          if (prefix.match(/[="]/)) {
            return match; // Return original match unchanged
          }
          // Remove trailing slash from rest
          const cleanRest = rest.replace(/\/$/, '');
          const fullUrl =
            protocol.toLowerCase() === 'www.'
              ? `https://www.${cleanRest}`
              : protocol + cleanRest;
          return `${prefix}<a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${protocol}${cleanRest}</a>`;
        }
      )
      // Handle bold text (**text**)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Handle italic text (*text*)
      .replace(/(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g, '<em>$1</em>')
      // Handle line breaks (but not within tables or code blocks)
      .replace(/\n(?![^<]*<\/table>)(?![^<]*<\/code>)(?![^<]*<\/pre>)/g, '<br>')
  );
}

/**
 * Sanitize HTML content for security
 * @param html - HTML content to sanitize
 * @returns Sanitized HTML content
 */
export function sanitizeHtml(html: string): string {
  // Configure DOMPurify to allow anchor tags with necessary attributes and table elements
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'strong',
      'em',
      'br',
      'a',
      'p',
      'code',
      'pre',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}

/**
 * Check if content contains potentially dangerous HTML
 * @param content - Content to check
 * @returns true if content is safe, false if potentially dangerous
 */
export function isContentSafe(content: string): boolean {
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'strong',
      'em',
      'br',
      'a',
      'p',
      'code',
      'pre',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
  return DOMPurify.removed.length === 0;
}
