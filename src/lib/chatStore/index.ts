import { writable } from "svelte/store";
import {
  imageStringToFile,
  ensurePngFile,
} from "../utils/file";
import { globalStorage } from "../globalStorage";
import {
  createErrorMessage,
  getErrorMessage,
  safeDestroySession,
} from "./helper";
import { extractPageContent } from "./extract-helper";
import { monitorHelperSync } from "./monitor-helper";
import { systemPrompt, buildSummarizePrompt, buildTranslatePrompt, buildWritePrompt, buildRewritePrompt } from "./prompt";
import { runProviderStream, imagePartFromDataURL, textPart, type Provider } from "../ai/providerClient";
import { loadProviderKey } from "../secureStore";
import { RewriterOptions, WriterOptions } from "../writerApiHelper";

async function processStream<T>(
  stream: ReadableStream<T>,
  abortController: AbortController,
  onChunk: (chunk: T) => void,
  timeoutMs: number = 30000,
  operationName: string = 'stream'
): Promise<void> {
  const streamTimeout = setTimeout(() => {
    console.warn(`${operationName} timeout`);
    throw new Error(`${operationName} timeout`);
  }, timeoutMs);

  let hasReceivedChunks = false;
  let chunkCount = 0;

  try {
    for await (const chunk of stream) {
      if (abortController.signal.aborted) {
        break;
      }

      clearTimeout(streamTimeout);
      hasReceivedChunks = true;
      chunkCount++;

      onChunk(chunk);
    }
  } catch (iterationError) {
    console.error(`Error during ${operationName} iteration:`, iterationError);
    if (hasReceivedChunks) {
      console.log(
        `${operationName} failed after ${chunkCount} chunks, but we have content`
      );
    } else {
      throw iterationError;
    }
  }

  clearTimeout(streamTimeout);

  if (!hasReceivedChunks) {
    console.warn(`No chunks received from ${operationName}`);
    throw new Error(`No chunks received from ${operationName}`);
  }
}

async function createAISessionWithMonitor(
  sessionType: 'summarizer' | 'languageDetector' | 'translator' | 'writer' | 'rewriter' | 'proofreader' | 'prompt',
  options: any = {},
): Promise<any> {
  console.log(`Called session with type: ${sessionType} and options: ${JSON.stringify(options, null, 4)}`);

  const monitor = (m: any) => {
    const createdAt = Date.now();
    m.addEventListener('downloadprogress', (e: any) => {
      monitorHelperSync({
        source:
          sessionType === 'summarizer'
            ? 'summarize'
            : sessionType === 'languageDetector'
              ? 'language-detector'
              : 'translator',
        loaded: e.loaded,
        createdAt,
        options: options,
      });
    });
  };

  async function checkAvailability(sourceType: 'LanguageModel' | 'Summarizer' | 'LanguageDetector' | 'Translator' | 'Writer' | 'Rewriter' | 'Proofreader') {

    try {
      if (typeof window[sourceType as keyof Window] === 'undefined') {
        throw new Error(`${sourceType} API not available`);
      }
      let availability;
      if (sourceType === 'Translator') {
        availability = await window[sourceType as keyof Window].availability({
          sourceLanguage: options.sourceLanguage,
          targetLanguage: options.targetLanguage,
        });
      }
      else {
        availability = await window[sourceType as keyof Window].availability();
      }
      if (availability === 'unavailable') {
        throw new Error();
      }
    } catch (error) {
      console.error(`Error checking availability for ${sourceType}:`, error);
      throw new Error(
        'Chrome Built-in AI not available.\n\n' +
        'Please ensure:\n' +
        '1. You are using Chrome 138+ (Dev/Canary/Beta)\n' +
        '2. Flags are enabled at chrome:flags for Built-in AI\n' +
        '3. Chrome has been fully restarted\n' +
        '4. Model is downloaded at chrome://components'
      );
    }
  }

  switch (sessionType) {
    case 'prompt':
      await checkAvailability('LanguageModel');
      return await createAISession({ ...options, monitor });
    case 'summarizer':
      await checkAvailability('Summarizer');
      return await Summarizer!.create({ ...options, monitor });

    case 'languageDetector':
      await checkAvailability('LanguageDetector');
      return await LanguageDetector!.create({ ...options, monitor });

    case 'translator':
      await checkAvailability('Translator');
      return await Translator!.create({ ...options, monitor });

    case 'writer':
      await checkAvailability('Writer');
      return await Writer!.create({ ...options, monitor });

    case 'rewriter':
      await checkAvailability('Rewriter');
      return await Rewriter!.create({ ...options, monitor });

    case 'proofreader':
      if (typeof Proofreader === 'undefined') {
        throw new Error('Proofreader API not available');
      }
      return await Proofreader!.create({ ...options, monitor });
    default:
      throw new Error(`Unknown session type: ${sessionType}`);
  }
}

