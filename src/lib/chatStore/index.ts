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
import { cleanHTML, htmlToMarkdown, processTextForLLM } from "../utils/converters";
import { getCachedPageMarkdown, convertAndStorePageMarkdown, storePageMarkdown } from "./markdown-cache-helper";

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

  // Fetch pageContext from cache if tabId is provided
  let pageContext = '';
  if (options.tabId) {
    try {
      const cached = await getCachedPageMarkdown({ tabId: options.tabId });
      if (cached) {
        pageContext = cached;
        console.log('createAISessionWithMonitor: Using cached pageContext for tab', options.tabId);
      }
    } catch (err) {
      console.warn('Error fetching page context from cache:', err);
    }
  }

  switch (sessionType) {
    case 'prompt':
      await checkAvailability('LanguageModel');
      return await createAISession({ pageContext, ...options, monitor });
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
  images?: string[],
  audioUrl?: string
): ChatMessage {
  return {
    id: Date.now() + (type === 'assistant' ? 1 : 0),
    type,
    content,
    images: images || [],
    audioUrl: audioUrl,
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
  audioUrl?: string;
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
  console.log('createAISession', pageContext);
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
  let isInSidePanel = false;

  // Helper function to get tab ID
  async function getActiveTabId(): Promise<number | null> {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            resolve(tabs || []);
          });
        });
        return tabs[0]?.id || null;
      }
      return null;
    } catch (err) {
      console.error('Error getting active tab ID:', err);
      return null;
    }
  }

  // Helper function to get tab ID via background script (works in both sidepanel and floating modes)
  async function getTabIdFromBackground(): Promise<{ tabId: number | null; url: string | null }> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        resolve({ tabId: null, url: null });
        return;
      }

      const timeout = setTimeout(() => {
        resolve({ tabId: null, url: null });
      }, 5000);

      chrome.runtime.sendMessage({ type: 'GET_TAB_ID' }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError || !response?.success) {
          resolve({ tabId: null, url: null });
          return;
        }
        resolve({
          tabId: response.tabId || null,
          url: response.url || null,
        });
      });
    });
  }

  // Helper function to get document info - defined here so it can be used in other methods
  async function getDocumentInfoHelper(inSidePanel: boolean = false): Promise<string> {
    // Get tab ID first - use background script for both modes to ensure accuracy
    let tabId: number | null = null;
    let currentUrl = '';

    const tabInfo = await getTabIdFromBackground();
    tabId = tabInfo.tabId;
    currentUrl = tabInfo.url || '';

    // Fallback for floating mode if background script fails
    if (!tabId && !inSidePanel) {
      tabId = await getActiveTabId();
      currentUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';
    }

    // Try to get cached markdown first
    if (tabId) {
      const cached = await getCachedPageMarkdown({ tabId });
      if (cached) {
        console.log('ChatStore: Using cached markdown for tab', tabId);
        return cached;
      }
    }

    // No cache found, extract fresh content
    if (inSidePanel) {
      // Sidepanel mode: request via background script
      return new Promise<string>(async (resolve, reject) => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
          reject(new Error('Chrome runtime not available'));
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Timeout: No response from background script'));
        }, 10000);

        chrome.runtime.sendMessage(
          {
            type: 'GET_PAGE_CONTENT',
          },
          async (response) => {
            clearTimeout(timeout);

            if (chrome.runtime.lastError) {
              console.error(
                'Chrome runtime error:',
                chrome.runtime.lastError.message
              );
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (response?.success && response.pageContext) {
              // Store the extracted content in cache
              if (tabId && currentUrl) {
                try {
                  await storePageMarkdown({ url: currentUrl, content: response.pageContext, tabId });
                } catch (storeErr) {
                  console.warn('Failed to store markdown in cache:', storeErr);
                }
              }
              resolve(response.pageContext);
            } else {
              const errorMsg = response?.error || 'Failed to get page content';
              console.error('Failed to get page content:', errorMsg);
              reject(new Error(errorMsg));
            }
          }
        );
      });
    } else {
      // Floating mode: use window.document directly
      try {
        // Try to get document from window (for shadow DOM in content script)
        const doc = typeof window !== 'undefined' ? window.document : document;

        if (!doc) {
          throw new Error('Document not available');
        }

        const html = (
          doc.querySelector('article') ||
          doc.querySelector('main') ||
          doc.querySelector('[role="main"]') ||
          doc.querySelector('#main') ||
          doc.documentElement
        )?.outerHTML || '';

        const cleanedHTML = cleanHTML(html);
        const markdown = htmlToMarkdown(cleanedHTML);
        const processedMarkdown = processTextForLLM(markdown);

        const metaDescription =
          doc.querySelector('meta[name="description"]')
            ?.getAttribute?.('content') || '';
        const url = currentUrl || (typeof window !== 'undefined' && window.location ? window.location.href : 'unknown');
        const metadata = `# ${doc.title || 'Web Page'}
**Title:** ${doc.title}
**Description:** ${metaDescription}
**URL:** ${url}
**Date:** ${new Date().toISOString()}

---

`;

        const maxLength = 60_000;
        const finalContent = metadata + processedMarkdown;

        const data =
          finalContent.length > maxLength
            ? finalContent.substring(0, maxLength) +
            '\n\n... [Content truncated for AI context]'
            : finalContent;

        // Store in cache
        if (tabId && url && url !== 'unknown') {
          try {
            await storePageMarkdown({ url, content: data, tabId });
          } catch (storeErr) {
            console.warn('Failed to store markdown in cache:', storeErr);
          }
        }

        return data;
      } catch (err) {
        console.error('Error extracting page content from document:', err);
        const doc = typeof window !== 'undefined' ? window.document : document;
        return `# ${doc?.title || 'Web Page'}

**Error:** Failed to convert to markdown, using fallback text extraction

---

${doc?.body?.textContent || 'No content available'}`;
      }
    }
  }

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
    async init(providedPageContext?: string, inSidePanel: boolean = false) {
      isInSidePanel = inSidePanel;
      const status = await checkAPIStatus();
      update((state) => ({
        ...state,
        aiAvailable: status.available,
        aiStatus: status.message,
      }));

      if (providedPageContext) {
        pageContext = providedPageContext;
      } else {
        // Use getDocumentInfo to fetch page content
        try {
          pageContext = await getDocumentInfoHelper(inSidePanel);
        } catch (err) {
          console.error('Failed to get document info during init:', err);
          // Fallback to old method for floating mode
          if (!inSidePanel) {
            try {
              const tabId = await getActiveTabId();
              if (tabId) {
                pageContext = await extractPageContent({ tabId });
              } else {
                pageContext = '';
              }
            } catch (fallbackErr) {
              console.error('Fallback extraction also failed:', fallbackErr);
              pageContext = '';
            }
          } else {
            pageContext = '';
          }
        }
      }
    },

    /**
     * Set page context externally (for side panel mode)
     */
    setPageContext(context: string) {
      pageContext = context;
    },

    /**
     * Get document info - extracts page content as markdown
     * For floating mode: uses window.document directly
     * For sidepanel mode: requests via background script
     */
    async getDocumentInfo(inSidePanel: boolean = false): Promise<string> {
      return getDocumentInfoHelper(inSidePanel);
    },

    async summariseStreaming({ userMessage, sharedContext, type = 'tldr', format = 'markdown', length = 'short', tabId }: { userMessage: string, sharedContext?: string, type?: 'keyPoints' | 'tldr' | 'teaser' | 'headline', format?: 'markdown' | 'plain-text', length?: 'short' | 'medium' | 'long', tabId?: number | null }) {
      if (!userMessage.trim()) return;

      // Get tabId if not provided
      const currentTabId = tabId || await getActiveTabId();

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
              tabId: currentTabId,
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

    async translateStreaming({ userMessage, targetLanguage, sharedContext, tabId }: { userMessage: string, targetLanguage: string, sharedContext?: string, tabId?: number | null }) {
      if (!userMessage.trim()) return;

      // Get tabId if not provided
      const currentTabId = tabId || await getActiveTabId();

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
          { sourceLanguage: detectedLanguage, targetLanguage, tabId }
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
            { sourceLanguage: detectedLanguage, targetLanguage, tabId: currentTabId }
          );
          stream = translator!.translateStreaming(userMessage);
        } else {
          if (!apiKey || !model) throw new Error('Missing provider credentials');
          const attach = await shouldAttachPageContext('translate', userMessage);
          // Fetch document info if needed but not available
          if (attach && (!pageContext || pageContext.trim().length === 0)) {
            try {
              pageContext = await getDocumentInfoHelper(isInSidePanel);
            } catch (err) {
              console.warn('Failed to fetch document info for translation:', err);
            }
          }
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

    async writeStreaming({ userMessage, options, tabId }: { userMessage: string, options?: WriterOptions, tabId?: number | null }) {
      if (!userMessage.trim()) return;

      // Get tabId if not provided
      const currentTabId = tabId || await getActiveTabId();

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
            { ...writerOptions, tabId: currentTabId }
          );
          stream = session!.writeStreaming(userMessage, {
            context: options?.sharedContext,
          });
        } else {
          if (!apiKey || !model) throw new Error('Missing provider credentials');
          const attach = await shouldAttachPageContext('write', userMessage);
          // Fetch document info if needed but not available
          if (attach && (!pageContext || pageContext.trim().length === 0)) {
            try {
              pageContext = await getDocumentInfoHelper(isInSidePanel);
            } catch (err) {
              console.warn('Failed to fetch document info for write:', err);
            }
          }
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

    async rewriteStreaming({ userMessage, options, tabId }: { userMessage: string, options?: RewriterOptions, tabId?: number | null }) {
      if (!userMessage.trim()) return;

      // Get tabId if not provided
      const currentTabId = tabId || await getActiveTabId();

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
            { ...rewriterOptions, tabId: currentTabId }
          );
          stream = session!.rewriteStreaming(userMessage, {
            context: options?.sharedContext,
          });
        } else {
          if (!apiKey || !model) throw new Error('Missing provider credentials');
          const attach = await shouldAttachPageContext('rewrite', userMessage);
          // Fetch document info if needed but not available
          if (attach && (!pageContext || pageContext.trim().length === 0)) {
            try {
              pageContext = await getDocumentInfoHelper(isInSidePanel);
            } catch (err) {
              console.warn('Failed to fetch document info for rewrite:', err);
            }
          }
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
    async promptStreaming({ userMessage, images, audioBlobId, options, tabId }: { userMessage: string, images?: string[], audioBlobId?: string, options?: any, tabId?: number | null }) {
      if (!userMessage.trim() && !audioBlobId) return;

      // Get tabId if not provided
      const currentTabId = tabId || await getActiveTabId();

      const abortController = new AbortController();

      // Get audio URL if audioBlobId is provided
      let audioUrl: string | undefined = undefined;
      if (audioBlobId) {
        try {
          const storage = globalStorage();
          const audioBlobs = await storage.get('audioBlobs');
          if (audioBlobs && typeof audioBlobs === 'object' && audioBlobs[audioBlobId]) {
            const base64Data = audioBlobs[audioBlobId] as string;
            // Create a blob URL for playback
            const response = await fetch(base64Data);
            const blob = await response.blob();
            audioUrl = URL.createObjectURL(blob);
          }
        } catch (error) {
          console.error('Error creating audio URL:', error);
        }
      }

      // Use audio indicator if no text message
      const displayMessage = userMessage.trim() ?? "";
      const userMsg = createChatMessage('user', displayMessage, images, audioUrl);
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
              { ...options, tabId: currentTabId }
            );
          }
        }

        // Handle images
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

        // Handle audio
        let audioBlob: Blob | null = null;
        if (audioBlobId && session && provider === 'builtin') {
          try {
            const storage = globalStorage();
            const audioBlobs = await storage.get('audioBlobs');
            if (audioBlobs && typeof audioBlobs === 'object' && audioBlobs[audioBlobId]) {
              const base64Data = audioBlobs[audioBlobId] as string;
              // Convert base64 to blob
              const response = await fetch(base64Data);
              audioBlob = await response.blob();

              await session?.append([
                {
                  role: 'user',
                  content: [{ type: 'audio', value: audioBlob }],
                },
              ]);
            }
          } catch (error) {
            console.error('Error loading audio blob:', error);
          }
        }

        let stream: ReadableStream<string>;
        if (provider === 'builtin') {
          try {
            const promptContent = userMessage.trim() || (audioBlob ? '' : '');
            stream = session!.promptStreaming(promptContent);
          } catch (streamCreationError) {
            console.error('Failed to create stream:', streamCreationError);
            throw new Error(
              `Failed to create stream: ${getErrorMessage(streamCreationError)}`
            );
          }
        } else {
          if (!apiKey || !model) throw new Error('Missing provider credentials');
          const attach = await shouldAttachPageContext('prompt', userMessage);
          // Fetch document info if needed but not available
          if (attach && (!pageContext || pageContext.trim().length === 0)) {
            try {
              pageContext = await getDocumentInfoHelper(isInSidePanel);
            } catch (err) {
              console.warn('Failed to fetch document info for prompt:', err);
            }
          }
          const sys = attach ? systemPrompt({ pageContext }) : undefined;
          const contentParts: any[] = [];
          if (userMessage.trim()) {
            contentParts.push(textPart(userMessage));
          }
          if (images && images.length) {
            for (const img of images) contentParts.push(imagePartFromDataURL(img));
          }
          if (audioBlob) {
            contentParts.push({ type: 'audio', value: audioBlob });
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

// Move this to background with message passing.
// Has this store needs also runs in the floating telescope environment.
function getActiveTabId() {
  return new Promise<number>((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        resolve(tabs[0].id);
      } else {
        reject(new Error("No active tab found"));
      }
    });
  });
}

export const chatStore = createChatStore();