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

    this.chunks += chunk;

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

    if (DOMPurify.removed.length > 0) {
      console.warn(
        'Insecure content detected, stopping rendering:',
        DOMPurify.removed
      );
      this.isInsecure = true;
      parser_end(this.parser);
      return false;
    }

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
  let result = text;

  const tableRegex = /^(\|.+\|)\s*\n(\|[-:\s|]+\|)\s*\n((?:\|.+\|\s*\n?)+)/gm;

  result = result.replace(
    tableRegex,
    (match, headerRow, separatorRow, bodyRows) => {
      const headers = headerRow
        .split('|')
        .slice(1, -1)
        .map((h: string) => h.trim());

      const rows = bodyRows
        .trim()
        .split('\n')
        .map((row: string) =>
          row
            .split('|')
            .slice(1, -1)
            .map((cell: string) => cell.trim())
        );

      let tableHtml = '<table>';

      tableHtml += '<thead><tr>';
      headers.forEach((header: string) => {
        tableHtml += `<th>${header}</th>`;
      });
      tableHtml += '</tr></thead>';

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

  result = result.replace(/^(\d+\.\s+.+(?:\n\d+\.\s+.+)*)/gm, (match) => {
    const items = match
      .split('\n')
      .map((line) => line.replace(/^\d+\.\s+/, '').trim())
      .filter((item) => item.length > 0);
    const listItems = items.map((item) => `<li>${item}</li>`).join('');
    return `<ol>${listItems}</ol>`;
  });

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
      .replace(
        /```(\w+)?\s*\r?\n([\s\S]*?)\r?\n?```/g,
        (match, language, code) => {
          let cleanCode = code
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g, '$1')
            .replace(/^#{1,6}\s+/gm, '')
            .replace(/^[-*_]{3,}\s*$/gm, '')
            .replace(/^[\s]*[-*+]\s+/gm, '')
            .replace(/^[\s]*\d+\.\s+/gm, '');

          const escapedCode = cleanCode
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
          return `<pre><code>${escapedCode}</code></pre>`;
        }
      )
      .replace(/(?<!`)`(?!``)([^`\n]+)`(?!`)/g, (match, code) => {
        const escapedCode = code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
        return `<code>${escapedCode}</code>`;
      })
      .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
      .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
      .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
      .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        let normalizedUrl = url.trim().replace(/\/$/, '');
        if (normalizedUrl.startsWith('www.')) {
          normalizedUrl = `https://${normalizedUrl}`;
        } else if (!/^(https?|ftp):\/\//i.test(normalizedUrl)) {
          normalizedUrl = `https://${normalizedUrl}`;
        }
        return `<a href="${normalizedUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      })
      .replace(
        /(^|[^"'=])(https?:\/\/|ftp:\/\/|www\.)([^\s<>"']+)/gi,
        (match, prefix, protocol, rest) => {
          if (prefix.match(/[="]/)) {
            return match;
          }
          const cleanRest = rest.replace(/\/$/, '');
          const fullUrl =
            protocol.toLowerCase() === 'www.'
              ? `https://www.${cleanRest}`
              : protocol + cleanRest;
          return `${prefix}<a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${protocol}${cleanRest}</a>`;
        }
      )
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g, '<em>$1</em>')
      .replace(/^(>.*(?:\n>.*)*)/gm, (match) => {
        const lines = match.split('\n');
        const blockquoteContent = lines
          .map(line => line.replace(/^>\s?/, '').trim())
          .filter(line => line.length > 0)
          .join('<br>');
        return blockquoteContent ? `<blockquote>${blockquoteContent}</blockquote>` : '';
      })
      .replace(/\n(?![^<]*<\/table>)(?![^<]*<\/code>)(?![^<]*<\/pre>)(?![^<]*<\/blockquote>)(?![^<]*<\/h6>)/g, '<br>')
      .replace(/<\/h6><br><blockquote>/g, '</h6><blockquote>')
  );
}

/**
 * Sanitize HTML content for security
 * @param html - HTML content to sanitize
 * @returns Sanitized HTML content
 */
export function sanitizeHtml(html: string): string {
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
 * Check if content is safe
 * @param content - Content to check
 * @returns true if content is safe, false if not
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