function createChatMessage(
  type: 'user' | 'assistant',
  content: string,
  images?: string[]
): ChatMessage {
  return {
    id: Date.now() + (type === 'assistant' ? 1 : 0),
    type,
    content,
    images: images || [],
    timestamp: new Date(),
  };
}

function updateStreamingState(
  update: (fn: (state: ChatState) => ChatState) => void,
  assistantMsgId: number,
  abortController: AbortController,
  isStreaming: boolean = true
) {
  update((state) => ({
    ...state,
    isStreaming,
    streamingMessageId: isStreaming ? assistantMsgId : null,
    abortController: isStreaming ? abortController : null,
  }));
}

function updateMessageContent(
  update: (fn: (state: ChatState) => ChatState) => void,
  messageId: number,
  content: string,
  additionalStateUpdates: Partial<ChatState> = {}
) {
  update((state) => {
    const updatedMessages = state.messages.map((msg) => {
      if (msg.id === messageId) {
        return { ...msg, content };
      }
      return msg;
    });

    return {
      ...state,
      messages: updatedMessages,
      ...additionalStateUpdates,
    };
  });
}

function appendToStreamingMessage(
  update: (fn: (state: ChatState) => ChatState) => void,
  messageId: number,
  chunk: string
) {
  update((state) => {
    const updatedMessages = state.messages.map((msg) => {
      if (msg.id === messageId) {
        return { ...msg, content: msg.content + chunk };
      }
      return msg;
    });

    return {
      ...state,
      messages: updatedMessages,
    };
  });
}

export type ChatMessage = {
  id: number;
  type: 'user' | 'assistant';
  content: string;
  images?: string[];
  timestamp: Date;
};

/**
 * Chrome Built-in AI Type Definitions
 * Supports multiple API variants: window.ai.languageModel, Global LanguageModel, Summarizer
 * References:
 * - https://developer.chrome.com/docs/ai/built-in
 */
declare global {
  interface Window {
    ai?: AINamespace;
  }

  type AINamespace = {
    languageModel: AILanguageModelFactory;
  };

  type AILanguageModelFactory = {
    capabilities(): Promise<AICapabilities>;
    create(options?: AILanguageModelCreateOptions): Promise<AILanguageModel>;
  };

  type AICapabilities = {
    available: 'readily' | 'after-download' | 'no';
    defaultTemperature?: number;
    defaultTopK?: number;
    maxTopK?: number;
  };

  type AILanguageModelCreateOptions = {
    monitor?: (monitor: {
      addEventListener: (type: string, listener: (e: any) => void) => void;
    }) => void;
    systemPrompt?: string;
    temperature?: number;
    topK?: number;
    language?: string;
    outputLanguage?: string;
    output?: { language: string };
    initialPrompts?: { role: string; content: string }[];
    expectedInputs?: { type: string }[];
  };

  type AILanguageModel = {
    append(
      content: { role: string; content: { type: string; value: any }[] }[]
    ): Promise<void>;
    prompt(input: string): Promise<string>;
    promptStreaming(input: string): ReadableStream<string>;
    destroy(): void;
    clone?(): Promise<AILanguageModel>;
  };

  var LanguageModel:
    | {
      availability(): Promise<
        'readily' | 'available' | 'no' | 'downloadable'
      >;
      create(
        options?: AILanguageModelCreateOptions
      ): Promise<AILanguageModel>;
    }
    | undefined;

  var Summarizer:
    | {
      availability(): Promise<'readily' | 'available' | 'unavailable'>;
      create(options?: {
        sharedContext?: string;
        type?: 'key-points' | 'tldr' | 'teaser' | 'headline';
        format?: 'markdown' | 'plain-text';
        length?: 'short' | 'medium' | 'long';
        signal?: AbortSignal;
        monitor?: (monitor: {
          addEventListener: (
            type: string,
            listener: (e: any) => void
          ) => void;
        }) => void;
      }): Promise<AISummarizer>;
    }
    | undefined;

  type AISummarizer = {
    summarize(
      text: string,
      options?: { context?: string; signal?: AbortSignal }
    ): Promise<string>;
    summarizeStreaming(
      text: string,
      options?: { context?: string; signal?: AbortSignal }
    ): ReadableStream<string>;
    destroy(): void;
  };

  var LanguageDetector:
    | {
      availability(): Promise<'readily' | 'available' | 'unavailable'>;
      create(options?: {
        signal?: AbortSignal;
        monitor?: (monitor: {
          addEventListener: (
            type: string,
            listener: (e: any) => void
          ) => void;
        }) => void;
      }): Promise<AILanguageDetector>;
    }
    | undefined;

  type AILanguageDetector = {
    detect(
      text: string
    ): Promise<Array<{ detectedLanguage: string; confidence?: number }>>;
    destroy(): void;
  };

  var Translator:
    | {
      availability(options: {
        sourceLanguage: string;
        targetLanguage: string;
      }): Promise<'readily' | 'available' | 'unavailable'>;
      create(options: {
        sourceLanguage: string;
        targetLanguage: string;
        signal?: AbortSignal;
        monitor?: (monitor: {
          addEventListener: (
            type: string,
            listener: (e: any) => void
          ) => void;
        }) => void;
      }): Promise<AITranslator>;
    }
    | undefined;

  type AITranslator = {
    translate(text: string): Promise<string>;
    translateStreaming(text: string): ReadableStream<string>;
    destroy(): void;
  };
}

