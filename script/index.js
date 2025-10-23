// HTML to Markdown Converter for LLM consumption
// Copy and paste this entire script into browser console

(function () {
  'use strict';

  // Configuration for LLM-optimized markdown
  const config = {
    // Remove elements that don't add semantic value
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
    // Preserve important semantic elements
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
    // Maximum content length for LLM processing
    maxLength: 50000,
  };

  // Clean HTML for LLM consumption
  function cleanHTML(html) {
    // Pre-process HTML to handle common issues
    let processedHTML = html
      // Fix common HTML issues
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      // Handle escaped characters - convert to br tags
      .replace(/\\n/g, '<br>')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '<br>')
      // Remove script content completely
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Remove style content completely
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Clean up malformed tags
      .replace(/<[^>]*$/g, '')
      .replace(/^[^<]*>/g, '');

    const parser = new DOMParser();
    const doc = parser.parseFromString(processedHTML, 'text/html');

    // Remove unwanted elements
    config.removeSelectors.forEach((selector) => {
      const elements = doc.querySelectorAll(selector);
      elements.forEach((el) => el.remove());
    });

    // Clean up attributes but keep essential ones
    const allElements = doc.querySelectorAll('*');
    allElements.forEach((el) => {
      // Keep only essential attributes
      const allowedAttrs = ['href', 'src', 'alt', 'title'];
      Array.from(el.attributes).forEach((attr) => {
        if (!allowedAttrs.includes(attr.name)) {
          el.removeAttribute(attr.name);
        }
      });
    });

    return doc.body.innerHTML;
  }

  // Additional text processing for better LLM consumption
  function processTextForLLM(text) {
    return (
      text
        // Handle escaped newlines and special characters - convert to br tags
        .replace(/\\n/g, '<br>')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '<br>')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\')
        // Clean up malformed JSON-like structures
        .replace(/\[\[\[.*?\]\]\]/g, '')
        .replace(/\[\[.*?\]\]/g, '')
        .replace(/\[.*?\]/g, '')
        // Remove feedback buttons and UI elements
        .replace(/Was this helpful\?/g, '')
        .replace(/Last updated.*?UTC\./g, '')
        .replace(/Except as otherwise noted.*?Site Policies\./g, '')
        .replace(/Java is a registered trademark.*?affiliates\./g, '')
        // Clean up navigation and footer content
        .replace(/### Contribute.*?### Follow.*?### Related content.*?/gs, '')
        .replace(/File a bug.*?See open issues.*?/g, '')
        .replace(/Chromium updates.*?Podcasts & shows.*?/g, '')
        .replace(/@ChromiumDev.*?RSS.*?/g, '')
        .replace(/Terms.*?Privacy.*?Manage cookies.*?/g, '')
        .replace(/English.*?한국어.*?/g, '')
        // Remove excessive whitespace
        .replace(/\s+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .replace(/\s+\n/g, '\n')
        .trim()
    );
  }

  // Convert HTML to markdown
  function htmlToMarkdown(html) {
    let markdown = html;

    // Clean the HTML first
    const cleanedHTML = cleanHTML(html);

    // Convert HTML elements to markdown
    markdown = cleanedHTML
      // Headers
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')

      // Bold and italic
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')

      // Links
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')

      // Images
      .replace(
        /<img[^>]*src="([^"]*)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi,
        (match, src, alt) => {
          return alt ? `![${alt}](${src})` : `![](${src})`;
        }
      )

      // Code blocks
      .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```')
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')

      // Blockquotes
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (match, content) => {
        const cleanContent = content.replace(/<[^>]*>/g, '').trim();
        return '> ' + cleanContent.split('\n').join('\n> ') + '\n\n';
      })

      // Lists
      .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
        const items = content.match(/<li[^>]*>(.*?)<\/li>/gis) || [];
        return (
          items
            .map((item) => {
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
            .map((item, index) => {
              const text = item
                .replace(/<li[^>]*>(.*?)<\/li>/i, '$1')
                .replace(/<[^>]*>/g, '')
                .trim();
              return `${index + 1}. ${text}`;
            })
            .join('\n') + '\n\n'
        );
      })

      // Tables (basic conversion)
      .replace(/<table[^>]*>(.*?)<\/table>/gis, (match, content) => {
        const rows = content.match(/<tr[^>]*>(.*?)<\/tr>/gis) || [];
        if (rows.length === 0) return '';

        const tableRows = rows.map((row) => {
          const cells =
            row.match(/<(?:th|td)[^>]*>(.*?)<\/(?:th|td)>/gis) || [];
          return (
            '| ' +
            cells
              .map((cell) => {
                return cell
                  .replace(/<(?:th|td)[^>]*>(.*?)<\/(?:th|td)>/i, '$1')
                  .replace(/<[^>]*>/g, '')
                  .trim();
              })
              .join(' | ') +
            ' |'
          );
        });

        // Add header separator
        if (tableRows.length > 0) {
          const headerSeparator =
            '|' + ' --- |'.repeat(tableRows[0].split('|').length - 2);
          tableRows.splice(1, 0, headerSeparator);
        }

        return tableRows.join('\n') + '\n\n';
      })

      // Paragraphs
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')

      // Line breaks
      .replace(/<br[^>]*>/gi, '\n')
      .replace(/<\/div>/gi, '\n')

      // Remove remaining HTML tags
      .replace(/<[^>]*>/g, '')

      // Clean up whitespace and handle special cases
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/^\s+|\s+$/gm, '')
      // Handle multiple consecutive spaces
      .replace(/[ \t]+/g, ' ')
      // Clean up any remaining escaped characters
      .replace(/\\/g, '')
      // Remove any remaining HTML entities
      .replace(/&[a-zA-Z0-9#]+;/g, ' ')
      // Clean up excessive whitespace
      .replace(/\s+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\s+\n/g, '\n')
      .trim();

    // Apply additional LLM-specific text processing
    return processTextForLLM(markdown);
  }

  // Main function to convert current page
  function convertPageToMarkdown() {
    console.log('🔄 Converting page to markdown...');

    // Get the current page content
    const html = document.documentElement.outerHTML;

    // Convert to markdown
    const markdown = htmlToMarkdown(html);

    // Truncate if too long for LLM processing
    const finalMarkdown =
      markdown.length > config.maxLength
        ? markdown.substring(0, config.maxLength) +
          '\n\n... [Content truncated for LLM processing]'
        : markdown;

    // Add metadata header
    const metadata = `# ${document.title || 'Web Page'}

**URL:** ${window.location.href}
**Converted:** ${new Date().toISOString()}
**Content Length:** ${finalMarkdown.length} characters

---

`;

    const fullMarkdown = metadata + finalMarkdown;

    // Copy to clipboard
    navigator.clipboard
      .writeText(fullMarkdown)
      

    return fullMarkdown;
  }

  // Alternative function to convert specific element
  function convertElementToMarkdown(selector) {
    const element = document.querySelector(selector);
    if (!element) {
      console.error(`❌ Element not found: ${selector}`);
      return null;
    }

    console.log(`🔄 Converting element "${selector}" to markdown...`);
    const markdown = htmlToMarkdown(element.outerHTML);

    navigator.clipboard
      .writeText(markdown)
      .then(() => {
        console.log('✅ Element markdown copied to clipboard!');
      })
      .catch((err) => {
        console.error('❌ Failed to copy to clipboard:', err);
        console.log('📄 Markdown content:');
        console.log(markdown);
      });

    return markdown;
  }

  // Usage instructions
  console.log(`
🚀 HTML to Markdown Converter Ready!

Usage:
• convertPageToMarkdown() - Convert entire page
• convertElementToMarkdown('selector') - Convert specific element
  Examples: convertElementToMarkdown('main'), convertElementToMarkdown('.content')

Features:
✅ LLM-optimized formatting
✅ Removes ads and clutter
✅ Preserves semantic structure
✅ Handles tables, lists, code blocks
✅ Automatic clipboard copy
✅ Content length management

Starting conversion...
    `);

  // Auto-convert the current page
  return convertPageToMarkdown();
})();
