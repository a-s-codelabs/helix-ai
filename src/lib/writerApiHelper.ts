/**
 * Writer API Helper
 * Provides utilities for using Chrome's built-in Writer API
 */

export type WriterTone = 'formal' | 'neutral' | 'casual';
export type WriterFormat = 'markdown' | 'plain-text';
export type WriterLength = 'short' | 'medium' | 'long';

export type RewriterTone = 'as-is' | 'more-formal' | 'more-casual';
export type RewriterFormat = 'as-is' | 'markdown' | 'plain-text';
export type RewriterLength = 'as-is' | 'shorter' | 'longer';

/**
 * Writer API Options
 *
 * @example
 * ```typescript
 * const options: WriterOptions = {
 *   tone: 'neutral',
 *   format: 'markdown',
 *   length: 'short',
 *   sharedContext: "I'm a long-standing customer.",
 *   outputLanguage: "es",
 *   expectedInputLanguages: ["en", "ja", "es"],
 *   expectedContextLanguages: ["en", "ja", "es"]
 * };
 * ```
 */
export interface WriterOptions {
  /** The tone of the writing. @default 'neutral' */
  tone?: WriterTone;
  /** The output format. @default 'plain-text' */
  format?: WriterFormat;
  /** The length of the output. @default 'medium' */
  length?: WriterLength;
  /** Shared context for the writing session */
  sharedContext?: string;
  /** Output language (BCP 47 language tag). @example "es", "en-US", "fr-FR" */
  outputLanguage?: string;
  /** Expected input languages (BCP 47 language tags). @example ["en", "ja", "es"] */
  expectedInputLanguages?: string[];
  /** Expected context languages (BCP 47 language tags). @example ["en", "ja", "es"] */
  expectedContextLanguages?: string[];
}

export interface WriteRequest {
  prompt: string;
  context?: string;
}

/**
 * Rewriter API Options
 */
export interface RewriterOptions {
  /** The tone of the rewriting. @default 'as-is' */
  tone?: RewriterTone;
  /** The output format. @default 'as-is' */
  format?: RewriterFormat;
  /** The length of the output. @default 'as-is' */
  length?: RewriterLength;
  /** Shared context for the rewriting session */
  sharedContext?: string;
  /** Output language (BCP 47 language tag). @example "es", "en-US", "fr-FR" */
  outputLanguage?: string;
  /** Expected input languages (BCP 47 language tags). @example ["en", "ja", "es"] */
  expectedInputLanguages?: string[];
  /** Expected context languages (BCP 47 language tags). @example ["en", "ja", "es"] */
  expectedContextLanguages?: string[];
}

export interface RewriteRequest {
  text: string;
  context?: string;
}

/**
 * Check if Writer API is available
 */
export async function checkWriterAvailability(): Promise<
  'available' | 'after-download' | 'unavailable'
> {
  try {
    // Check if Writer API exists in the global scope
    if (!('Writer' in self)) {
      console.log('[Writer API] Writer not found in global scope');
      return 'unavailable';
    }

    const availability = await Writer.availability();
    console.log('[Writer API] Availability:', availability);
    return availability;
  } catch (error) {
    console.error('[Writer API] Error checking availability:', error);
    return 'unavailable';
  }
}

/**
 * Create a Writer session
 */
export async function createWriter(
  options: WriterOptions = {}
): Promise<WriterInstance> {
  try {
    const writerOptions: WriterCreateOptions = {
      tone: options.tone || 'neutral',
      format: options.format || 'plain-text',
      length: options.length || 'medium',
      ...(options.sharedContext && { sharedContext: options.sharedContext }),
      ...(options.outputLanguage && { outputLanguage: options.outputLanguage }),
      ...(options.expectedInputLanguages && {
        expectedInputLanguages: options.expectedInputLanguages,
      }),
      ...(options.expectedContextLanguages && {
        expectedContextLanguages: options.expectedContextLanguages,
      }),
    };

    const writer = await Writer.create(writerOptions);
    return writer;
  } catch (error) {
    console.error('Error creating Writer:', error);
    throw error;
  }
}

/**
 * Write content using the Writer API
 */
export async function writeContent(
  request: WriteRequest,
  options: WriterOptions = {}
): Promise<string> {
  try {
    const writer = await createWriter(options);

    console.log('[Writer API] Writing with prompt:', request.prompt);
    if (request.context) {
      console.log('[Writer API] Context:', request.context);
    }

    const result = await writer.write(request.prompt, {
      ...(request.context && { context: request.context }),
    });

    console.log('[Writer API] Write complete:', {
      result,
    });

    // Clean up
    writer.destroy();
    console.log('[Writer API] Writer session destroyed');

    return result;
  } catch (error) {
    console.error('[Writer API] Error writing content:', error);
    throw error;
  }
}