export type ChatState = {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  aiAvailable: boolean;
  aiStatus: string;
  isStreaming: boolean;
  streamingMessageId: number | null;
  abortController: AbortController | null;
};

async function createAISession({ pageContext, language = 'en', outputLanguage = 'en', temperature = 0.4, topK = 4 }: { pageContext: string, language?: string, outputLanguage?: string, temperature?: number, topK?: number }): Promise<AILanguageModel> {
  if (typeof LanguageModel !== 'undefined') {
    const config = {
      // TODO: Check which system prompt to use based on the user's language
      systemPrompt: systemPrompt({ pageContext }),
      language,
      outputLanguage,
      output: { language: outputLanguage },
      expectedInputs: [{ type: 'image' }, { type: 'audio' }],
      temperature,
      topK,
      initialPrompts: [
        {
          role: 'system',
          content: systemPrompt({ pageContext }),
        },
      ],
      monitor(m: any) {
        const createdAt = Date.now();
        m.addEventListener('downloadprogress', (e: any) => {
          monitorHelperSync({
            source: 'prompt',
            loaded: e.loaded,
            createdAt,
            options: {},
          });
        });
      },
    };

    return await LanguageModel.create(config);
  }

  throw new Error(
    'Chrome Built-in AI not available.\n\n' +
    'Please ensure:\n' +
    '1. You are using Chrome 138+ (Dev/Canary/Beta)\n' +
    '2. Flags are enabled at chrome:flags for Built-in AI\n' +
    '3. Chrome has been fully restarted\n' +
    '4. Model is downloaded at chrome://components'
  );
}

/**
 * Check Chrome Built-in AI availability
 */
async function checkAPIStatus(): Promise<{
  available: boolean;
  message: string;
}> {
  try {
    if (typeof window === 'undefined') {
      return {
        available: false,
        message: '❌ Not avaiable in this browser',
      };
    }

    if (typeof LanguageModel !== 'undefined') {
      try {
        const availability = await LanguageModel.availability();
        if (availability === 'readily' || availability === 'available') {
          return {
            available: true,
            message: '✅ Chrome AI is ready!',
          };
        }
        if (availability === 'downloadable') {
          return {
            available: false,
            message: '⏬ Downloading AI model...',
          };
        }
      } catch (err) {
        console.error('Global LanguageModel check failed', err);
      }
    }

    return {
      available: false,
      message:
        '❌ Chrome Built-in AI not found. Enable flags at chrome://flags',
    };
  } catch (err) {
    console.error('Error checking Chrome AI status:', err);
    return {
      available: false,
      message: '❌ Error checking API status',
    };
  }
}

