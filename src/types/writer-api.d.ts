/**
 * Type definitions for Chrome's built-in Writer API
 * @see https://developer.chrome.com/docs/ai/writer-api
 * @see https://github.com/GoogleChromeLabs/web-ai-demos/blob/main/writer-rewriter-api-playground/script.js
 */

declare global {
  /**
   * Chrome's built-in Writer API
   * Available as a global class in supported browsers
   */
  interface WriterConstructor {
    /**
     * Check if the Writer API is available
     * @returns 'available', 'after-download', or 'unavailable'
     */
    availability(): Promise<'available' | 'after-download' | 'unavailable'>;

    /**
     * Create a new writer session
     * @param options Configuration options for the writer
     */
    create(options?: WriterCreateOptions): Promise<WriterInstance>;
  }

  const Writer: WriterConstructor;

  /**
   * Chrome's built-in Rewriter API
   * Available as a global class in supported browsers
   */
  interface RewriterConstructor {
    /**
     * Check if the Rewriter API is available
     * @returns 'available', 'after-download', or 'unavailable'
     */
    availability(): Promise<'available' | 'after-download' | 'unavailable'>;

    /**
     * Create a new rewriter session
     * @param options Configuration options for the rewriter
     */
    create(options?: RewriterCreateOptions): Promise<RewriterInstance>;
  }

  const Rewriter: RewriterConstructor;

  interface WriterCreateOptions {
    /**
     * The tone of the writing
     * @default 'neutral'
     */
    tone?: 'formal' | 'neutral' | 'casual';

    /**
     * The output format
     * @default 'markdown'
     */
    format?: 'markdown' | 'plain-text';

    /**
     * The length of the output
     * @default 'medium'
     */
    length?: 'short' | 'medium' | 'long';

    /**
     * Shared context for multiple writes
     */
    sharedContext?: string;

    /**
     * Expected input languages (BCP 47 language tags)
     */
    expectedInputLanguages?: string[];

    /**
     * Expected context languages (BCP 47 language tags)
     */
    expectedContextLanguages?: string[];

    /**
     * Output language (BCP 47 language tag)
     */
    outputLanguage?: string;

    /**
     * Abort signal to cancel the operation
     */
    signal?: AbortSignal;

    /**
     * Monitor for download progress
     */
    monitor?: (monitor: DownloadMonitor) => void;
  }

  interface RewriterCreateOptions {
    /**
     * The tone of the rewriting
     * @default 'as-is'
     */
    tone?: 'as-is' | 'more-formal' | 'more-casual';

    /**
     * The output format
     * @default 'as-is'
     */
    format?: 'as-is' | 'markdown' | 'plain-text';

    /**
     * The length of the output
     * @default 'as-is'
     */
    length?: 'as-is' | 'shorter' | 'longer';

    /**
     * Shared context for multiple rewrites
     */
    sharedContext?: string;

    /**
     * Expected input languages (BCP 47 language tags)
     */
    expectedInputLanguages?: string[];

    /**
     * Expected context languages (BCP 47 language tags)
     */
    expectedContextLanguages?: string[];

    /**
     * Output language (BCP 47 language tag)
     */
    outputLanguage?: string;

    /**
     * Abort signal to cancel the operation
     */
    signal?: AbortSignal;

    /**
     * Monitor for download progress
     */
    monitor?: (monitor: DownloadMonitor) => void;
  }

  interface WriteOptions {
    /**
     * Context for this specific write operation
     */
    context?: string;

    /**
     * Abort signal to cancel the operation
     */
    signal?: AbortSignal;
  }

  interface WriterInstance {
    /**
     * Write content based on a prompt
     * @param prompt The writing prompt
     * @param options Additional options
     * @returns The generated text
     */
    write(prompt: string, options?: WriteOptions): Promise<string>;

    /**
     * Write content with streaming
     * @param prompt The writing prompt
     * @param options Additional options
     * @returns An async iterable of text chunks
     */
    writeStreaming(
      prompt: string,
      options?: WriteOptions
    ): AsyncIterable<string>;

    /**
     * Destroy the writer session and free resources
     */
    destroy(): void;
  }

  interface RewriterInstance {
    /**
     * Rewrite content
     * @param text The text to rewrite
     * @param options Additional options
     * @returns The rewritten text
     */
    rewrite(text: string, options?: WriteOptions): Promise<string>;

    /**
     * Rewrite content with streaming
     * @param text The text to rewrite
     * @param options Additional options
     * @returns An async iterable of text chunks
     */
    rewriteStreaming(
      text: string,
      options?: WriteOptions
    ): AsyncIterable<string>;

    /**
     * Destroy the rewriter session and free resources
     */
    destroy(): void;
  }

  interface DownloadMonitor extends EventTarget {
    addEventListener(
      type: 'downloadprogress',
      listener: (event: DownloadProgressEvent) => void
    ): void;
  }

  interface DownloadProgressEvent extends Event {
    /**
     * Progress as a decimal (0.0 to 1.0)
     */
    loaded: number;
  }
}

export {};