/**
 * Write content with streaming support
 *
 * Note: The Writer API behavior differs between Chrome versions:
 * - Chrome Stable: Returns the full generated text in each chunk
 * - Chrome Canary: Returns only newly generated content (incremental)
 *
 * Consumers should handle both cases by checking `'Writer' in self`:
 * - If true (Canary): Accumulate chunks (fullText += chunk)
 * - If false (Stable): Replace with chunk (fullText = chunk)
 */
export async function* writeContentStreaming(
  request: WriteRequest,
  options: WriterOptions = {}
): AsyncGenerator<string, void, unknown> {
  let writer: WriterInstance | null = null;
  try {
    writer = await createWriter(options);

    console.log('[Writer API] Starting streaming...');

    const stream = writer.writeStreaming(request.prompt, {
      ...(request.context && { context: request.context }),
    });

    for await (const chunk of stream) {
      console.log('[Writer API] Chunk received:', chunk);
      yield chunk;
    }

    console.log('[Writer API] Streaming complete');
  } catch (error) {
    console.error('[Writer API] Error writing content with streaming:', error);
    throw error;
  } finally {
    // Clean up
    if (writer) {
      writer.destroy();
      console.log('[Writer API] Writer session destroyed');
    }
  }
}

/**
 * Check if Rewriter API is available
 */
export async function checkRewriterAvailability(): Promise<
  'available' | 'after-download' | 'unavailable'
> {
  try {
    // Check if Rewriter API exists in the global scope
    if (!('Rewriter' in self)) {
      console.log('[Rewriter API] Rewriter not found in global scope');
      return 'unavailable';
    }

    const availability = await Rewriter.availability();
    console.log('[Rewriter API] Availability:', availability);
    return availability;
  } catch (error) {
    console.error('[Rewriter API] Error checking availability:', error);
    return 'unavailable';
  }
}

/**
 * Create a Rewriter session
 */
export async function createRewriter(
  options: RewriterOptions = {}
): Promise<RewriterInstance> {
  try {
    const rewriterOptions: RewriterCreateOptions = {
      tone: options.tone || 'as-is',
      format: options.format || 'as-is',
      length: options.length || 'as-is',
      ...(options.sharedContext && { sharedContext: options.sharedContext }),
      ...(options.outputLanguage && { outputLanguage: options.outputLanguage }),
      ...(options.expectedInputLanguages && {
        expectedInputLanguages: options.expectedInputLanguages,
      }),
      ...(options.expectedContextLanguages && {
        expectedContextLanguages: options.expectedContextLanguages,
      }),
    };

    const rewriter = await Rewriter.create(rewriterOptions);
    return rewriter;
  } catch (error) {
    console.error('Error creating Rewriter:', error);
    throw error;
  }
}

/**
 * Rewrite content using the Rewriter API
 */
export async function rewriteContent(
  request: RewriteRequest,
  options: RewriterOptions = {}
): Promise<string> {
  try {
    const rewriter = await createRewriter(options);

    console.log('[Rewriter API] Rewriting text:', request.text);
    if (request.context) {
      console.log('[Rewriter API] Context:', request.context);
    }

    const result = await rewriter.rewrite(request.text, {
      ...(request.context && { context: request.context }),
    });

    console.log('[Rewriter API] Rewrite complete:', {
      result,
    });

    // Clean up
    rewriter.destroy();
    console.log('[Rewriter API] Rewriter session destroyed');

    return result;
  } catch (error) {
    console.error('[Rewriter API] Error rewriting content:', error);
    throw error;
  }
}

/**
 * Rewrite content with streaming support
 */
export async function* rewriteContentStreaming(
  request: RewriteRequest,
  options: RewriterOptions = {}
): AsyncGenerator<string, void, unknown> {
  let rewriter: RewriterInstance | null = null;
  try {
    rewriter = await createRewriter(options);

    console.log('[Rewriter API] Starting streaming...');

    const stream = rewriter.rewriteStreaming(request.text, {
      ...(request.context && { context: request.context }),
    });

    for await (const chunk of stream) {
      console.log('[Rewriter API] Chunk received:', chunk);
      yield chunk;
    }

    console.log('[Rewriter API] Streaming complete');
  } catch (error) {
    console.error(
      '[Rewriter API] Error rewriting content with streaming:',
      error
    );
    throw error;
  } finally {
    // Clean up
    if (rewriter) {
      rewriter.destroy();
      console.log('[Rewriter API] Rewriter session destroyed');
    }
  }
}