function createChatStore() {
  const { subscribe, set, update } = writable<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    aiAvailable: false,
    aiStatus: 'Checking...',
    isStreaming: false,
    streamingMessageId: null,
    abortController: null,
  });

  let session: AILanguageModel | null = null;
  let pageContext = '';

  async function resolveProviderConfig(intent: 'prompt' | 'summarise' | 'translate' | 'write' | 'rewrite'): Promise<{ provider: 'builtin' | Provider; model?: string; apiKey?: string }> {
    const store = globalStorage();
    const config = (await store.get('config')) || {} as any;
    const settings = (await store.get('telescopeSettings')) || {} as Record<string, Record<string, string | number>>;
    const intentSettings = settings[intent] || {};
    const provider = (intentSettings.aiPlatform as any) || config.aiProvider || 'builtin';
    const model = (intentSettings.aiModel as any) || config.aiModel || undefined;
    if (provider === 'builtin') return { provider: 'builtin' };
    const apiKey = await loadProviderKey(provider as Provider);
    return { provider: provider as Provider, model, apiKey: apiKey || undefined };
  }

  async function shouldAttachPageContext(intent: 'prompt' | 'summarise' | 'translate' | 'write' | 'rewrite', userMessage?: string): Promise<boolean> {
    if (intent === 'summarise') return true;
    try {
      if (typeof LanguageModel !== 'undefined') {
        const lm = await LanguageModel.create();
        const schema = { type: 'boolean' } as any;
        const question = `You are determining whether the user's request for intent "${intent}" needs the current web page content. Return JSON boolean true only if the answer requires or benefits from the current page/site content. Otherwise return false.\n\nUser request:\n${(userMessage || '').slice(0, 2000)}`;
        const result = await (lm as any).prompt(question, { responseConstraint: schema });
        try { lm.destroy?.(); } catch { }
        try {
          const parsed = JSON.parse(result);
          return !!parsed;
        } catch { }
      }
    } catch { }
    const text = (userMessage || '').toLowerCase();
    const hints = ['this page', 'this site', 'the page', 'current page', 'on this page', 'summarize the page', 'summarise the page'];
    return hints.some((h) => text.includes(h));
  }

  return {
    subscribe,

    /**
     * Initialize and check AI availability
     */
    async init(providedPageContext?: string) {
      const status = await checkAPIStatus();
      update((state) => ({
        ...state,
        aiAvailable: status.available,
        aiStatus: status.message,
      }));

      const tabId = await getActiveTabId();

      if (providedPageContext) {
        pageContext = providedPageContext;
      } else {
        globalStorage().get('pageMarkdown', { whereKey: tabId.toString() });
        pageContext = await extractPageContent({ tabId });
      }
    },

    /**
     * Set page context externally (for side panel mode)
     */
    setPageContext(context: string) {
      pageContext = context;
    },

    /**
     * Send a message to the AI
     */
    async sendMessage(userMessage: string, images?: string[]) {
      if (!userMessage.trim()) return;

      const userMsg = createChatMessage('user', userMessage, images);

      update((state) => ({
        ...state,
        messages: [...state.messages, userMsg],
        isLoading: true,
        error: null,
      }));

      try {
        const { provider, model, apiKey } = await resolveProviderConfig('prompt');
        let aiResponse: string | null = null;
        if (provider === 'builtin') {
          if (!session) {
            session = await createAISession({ pageContext });
          }
          aiResponse = await session.prompt(userMessage);
        } else {
          if (!apiKey || !model) {
            throw new Error('Missing API key or model for selected provider');
          }
          const messages: any[] = [];
          const attach = await shouldAttachPageContext('prompt', userMessage);
          const sys = attach ? systemPrompt({ pageContext }) : undefined;
          if (images && images.length) {
            messages.push({ role: 'user', content: [textPart(userMessage), ...images.map((i) => imagePartFromDataURL(i))] });
          } else {
            messages.push({ role: 'user', content: userMessage });
          }
          const { stream } = await runProviderStream({ provider, model, apiKey }, { system: sys, messages });
          let text = '';
          for await (const chunk of stream as any) {
            text += chunk;
          }
          aiResponse = text;
        }

        if (!aiResponse || typeof aiResponse !== 'string') {
          throw new Error('Invalid response from AI model');
        }

        const assistantMsg = createChatMessage('assistant', aiResponse.trim());

        update((state) => ({
          ...state,
          messages: [...state.messages, assistantMsg],
          isLoading: false,
        }));
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        const errorMsg = createErrorMessage(err);

        update((state) => ({
          ...state,
          messages: [...state.messages, errorMsg],
          isLoading: false,
          error: errorMessage,
        }));

        safeDestroySession(session);
        session = null;
      }
    },

    async summarise(userMessage: string) {
      if (!userMessage.trim()) return;

      const abortController = new AbortController();
      const userMsg = createChatMessage('user', userMessage);
      const assistantMsg = createChatMessage('assistant', '');
      const assistantMsgId = assistantMsg.id;

      update((state) => ({
        ...state,
        messages: [...state.messages, userMsg, assistantMsg],
        isLoading: false,
        error: null,
        inputValue: '',
      }));

      updateStreamingState(update, assistantMsgId, abortController, true);

      let summarizer: AISummarizer | null = null;

      try {
        const { provider, model, apiKey } = await resolveProviderConfig('summarise');
        let stream: ReadableStream<string>;
        if (provider === 'builtin') {
          summarizer = await createAISessionWithMonitor(
            'summarizer',
            {
              sharedContext: userMessage,
              type: 'tldr',
              format: 'markdown',
              length: 'short',
            },
          );
          stream = summarizer!.summarizeStreaming(userMessage, {
            signal: abortController.signal,
          });
        } else {
          if (!apiKey || !model) throw new Error('Missing provider credentials');
          const prompt = buildSummarizePrompt({ text: userMessage, type: 'tldr', format: 'markdown', length: 'short', pageContext });
          const sys = systemPrompt({ pageContext });
          const result = await runProviderStream({ provider, model, apiKey }, { system: sys, messages: [{ role: 'user', content: prompt }] });
          stream = result.stream;
        }

        await processStream(
          stream,
          abortController,
          (chunk: string) => {
            if (chunk && typeof chunk === 'string') {
              appendToStreamingMessage(update, assistantMsgId, chunk);
            }
          },
          30000,
          'summarization stream'
        );

        updateStreamingState(update, assistantMsgId, abortController, false);
      } catch (err) {
        console.error('Summarization error:', err);
        const errorMessage = getErrorMessage(err);

        updateMessageContent(
          update,
          assistantMsgId,
          createErrorMessage(err).content,
          {
            isLoading: false,
            isStreaming: false,
            streamingMessageId: null,
            abortController: null,
            error: errorMessage,
          }
        );
      } finally {
        if (summarizer) {
          try {
            summarizer.destroy();
          } catch (cleanupError) {
            console.warn('Error destroying summarizer:', cleanupError);
          }
        }
      }
    },

    async translate(userMessage: string, targetLanguage: string) {
      if (!userMessage.trim()) return;
      const abortController = new AbortController();
      const userMsg = createChatMessage('user', userMessage);
      const assistantMsg = createChatMessage('assistant', '');
      const assistantMsgId = assistantMsg.id;

      update((state) => ({
        ...state,
        messages: [...state.messages, userMsg, assistantMsg],
        isLoading: false,
        error: null,
        inputValue: '',
      }));

      updateStreamingState(update, assistantMsgId, abortController, true);

      let detectedLanguage = 'en';
      let detector: AILanguageDetector | null = null;
      let translator: AITranslator | null = null;

      try {
        detector = await createAISessionWithMonitor(
          'languageDetector',
          { sourceLanguage: detectedLanguage, targetLanguage }
        );

        const detectionResults = await detector!.detect(userMessage);
        if (detectionResults && detectionResults.length > 0) {
          detectedLanguage = detectionResults[0].detectedLanguage;
        }

        detector!.destroy();
        detector = null;

        if (detectedLanguage === targetLanguage) {
          updateMessageContent(
            update,
            assistantMsgId,
            `ℹ️ The text is already in ${targetLanguage}. No translation needed.`,
            {
              isLoading: false,
              isStreaming: false,
              streamingMessageId: null,
              abortController: null,
            }
          );
          return;
        }

        const { provider, model, apiKey } = await resolveProviderConfig('translate');
        let stream: ReadableStream<string>;
        if (provider === 'builtin') {
          if (typeof Translator === 'undefined') {
            throw new Error('Translator API not available');
          }
          const translatorAvailability = await Translator.availability({
            sourceLanguage: detectedLanguage,
            targetLanguage,
          });
          if (translatorAvailability === 'unavailable') {
            throw new Error(
              `Translation from ${detectedLanguage} to ${targetLanguage} is not available. Please enable it in Chrome flags.`
            );
          }
          translator = await createAISessionWithMonitor(
            'translator',
            { sourceLanguage: detectedLanguage, targetLanguage }
          );
          stream = translator!.translateStreaming(userMessage);
        } else {
          if (!apiKey || !model) throw new Error('Missing provider credentials');
          const attach = await shouldAttachPageContext('translate', userMessage);
          const prompt = buildTranslatePrompt({ text: userMessage, sourceLanguage: detectedLanguage, targetLanguage, pageContext: attach ? pageContext : undefined });
          const result = await runProviderStream({ provider, model, apiKey }, { messages: [{ role: 'user', content: prompt }] });
          stream = result.stream;
        }

        await processStream(
          stream,
          abortController,
          (chunk: string) => {
            if (chunk && typeof chunk === 'string') {
              appendToStreamingMessage(update, assistantMsgId, chunk);
            }
          },
          30000,
          'translation stream'
        );

        updateStreamingState(update, assistantMsgId, abortController, false);
      } catch (err) {
        console.error('Translation error:', err);
        const errorMessage = getErrorMessage(err);

        updateMessageContent(
          update,
          assistantMsgId,
          createErrorMessage(err).content,
          {
            isLoading: false,
            isStreaming: false,
            streamingMessageId: null,
            abortController: null,
            error: errorMessage,
          }
        );
      } finally {
        if (detector) {
          try {
            detector.destroy();
          } catch (cleanupError) {
            console.warn('Error destroying detector:', cleanupError);
          }
        }
        if (translator) {
          try {
            translator.destroy();
          } catch (cleanupError) {
            console.warn('Error destroying translator:', cleanupError);
          }
        }
      }
    },

    async write(userMessage: string, options?: WriterOptions) {
      if (!userMessage.trim()) return;

      const abortController = new AbortController();
      const userMsg = createChatMessage('user', userMessage);
      const assistantMsg = createChatMessage('assistant', '');
      const assistantMsgId = assistantMsg.id;

      update((state) => ({
        ...state,
        messages: [...state.messages, userMsg, assistantMsg],
        isLoading: false,
        error: null,
      }));

      updateStreamingState(update, assistantMsgId, abortController, true);

      try {
        const writerOptions: WriterOptions = {
          tone: options?.tone || 'neutral',
          format: options?.format || 'plain-text',
          length: options?.length || 'medium',
          ...(options?.sharedContext && {
            sharedContext: options.sharedContext,
          }),
          ...(options?.outputLanguage && {
            outputLanguage: options.outputLanguage,
          }),
          ...(options?.expectedInputLanguages && {
            expectedInputLanguages: options.expectedInputLanguages,
          }),
          ...(options?.expectedContextLanguages && {
            expectedContextLanguages: options.expectedContextLanguages,
          }),
        };

        const { provider, model, apiKey } = await resolveProviderConfig('write');
        let stream: ReadableStream<string>;
        if (provider === 'builtin') {
          const session = await createAISessionWithMonitor(
            'writer',
            writerOptions
          );
          stream = session!.writeStreaming(userMessage, {
            context: options?.sharedContext,
          });
        } else {
          if (!apiKey || !model) throw new Error('Missing provider credentials');
          const attach = await shouldAttachPageContext('write', userMessage);
          const prompt = buildWritePrompt({ text: userMessage, tone: writerOptions.tone as any, format: writerOptions.format as any, length: writerOptions.length as any, outputLanguage: options?.outputLanguage, pageContext: attach ? pageContext : undefined });
          const result = await runProviderStream({ provider, model, apiKey }, { messages: [{ role: 'user', content: prompt }] });
          stream = result.stream;
        }

        let hasReceivedChunks = false;
        for await (const chunk of stream) {
          if (abortController.signal.aborted) {
            break;
          }

          if (chunk && typeof chunk === 'string') {
            hasReceivedChunks = true;
            appendToStreamingMessage(update, assistantMsgId, chunk);
          }
        }

        if (!hasReceivedChunks) {
          throw new Error('No content received from Writer API');
        }

        updateStreamingState(update, assistantMsgId, abortController, false);
      } catch (err) {
        console.error('Write error:', err);
        const errorMessage = getErrorMessage(err);

        updateMessageContent(
          update,
          assistantMsgId,
          createErrorMessage(err).content,
          {
            isLoading: false,
            isStreaming: false,
            streamingMessageId: null,
            abortController: null,
            error: errorMessage,
          }
        );
      }
    },

    async rewrite(userMessage: string, options?: RewriterOptions) {
      if (!userMessage.trim()) return;

      const abortController = new AbortController();
      const userMsg = createChatMessage('user', userMessage);
      const assistantMsg = createChatMessage('assistant', '');
      const assistantMsgId = assistantMsg.id;

      update((state) => ({
        ...state,
        messages: [...state.messages, userMsg, assistantMsg],
        isLoading: false,
        error: null,
      }));

      updateStreamingState(update, assistantMsgId, abortController, true);

      try {
        const o: any = options || {};

        const rawTone = options?.tone as string | undefined;
        const rawFormat = options?.format as string | undefined;
        const rawLength = options?.length as string | undefined;

        const toneMap: Record<string, 'as-is' | 'more-formal' | 'more-casual'> =
        {
          'as-is': 'as-is',
          'more-formal': 'more-formal',
          'more-casual': 'more-casual',
          formal: 'more-formal',
          neutral: 'as-is',
          casual: 'more-casual',
        };
        const lengthMap: Record<string, 'as-is' | 'shorter' | 'longer'> = {
          'as-is': 'as-is',
          shorter: 'shorter',
          longer: 'longer',
          short: 'shorter',
          medium: 'as-is',
          long: 'longer',
        };
        const formatMap: Record<string, 'as-is' | 'markdown' | 'plain-text'> = {
          'as-is': 'as-is',
          markdown: 'markdown',
          'plain-text': 'plain-text',
        };

        const mappedTone = rawTone ? toneMap[rawTone] : undefined;
        const mappedFormat = rawFormat ? formatMap[rawFormat] : undefined;
        const mappedLength = rawLength ? lengthMap[rawLength] : undefined;

        const tone = mappedTone ?? 'as-is';
        const format = mappedFormat ?? 'as-is';
        const length = mappedLength ?? 'as-is';

        const rewriterOptions: RewriterOptions = {
          tone,
          format,
          length,
          ...(options?.sharedContext && {
            sharedContext: options.sharedContext,
          }),
          ...(options?.outputLanguage && {
            outputLanguage: options.outputLanguage,
          }),
          ...(options?.expectedInputLanguages && {
            expectedInputLanguages: options.expectedInputLanguages,
          }),
          ...(options?.expectedContextLanguages && {
            expectedContextLanguages: options.expectedContextLanguages,
          }),
        };

        const { provider, model, apiKey } = await resolveProviderConfig('rewrite');
        let stream: ReadableStream<string>;
        if (provider === 'builtin') {
          const session = await createAISessionWithMonitor(
            'rewriter',
            rewriterOptions
          );
          stream = session!.rewriteStreaming(userMessage, {
            context: options?.sharedContext,
          });
        } else {
          if (!apiKey || !model) throw new Error('Missing provider credentials');
          const attach = await shouldAttachPageContext('rewrite', userMessage);
          const prompt = buildRewritePrompt({ text: userMessage, tone: rewriterOptions.tone as any, format: rewriterOptions.format as any, length: rewriterOptions.length as any, outputLanguage: options?.outputLanguage, pageContext: attach ? pageContext : undefined });
          const result = await runProviderStream({ provider, model, apiKey }, { messages: [{ role: 'user', content: prompt }] });
          stream = result.stream;
        }

        let hasReceivedChunks = false;
        for await (const chunk of stream) {
          if (abortController.signal.aborted) {
            break;
          }

          if (chunk && typeof chunk === 'string') {
            hasReceivedChunks = true;
            appendToStreamingMessage(update, assistantMsgId, chunk);
          }
        }

        if (!hasReceivedChunks) {
          throw new Error('No content received from Rewriter API');
        }

        updateStreamingState(update, assistantMsgId, abortController, false);
      } catch (err) {
        console.error('Rewrite error:', err);
        const errorMessage = getErrorMessage(err);

        updateMessageContent(
          update,
          assistantMsgId,
          createErrorMessage(err).content,
          {
            isLoading: false,
            isStreaming: false,
            streamingMessageId: null,
            abortController: null,
            error: errorMessage,
          }
        );
      }
    },
    async sendMessageStreaming(userMessage: string, images?: string[]) {
      if (!userMessage.trim()) return;
      console.log('sendMessageStreaming', userMessage, images);

      const abortController = new AbortController();
      const userMsg = createChatMessage('user', userMessage, images);
      const assistantMsg = createChatMessage('assistant', '');
      const assistantMsgId = assistantMsg.id;

      update((state) => ({
        ...state,
        messages: [...state.messages, userMsg, assistantMsg],
        isLoading: false,
        error: null,
      }));

      updateStreamingState(update, assistantMsgId, abortController, true);

      try {
        const { provider, model, apiKey } = await resolveProviderConfig('prompt');
        if (provider === 'builtin') {
          if (!session) {
            session = await createAISessionWithMonitor(
              'prompt',
              { pageContext }
            );
          }
        }

        if (images && images.length > 0 && session && provider === 'builtin') {
          for await (const image of images) {
            const rawFile = await imageStringToFile(image, 'image');
            const file = await ensurePngFile(rawFile, 'image.png');

            await session?.append([
              {
                role: 'user',
                content: [{ type: 'image', value: file }],
              },
            ]);
          }
        }

        let stream: ReadableStream<string>;
        if (provider === 'builtin') {
          try {
            stream = session!.promptStreaming(userMessage);
          } catch (streamCreationError) {
            console.error('Failed to create stream:', streamCreationError);
            throw new Error(
              `Failed to create stream: ${getErrorMessage(streamCreationError)}`
            );
          }
        } else {
          if (!apiKey || !model) throw new Error('Missing provider credentials');
          const attach = await shouldAttachPageContext('prompt', userMessage);
          const sys = attach ? systemPrompt({ pageContext }) : undefined;
          const contentParts: any[] = [textPart(userMessage)];
          if (images && images.length) {
            for (const img of images) contentParts.push(imagePartFromDataURL(img));
          }
          const result = await runProviderStream({ provider, model, apiKey }, { system: sys, messages: [{ role: 'user', content: contentParts }] });
          stream = result.stream;
        }

        await processStream(
          stream,
          abortController,
          (chunk: string) => {
            if (chunk && typeof chunk === 'string') {
              appendToStreamingMessage(update, assistantMsgId, chunk);
            }
          },
          30000,
          'AI prompt stream'
        );

        updateStreamingState(update, assistantMsgId, abortController, false);
      } catch (err) {
        console.error('Streaming error:', err);
        const errorMessage = getErrorMessage(err);

        updateMessageContent(
          update,
          assistantMsgId,
          createErrorMessage(err).content,
          {
            isStreaming: false,
            streamingMessageId: null,
            abortController: null,
            error: errorMessage,
          }
        );

        safeDestroySession(session);
        session = null;
      }
    },

    stopStreaming() {
      update((state) => {
        if (state.abortController) {
          state.abortController.abort();
        }
        return {
          ...state,
          isStreaming: false,
          streamingMessageId: null,
          abortController: null,
        };
      });
    },

    setMessages(newMessages: ChatMessage[]) {
      update((state) => ({
        ...state,
        messages: newMessages,
        error: null,
        isLoading: false,
        isStreaming: false,
        streamingMessageId: null,
        abortController: null,
      }));
    },

    clear() {
      safeDestroySession(session);
      session = null;
      if (
        typeof chrome !== 'undefined' &&
        chrome.runtime &&
        chrome.runtime.sendMessage
      ) {
        try {
          chrome.runtime.sendMessage(
            { type: 'CLEAR_TELESCOPE_STATE' },
            (response) => {
              if (chrome.runtime.lastError) {
                console.warn(
                  'CLEAR_TELESCOPE_STATE: chrome error',
                  chrome.runtime.lastError.message
                );
              } else if (!response?.success) {
                console.warn(
                  'CLEAR_TELESCOPE_STATE: failed to clear state',
                  response?.error
                );
              }
            }
          );
        } catch (error) {
          console.warn('Exception during CLEAR_TELESCOPE_STATE:', error);
        }
      }

      update((state) => ({
        ...state,
        messages: [],
        error: null,
        isLoading: false,
        isStreaming: false,
        streamingMessageId: null,
        abortController: null,
      }));
    },

    destroy() {
      safeDestroySession(session);
      session = null;
    },
  };
}

function getActiveTabId() {
  return new Promise<number>((resolve, reject) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
        // Fallback for non-extension contexts
        resolve(0);
        return;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0 && tabs[0].id != null) {
          resolve(tabs[0].id);
        } else {
          resolve(0);
        }
      });
    } catch (e) {
      resolve(0);
    }
  });
}

export const chatStore = createChatStore();