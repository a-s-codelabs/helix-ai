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
    const sanitized = DOMPurify.sanitize(this.chunks);

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
 * Handles bold (**text**), italic (*text*), and line breaks
 */
export function formatBasicMarkdown(text: string): string {
  return (
    text
      // Handle bold text (**text**)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Handle italic text (*text*)
      .replace(/(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g, '<em>$1</em>')
      // Handle line breaks
      .replace(/\n/g, '<br>')
  );
}

/**
 * Sanitize HTML content for security
 * @param html - HTML content to sanitize
 * @returns Sanitized HTML content
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html);
}

/**
 * Check if content contains potentially dangerous HTML
 * @param content - Content to check
 * @returns true if content is safe, false if potentially dangerous
 */
export function isContentSafe(content: string): boolean {
  const sanitized = DOMPurify.sanitize(content);
  return DOMPurify.removed.length === 0;
}
