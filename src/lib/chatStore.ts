import { writable } from 'svelte/store';

export interface ChatMessage {
  id: number;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

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

  interface AINamespace {
    languageModel: AILanguageModelFactory;
  }

  interface AILanguageModelFactory {
    capabilities(): Promise<AICapabilities>;
    create(options?: AILanguageModelCreateOptions): Promise<AILanguageModel>;
  }

  interface AICapabilities {
    available: 'readily' | 'after-download' | 'no';
    defaultTemperature?: number;
    defaultTopK?: number;
    maxTopK?: number;
  }

  interface AILanguageModelCreateOptions {
    systemPrompt?: string;
    temperature?: number;
    topK?: number;
    language?: string;
    outputLanguage?: string;
    output?: { language: string };
  }

  interface AILanguageModel {
    prompt(input: string): Promise<string>;
    promptStreaming(input: string): ReadableStream<string>;
    destroy(): void;
    clone?(): Promise<AILanguageModel>;
  }

  var LanguageModel:
    | {
        availability(): Promise<
          'readily' | 'available' | 'no' | 'after-download'
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

  interface AISummarizer {
    summarize(
      text: string,
      options?: { context?: string; signal?: AbortSignal }
    ): Promise<string>;
    summarizeStreaming(
      text: string,
      options?: { context?: string; signal?: AbortSignal }
    ): ReadableStream<string>;
    destroy(): void;
  }
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  aiAvailable: boolean;
  aiStatus: string;
}

/**
 * Extract page content for AI context
 */
function extractPageContent(): string {
  try {
    // Get main content
    const mainContent = document.querySelector('main, article, [role="main"]');
    const contentElement = mainContent || document.body;

    // Extract text from various elements
    const textElements = contentElement.querySelectorAll(
      'h1, h2, h3, h4, h5, h6, p, li, td, th'
    );
    const texts: string[] = [];

    textElements.forEach((el) => {
      const text = el.textContent?.trim();
      if (text) {
        texts.push(text);
      }
    });

    // Get page title
    const pageTitle = document.title;
    const pageUrl = window.location.href;

    return `Page: ${pageTitle}\nURL: ${pageUrl}\n\nContent:\n${texts.join(
      '\n'
    )}`.substring(0, 3000);
  } catch (err) {
    console.error('Error extracting page content:', err);
    return `Page: ${document.title}`;
  }
}

/**
 * Create AI session using whichever API is available
 */
async function createAISession(pageContext: string): Promise<AILanguageModel> {
  const systemPrompt = `You are a helpful AI assistant embedded in a browser extension called "Helix". You have access to the current page's content and can answer questions about it.

Your capabilities:
• Answer questions about the page content
• Summarize information from the page
• Explain concepts mentioned on the page
• Help users understand the content better

Guidelines:
• Be concise and helpful
• Reference specific content from the page when relevant
• If the question isn't related to the page, provide a brief general answer
• Keep responses clear and easy to read

Current Page Content:
---
${pageContext.substring(0, 2000)}
---

When answering, prioritize information from the page content above.`;

  const temperature = 0.7;
  const topK = 40;

  // Try Method 1: Global LanguageModel API
  if (typeof LanguageModel !== 'undefined') {
    try {
      const availability = await LanguageModel.availability();
      if (availability === 'readily' || availability === 'available') {
        console.log('Using Global LanguageModel API');
        return await LanguageModel.create({
          language: 'en',
          outputLanguage: 'en',
          output: { language: 'en' },
          temperature,
          topK,
        });
      }
      if (availability === 'after-download') {
        throw new Error(
          'AI model is downloading. Check progress at chrome://components'
        );
      }
    } catch (err) {
      console.log('Global LanguageModel failed, trying window.ai...', err);
    }
  }

  // Try Method 2: window.ai.languageModel (official Prompt API)
  if (typeof window.ai !== 'undefined' && window.ai.languageModel) {
    try {
      const capabilities = await window.ai.languageModel.capabilities();
      if (capabilities.available === 'readily') {
        console.log('Using window.ai.languageModel API');
        const optimalTemp = capabilities.defaultTemperature ?? temperature;
        const optimalTopK = Math.min(
          capabilities.defaultTopK ?? topK,
          capabilities.maxTopK ?? topK
        );
        return await window.ai.languageModel.create({
          systemPrompt,
          temperature: optimalTemp,
          topK: optimalTopK,
        });
      }
      if (capabilities.available === 'after-download') {
        throw new Error(
          'AI model is downloading. Check progress at chrome://components'
        );
      }
    } catch (err) {
      console.log('window.ai.languageModel failed, trying Summarizer...', err);
    }
  }

  // Try Method 3: Summarizer API (fallback)
  if (typeof Summarizer !== 'undefined') {
    try {
      const availability = await Summarizer.availability();
      if (availability === 'readily' || availability === 'available') {
        console.warn(
          '⚠️ Using Summarizer API - designed for summarization, not chat!'
        );
        const summarizer = await Summarizer.create({
          sharedContext: pageContext.substring(0, 1000),
          type: 'tldr',
          format: 'plain-text',
          length: 'medium',
        });

        // Wrap Summarizer to match AILanguageModel interface
        return {
          prompt: async (input: string): Promise<string> => {
            const combinedText = `Page content: ${pageContext.substring(
              0,
              800
            )}\n\nUser question: ${input}\n\nProvide a helpful response based on the page content.`;
            return await summarizer.summarize(combinedText, {
              context: 'Answer the user question based on the page content',
            });
          },
          promptStreaming: (input: string): ReadableStream<string> => {
            const combinedText = `Page content: ${pageContext.substring(
              0,
              800
            )}\n\nUser question: ${input}\n\nProvide a helpful response.`;
            return summarizer.summarizeStreaming(combinedText);
          },
          destroy: () => summarizer.destroy(),
        };
      }
    } catch (err) {
      console.log('Summarizer failed:', err);
    }
  }

  throw new Error(
    'Chrome Built-in AI not available.\n\n' +
      'Please ensure:\n' +
      '1. You are using Chrome 138+ (Dev/Canary)\n' +
      '2. Flags are enabled at chrome://flags\n' +
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
        message: '❌ Window object not available',
      };
    }

