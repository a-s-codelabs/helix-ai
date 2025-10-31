import { globalStorage } from './globalStorage';
import { loadProviderKey } from './secureStore';
import { runProviderStream, type Provider } from './ai/providerClient';
import { buildWritePrompt, buildRewritePrompt, systemPrompt } from './chatStore/prompt';

declare const Writer: {
  availability(): Promise<'available' | 'after-download' | 'unavailable'>;
  create(options?: any): Promise<any>;
};

declare const Rewriter: {
  availability(): Promise<'available' | 'after-download' | 'unavailable'>;
  create(options?: any): Promise<any>;
};

declare const Proofreader: {
  availability(): Promise<'available' | 'after-download' | 'unavailable'>;
  create(options?: any): Promise<any>;
};

async function resolveProviderConfig(intent: 'write' | 'rewrite', pageContext?: string): Promise<{ provider: 'builtin' | Provider; model?: string; apiKey?: string; pageContext?: string }> {
  const store = globalStorage();
  const config = (await store.get('config')) || {} as any;
  const settings = (await store.get('telescopeSettings')) || {} as Record<string, Record<string, string | number>>;
  const intentSettings = settings[intent] || {};
  const provider = (intentSettings.aiPlatform as any) || config.aiProvider || 'builtin';
  const model = (intentSettings.aiModel as any) || config.aiModel || undefined;
  if (provider === 'builtin') return { provider: 'builtin', pageContext };
  const apiKey = await loadProviderKey(provider as Provider);
  return { provider: provider as Provider, model, apiKey: apiKey || undefined, pageContext };
}

export type WriterTone = 'formal' | 'neutral' | 'casual';
export type WriterFormat = 'markdown' | 'plain-text';
export type WriterLength = 'short' | 'medium' | 'long';

export type RewriterTone = 'as-is' | 'more-formal' | 'more-casual';
export type RewriterFormat = 'as-is' | 'markdown' | 'plain-text';
export type RewriterLength = 'as-is' | 'shorter' | 'longer';

export interface ProofreaderOptions {
  /** Expected input languages (BCP 47 language tags). @example ["en", "ja", "es"] */
  expectedInputLanguages?: string[];
}

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

export interface ProofreaderRequest {
  text: string;
}

export async function checkWriterAvailability(): Promise<
  'available' | 'after-download' | 'unavailable'
> {
  try {
    if (!('Writer' in self)) {
      console.warn('[Writer API] Writer not found in global scope');
      return 'unavailable';
    }

    const availability = await Writer.availability();
    console.warn('[Writer API] Availability:', availability);
    return availability;
  } catch (error) {
    console.error('[Writer API] Error checking availability:', error);
    return 'unavailable';
  }
}

