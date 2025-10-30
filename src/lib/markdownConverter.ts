const config = {
  removeSelectors: [
    'script',
    'style',
    'noscript',
    'meta',
    'link[rel="stylesheet"]',
    '.ads',
    '.advertisement',
    '.banner',
    '.sidebar',
    '.footer',
    '.social-share',
    '.comments',
    '.related-posts',
    '.navigation',
    '[class*="ad-"]',
    '[id*="ad-"]',
    '.cookie-notice',
    '.popup',
  ],
  preserveSelectors: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'blockquote',
    'ul',
    'ol',
    'li',
    'table',
    'tr',
    'td',
    'th',
    'code',
    'pre',
    'strong',
    'em',
    'a',
    'img',
  ],
  maxLength: 50_000,
};


function cleanHTML(html: string): string {
  let processedHTML = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\\n/g, '<br>')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '<br>')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '')
    .replace(/\._[a-zA-Z0-9_-]+__[a-zA-Z0-9_-]+\s*\{[^}]*\}/g, '')
    .replace(/@media[^{]*\{[^{}]*\{[^}]*\}[^}]*\}/g, '')
    .replace(/@supports[^{]*\{[^{}]*\{[^}]*\}[^}]*\}/g, '')
    .replace(/@keyframes[^{]*\{[^}]*\}/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*$/g, '')
    .replace(/^[^<]*>/g, '');

  const parser = new DOMParser();
  const doc = parser.parseFromString(processedHTML, 'text/html');

  config.removeSelectors.forEach((selector) => {
    const elements = doc.querySelectorAll(selector);
    elements.forEach((el) => el.remove());
  });

  const allElements = doc.querySelectorAll('*');
  allElements.forEach((el) => {
    el.removeAttribute('style');
    el.removeAttribute('class');
    const allowedAttrs = ['href', 'src', 'alt', 'title'];
    Array.from(el.attributes).forEach((attr) => {
      if (!allowedAttrs.includes(attr.name)) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
}

function processTextForLLM(text: string): string {
  return (
    text
      .replace(/\\n/g, '<br>')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '<br>')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\')
      .replace(/\._[a-zA-Z0-9_-]+__[a-zA-Z0-9_-]+\s*\{[^}]*\}/g, '')
      .replace(/@media[^{]*\{[^{}]*\{[^}]*\}[^}]*\}/g, '')
      .replace(/@supports[^{]*\{[^{}]*\{[^}]*\}[^}]*\}/g, '')
      .replace(/@keyframes[^{]*\{[^}]*\}/g, '')
      .replace(/@import[^;]*;/g, '')
      .replace(/@font-face[^{]*\{[^}]*\}/g, '')
      .replace(/^[.#][a-zA-Z0-9_-]+\s*\{[^}]*\}/gm, '')
      .replace(/^[a-zA-Z0-9_-]+\s*\{[^}]*\}/gm, '')
      .replace(/\[\[\[.*?\]\]\]/g, '')
      .replace(/\[\[.*?\]\]/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/Was this helpful\?/g, '')
      .replace(/Last updated.*?UTC\./g, '')
      .replace(/Except as otherwise noted.*?Site Policies\./g, '')
      .replace(/Java is a registered trademark.*?affiliates\./g, '')
      .replace(/### Contribute.*?### Follow.*?### Related content.*?/gs, '')
      .replace(/File a bug.*?See open issues.*?/g, '')
      .replace(/Chromium updates.*?Podcasts & shows.*?/g, '')
      .replace(/@ChromiumDev.*?RSS.*?/g, '')
      .replace(/Terms.*?Privacy.*?Manage cookies.*?/g, '')
      .replace(/English.*?한국어.*?/g, '')
      .replace(/^[a-zA-Z-]+\s*:\s*[^;]+;?\s*$/gm, '')
      .replace(/\s+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\s+\n/g, '\n')
      .trim()
  );
}

function htmlToMarkdown(html: string): string {
  let markdown = html;

  const cleanedHTML = cleanHTML(html);

  markdown = cleanedHTML
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(
      /<img[^>]*src="([^"]*)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi,
      (match, src, alt) => {
        return alt ? `![${alt}](${src})` : `![](${src})`;
      }
    )
    .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (match, content) => {
      const cleanContent = content.replace(/<[^>]*>/g, '').trim();
      return '> ' + cleanContent.split('\n').join('\n> ') + '\n\n';
    })
    .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
      const items = content.match(/<li[^>]*>(.*?)<\/li>/gis) || [];
      return (
        items
          .map((item: string) => {
            const text = item
              .replace(/<li[^>]*>(.*?)<\/li>/i, '$1')
              .replace(/<[^>]*>/g, '')
              .trim();
            return '- ' + text;
          })
          .join('\n') + '\n\n'
      );
    })
    .replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
      const items = content.match(/<li[^>]*>(.*?)<\/li>/gis) || [];
      return (
        items
          .map((item: string, index: number) => {
            const text = item
              .replace(/<li[^>]*>(.*?)<\/li>/i, '$1')
              .replace(/<[^>]*>/g, '')
              .trim();
            return `${index + 1}. ${text}`;
          })
          .join('\n') + '\n\n'
      );
    })

    .replace(/<table[^>]*>(.*?)<\/table>/gis, (match, content) => {
      const rows = content.match(/<tr[^>]*>(.*?)<\/tr>/gis) || [];
      if (rows.length === 0) return '';

      const tableRows = rows.map((row: string) => {
        const cells = row.match(/<(?:th|td)[^>]*>(.*?)<\/(?:th|td)>/gis) || [];
        return (
          '| ' +
          cells
            .map((cell: string) => {
              return cell
                .replace(/<(?:th|td)[^>]*>(.*?)<\/(?:th|td)>/i, '$1')
                .replace(/<[^>]*>/g, '')
                .trim();
            })
            .join(' | ') +
          ' |'
        );
      });

      if (tableRows.length > 0) {
        const headerSeparator =
          '|' + ' --- |'.repeat(tableRows[0].split('|').length - 2);
        tableRows.splice(1, 0, headerSeparator);
      }

      return tableRows.join('\n') + '\n\n';
    })
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\._[a-zA-Z0-9_-]+__[a-zA-Z0-9_-]+\s*\{[^}]*\}/g, '')
    .replace(/@media[^{]*\{[^{}]*\{[^}]*\}[^}]*\}/g, '')
    .replace(/@supports[^{]*\{[^{}]*\{[^}]*\}[^}]*\}/g, '')
    .replace(/@keyframes[^{]*\{[^}]*\}/g, '')
    .replace(/^[.#][a-zA-Z0-9_-]+\s*\{[^}]*\}/gm, '')
    .replace(/^[a-zA-Z-]+\s*:\s*[^;]+;?\s*$/gm, '')
    .replace(/\\/g, '')
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\s+\n/g, '\n')
    .trim();

  return processTextForLLM(markdown);
}

export function convertPageToMarkdown(): string {
  try {
    const html = document.documentElement.outerHTML;

    const markdown = htmlToMarkdown(html);

    const finalMarkdown =
      markdown.length > config.maxLength
        ? markdown.substring(0, config.maxLength) +
          '\n\n... [Content truncated for LLM processing]'
        : markdown;

    const metadata = `# ${document.title || 'Web Page'}

**URL:** ${window.location.href}
**Converted2:** ${new Date().toISOString()}
**Content Length:** ${finalMarkdown.length} characters

---

`;

    return metadata + finalMarkdown;
  } catch (error) {
    console.error('Error converting page to markdown:', error);
    return `# ${document.title || 'Web Page'}

**URL:** ${window.location.href}
**Error:** Failed to convert to markdown, using fallback text extraction

---

${document.body.textContent || 'No content available'}`;
  }
}

export function convertElementToMarkdown(selector: string): string | null {
  try {
    const element = document.querySelector(selector);
    if (!element) {
      console.error(`Element not found: ${selector}`);
      return null;
    }

    const markdown = htmlToMarkdown(element.outerHTML);
    return markdown;
  } catch (error) {
    console.error('Error converting element to markdown:', error);
    return null;
  }
}