    // Try Global LanguageModel
    if (typeof LanguageModel !== 'undefined') {
      try {
        const availability = await LanguageModel.availability();
        if (availability === 'readily' || availability === 'available') {
          return {
            available: true,
            message: '✅ Chrome AI is ready!',
          };
        }
        if (availability === 'after-download') {
          return {
            available: false,
            message: '⏬ Downloading AI model...',
          };
        }
      } catch (err) {
        console.log('Global LanguageModel check failed', err);
      }
    }

    // Try window.ai
    if (typeof window.ai !== 'undefined' && window.ai.languageModel) {
      try {
        const caps = await window.ai.languageModel.capabilities();
        if (caps.available === 'readily') {
          return {
            available: true,
            message: '✅ Chrome AI is ready!',
          };
        }
        if (caps.available === 'after-download') {
          return {
            available: false,
            message: '⏬ Downloading AI model...',
          };
        }
      } catch (err) {
        console.log('window.ai check failed', err);
      }
    }

    // Try Summarizer
    if (typeof Summarizer !== 'undefined') {
      try {
        const availability = await Summarizer.availability();
        if (availability === 'readily' || availability === 'available') {
          return {
            available: true,
            message: '⚠️ Summarizer API available (limited)',
          };
        }
      } catch (err) {
        console.log('Summarizer check failed', err);
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

/**
 * Create the chat store
 */
function createChatStore() {
  const { subscribe, set, update } = writable<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    aiAvailable: false,
    aiStatus: 'Checking...',
  });

  let session: AILanguageModel | null = null;
  let pageContext = '';

  return {
    subscribe,

    /**
     * Initialize and check AI availability
     */
    async init() {
      const status = await checkAPIStatus();
      update((state) => ({
        ...state,
        aiAvailable: status.available,
        aiStatus: status.message,
      }));

      // Extract page content
      pageContext = extractPageContent();
    },

    /**
     * Send a message to the AI
     */
    async sendMessage(userMessage: string) {
      if (!userMessage.trim()) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: Date.now(),
        type: 'user',
        content: userMessage,
        timestamp: new Date(),
      };

      update((state) => ({
        ...state,
        messages: [...state.messages, userMsg],
        isLoading: true,
        error: null,
      }));

      try {
        // Create or reuse session
        if (!session) {
          session = await createAISession(pageContext);
        }

        // Send prompt to AI
        console.log('Sending prompt to Chrome AI...');
        const aiResponse = await session.prompt(userMessage);

        // Validate response
        if (!aiResponse || typeof aiResponse !== 'string') {
          throw new Error('Invalid response from AI model');
        }

        // Add assistant message
        const assistantMsg: ChatMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          content: aiResponse.trim(),
          timestamp: new Date(),
        };

        update((state) => ({
          ...state,
          messages: [...state.messages, assistantMsg],
          isLoading: false,
        }));
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error occurred';

        // Add error message to chat
        const errorMsg: ChatMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          content: `❌ Error: ${errorMessage}`,
          timestamp: new Date(),
        };

        update((state) => ({
          ...state,
          messages: [...state.messages, errorMsg],
          isLoading: false,
          error: errorMessage,
        }));

        // Reset session on error
        if (session) {
          try {
            session.destroy();
          } catch (e) {
            console.warn('Error destroying session:', e);
          }
          session = null;
        }
      }
    },

    /**
     * Clear all messages
     */
    clear() {
      if (session) {
        try {
          session.destroy();
        } catch (err) {
          console.warn('Error destroying session:', err);
        }
        session = null;
      }

      update((state) => ({
        ...state,
        messages: [],
        error: null,
        isLoading: false,
      }));
    },

    /**
     * Destroy session and cleanup
     */
    destroy() {
      if (session) {
        try {
          session.destroy();
        } catch (err) {
          console.warn('Error destroying session:', err);
        }
        session = null;
      }
    },
  };
}

export const chatStore = createChatStore();