export async function createWriter(options: WriterOptions = {}): Promise<any> {
  try {
    const writerOptions: any = {
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

export async function writeContent(
  request: WriteRequest,
  options: WriterOptions = {}
): Promise<string> {
  try {
    const { provider, model, apiKey, pageContext } = await resolveProviderConfig('write', options.sharedContext);

    if (provider === 'builtin') {
      const writer = await createWriter(options);
      const result = await writer.write(request.prompt, {
        ...(request.context && { context: request.context }),
      });

      writer.destroy();
      return result;
    } else {
      if (!apiKey || !model) {
        throw new Error('Missing API key or model for selected provider');
      }

      const prompt = buildWritePrompt({
        text: request.prompt,
        tone: options.tone || 'neutral',
        format: options.format || 'plain-text',
        length: options.length || 'medium',
        outputLanguage: options.outputLanguage,
        pageContext: pageContext || options.sharedContext,
      });

      const sys = pageContext ? systemPrompt({ pageContext }) : undefined;
      const { stream } = await runProviderStream({ provider, model, apiKey }, {
        system: sys,
        messages: [{ role: 'user', content: prompt }]
      });

      let text = '';
      for await (const chunk of stream as any) {
        text += chunk;
      }

      return text.trim();
    }
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
  let isBuiltin = false;
  try {
    const { provider, model, apiKey, pageContext } = await resolveProviderConfig('write', options.sharedContext);
    isBuiltin = provider === 'builtin';

    if (provider === 'builtin') {
      writer = await createWriter(options);

      if (!writer) {
        throw new Error('Failed to create Writer session');
      }

      const stream = writer.writeStreaming(request.prompt, {
        ...(request.context && { context: request.context }),
      });

      for await (const chunk of stream) {
        yield chunk;
      }

    } else {
      if (!apiKey || !model) {
        throw new Error('Missing API key or model for selected provider');
      }

      const prompt = buildWritePrompt({
        text: request.prompt,
        tone: options.tone || 'neutral',
        format: options.format || 'plain-text',
        length: options.length || 'medium',
        outputLanguage: options.outputLanguage,
        pageContext: pageContext || options.sharedContext,
      });

      const sys = pageContext ? systemPrompt({ pageContext }) : undefined;
      const { stream } = await runProviderStream({ provider, model, apiKey }, {
        system: sys,
        messages: [{ role: 'user', content: prompt }]
      });

      for await (const chunk of stream as any) {
        if (chunk && typeof chunk === 'string') {
          yield chunk;
        }
      }
    }
  } catch (error) {
    console.error('[Writer API] Error writing content with streaming:', error);
    throw error;
  } finally {
    if (writer && isBuiltin) {
      writer.destroy();
    }
  }
}

export async function checkRewriterAvailability(): Promise<
  'available' | 'after-download' | 'unavailable'
> {
  try {
    if (!('Rewriter' in self)) {
      console.warn('[Rewriter API] Rewriter not found in global scope');
      return 'unavailable';
    }

    const availability = await Rewriter.availability();
    console.warn('[Rewriter API] Availability:', availability);
    return availability;
  } catch (error) {
    console.error('[Rewriter API] Error checking availability:', error);
    return 'unavailable';
  }
}

export async function createRewriter(
  options: RewriterOptions = {}
): Promise<any> {
  try {
    const rewriterOptions: any = {
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

export async function rewriteContent(
  request: RewriteRequest,
  options: RewriterOptions = {}
): Promise<string> {
  try {
    const { provider, model, apiKey, pageContext } = await resolveProviderConfig('rewrite', options.sharedContext);

    if (provider === 'builtin') {
      const rewriter = await createRewriter(options);

      const result = await rewriter.rewrite(request.text, {
        ...(request.context && { context: request.context }),
      });

      rewriter.destroy();
      return result;
    } else {
      if (!apiKey || !model) {
        throw new Error('Missing API key or model for selected provider');
      }

      const prompt = buildRewritePrompt({
        text: request.text,
        tone: options.tone || 'as-is',
        format: options.format || 'as-is',
        length: options.length || 'as-is',
        outputLanguage: options.outputLanguage,
      });

      const sys = pageContext ? systemPrompt({ pageContext }) : undefined;
      const { stream } = await runProviderStream({ provider, model, apiKey }, {
        system: sys,
        messages: [{ role: 'user', content: prompt }]
      });

      let text = '';
      for await (const chunk of stream as any) {
        text += chunk;
      }

      return text.trim();
    }
  } catch (error) {
    console.error('[Rewriter API] Error rewriting content:', error);
    throw error;
  }
}

export async function* rewriteContentStreaming(
  request: RewriteRequest,
  options: RewriterOptions = {}
): AsyncGenerator<string, void, unknown> {
  let rewriter: RewriterInstance | null = null;
  let isBuiltin = false;
  try {
    const { provider, model, apiKey, pageContext } = await resolveProviderConfig('rewrite', options.sharedContext);
    isBuiltin = provider === 'builtin';

    if (provider === 'builtin') {
      rewriter = await createRewriter(options);

      if (!rewriter) {
        throw new Error('Failed to create Rewriter session');
      }

      const stream = rewriter.rewriteStreaming(request.text, {
        ...(request.context && { context: request.context }),
      });

      for await (const chunk of stream) {
        yield chunk;
      }

    } else {
      if (!apiKey || !model) {
        throw new Error('Missing API key or model for selected provider');
      }

      const prompt = buildRewritePrompt({
        text: request.text,
        tone: options.tone || 'as-is',
        format: options.format || 'as-is',
        length: options.length || 'as-is',
        outputLanguage: options.outputLanguage,
      });

      const sys = pageContext ? systemPrompt({ pageContext }) : undefined;
      const { stream } = await runProviderStream({ provider, model, apiKey }, {
        system: sys,
        messages: [{ role: 'user', content: prompt }]
      });

      for await (const chunk of stream as any) {
        if (chunk && typeof chunk === 'string') {
          yield chunk;
        }
      }

    }
  } catch (error) {
    console.error(
      '[Rewriter API] Error rewriting content with streaming:',
      error
    );
    throw error;
  } finally {
    if (rewriter && isBuiltin) {
      rewriter.destroy();
    }
  }
}

export async function checkProofreaderAvailability(): Promise<
  'available' | 'after-download' | 'unavailable'
> {
  try {
    if (!('Proofreader' in self)) {
      console.warn('[Proofreader API] Proofreader not found in global scope');
      return 'unavailable';
    }

    const availability = await Proofreader.availability();
    console.warn('[Proofreader API] Availability:', availability);
    return availability;
  } catch (error) {
    console.error('[Proofreader API] Error checking availability:', error);
    return 'unavailable';
  }
}

export async function createProofreader(
  options: ProofreaderOptions = {}
): Promise<any> {
  try {
    const proofreaderOptions: any = {
      ...(options.expectedInputLanguages && {
        expectedInputLanguages: options.expectedInputLanguages,
      }),
    };

    const proofreader = await Proofreader.create(proofreaderOptions);
    return proofreader;
  } catch (error) {
    console.error('Error creating Proofreader:', error);
    throw error;
  }
}

export async function proofreadContent(
  request: ProofreaderRequest,
  options: ProofreaderOptions = {}
): Promise<any> {
  try {
    const proofreader = await createProofreader(options);

    const result = await proofreader.proofread(request.text);

    proofreader.destroy();
    return result;
  } catch (error) {
    console.error('[Proofreader API] Error proofreading content:', error);
    throw error;
  }
}

export async function* proofreadContentStreaming(
  request: ProofreaderRequest,
  options: ProofreaderOptions = {}
): AsyncGenerator<string, void, unknown> {
  let proofreader: any = null;
  try {
    proofreader = await createProofreader(options);

    const result = await proofreader.proofread(request.text);

    yield result.corrected;
  } catch (error) {
    console.error(
      '[Proofreader API] Error proofreading content with streaming:',
      error
    );
    throw error;
  } finally {
    if (proofreader) {
      proofreader.destroy();
    }
  }
}
