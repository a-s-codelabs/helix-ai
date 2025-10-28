import { writable } from 'svelte/store';
import {
  cleanHTML,
  htmlToMarkdown,
  processTextForLLM,
} from './utils/converters';
import {
  imageStringToFile,
  base64ToFile as utilsBase64ToFile,
  ensurePngFile,
} from './utils/file';
// import { storage } from 'wxt/utils/storage';
import { globalStorage } from './globalStorage';

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

/**
 * Helper function to safely extract error message
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error occurred';
}

/**
 * Helper function to safely extract error details for logging
 */
function getErrorDetails(error: unknown) {
  return {
    name: error instanceof Error ? error.name : 'Unknown',
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
  };
}

/**
 * Helper function to safely destroy session
 */
function safeDestroySession(session: AILanguageModel | null): void {
  if (session) {
    try {
      session.destroy();
    } catch (err) {
      console.warn('Error destroying session:', err);
    }
  }
}

/**
 * Helper function to create error message for chat
 */
function createErrorMessage(error: unknown): ChatMessage {
  return {
    id: Date.now() + 1,
    type: 'assistant',
    content: `❌ Error: ${getErrorMessage(error)}`,
    timestamp: new Date(),
  };
}

async function extractPageContent({
  tabId,
}: {
  tabId: number;
}): Promise<string> {
  try {
    const html = (
      document.querySelector('article') ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.querySelector('#main') ||
      document.documentElement
    ).outerHTML;

    // 2. Clean HTML (remove CSS, scripts, etc.)
    const cleanedHTML = cleanHTML(html);
    // console.log('##HELIX cleanedHTML', cleanedHTML);

    // 3. Convert to markdown
    const markdown = htmlToMarkdown(cleanedHTML);

    // 4. Process for LLM
    const processedMarkdown = processTextForLLM(markdown);

    const metaDescription =
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute?.('content') || '';
    // 5. Add metadata
    const metadata = `# ${document.title || 'Web Page'}
**Title:** ${document.title}
**Description:** ${metaDescription}
**URL:** ${window.location.href}
**URL:** ${window.location.href}
**Date:** ${new Date().toISOString()}

---

`;

    // 6. Truncate for AI context
    const maxLength = 60_000;
    const finalContent = metadata + processedMarkdown;

    const data =
      finalContent.length > maxLength
        ? finalContent.substring(0, maxLength) +
          '\n\n... [Content truncated for AI context]'
        : finalContent;
    globalStorage().append('pageMarkdown', { [`tab_id_${tabId}`]: data });
    return data;
  } catch (err) {
    console.error('Error extracting page content:', err);
    return `# ${document.title || 'Web Page'}


**Error:** Failed to convert to markdown, using fallback text extraction

---

${document.body.textContent || 'No content available'}`;
  }
}

/**
 * Create AI session using whichever API is available
 */
// url: //www.user-site-${n}.com
// const systemPrompt = (
//   n: number
// ) => `You are a helpful AI assistant embedded in a browser extension called "Helix". You have access to the current page's content and can answer questions about it. So answer questions based on the page content.

// Your capabilities:
// • Answer questions about the page content
// • If the question isn't related to the page, provide a brief general answer

// Current Page Content: url: https://www.defaultsite.com
// ---
// ${pageContext.substring(0, 2000)}
// ---

// When answering, prioritize information from the page content above.`;
// ${pageContext.substring(0, 2000)}
async function createAISession(pageContext: string): Promise<AILanguageModel> {
  const temperature = 0.4;
  const topK = 4;
  const systemPrompt = (
    n: number
  ) => `You are a helpful AI assistant embedded in a browser extension. Your name is "Helix". You have access to the current page's content and can answer questions about it. So answer questions based on the page content.
  Your capabilities:
  • Answer questions about the page content
  • If the question isn't related to the page, provide a brief general answer
  Current Page Content:
  ---
  ${pageContext.substring(0, 2000)}
  ---
  When answering, prioritize information from the page content above.

  `;

  console.log('##HELIX createAISession 1', {
    systemPrompt: systemPrompt(1),
    temperature,
    topK,
    pageContext,
  });

  // Try Method 1: Global LanguageModel API
  if (typeof LanguageModel !== 'undefined') {
    const config = {
      systemPrompt: systemPrompt(2),
      language: 'en',
      outputLanguage: 'en',
      output: { language: 'en' },
      expectedInputs: [{ type: 'image' }],
      temperature,
      topK,
      initialPrompts: [
        {
          role: 'system',
          content: systemPrompt(6),
        },
      ],
    };
    try {
      const availability = await LanguageModel.availability();
      console.log({ availability });
      if (availability === 'readily' || availability === 'available') {
        console.log('##HELIX condition 1 - available');
        // IMPORTANT: working LanguageModel
        const session = await LanguageModel.create(config);
        console.log('##HELIX condition 1 - session', session);
        return session;
      }
      if (availability === 'downloadable') {
        const session = await LanguageModel.create(config);

        throw new Error(
          'AI model is downloading. Check progress at chrome://components'
        );
      }
    } catch (err) {
      console.error('Global LanguageModel failed, trying window.ai...', err);
    }
  }

  // // Try Method 2: window.ai.languageModel (official Prompt API)
  // if (typeof window.ai !== 'undefined' && window.ai.languageModel) {
  //   try {
  //     const capabilities = await window.ai.languageModel.capabilities();
  //     if (capabilities.available === 'readily') {
  //       const optimalTemp = capabilities.defaultTemperature ?? temperature;
  //       const optimalTopK = Math.min(
  //         capabilities.defaultTopK ?? topK,
  //         capabilities.maxTopK ?? topK
  //       );
  //       console.log('##HELIX condition 2 - available');
  //       return await window.ai.languageModel.create({
  //         systemPrompt: systemPrompt(3),
  //         temperature: optimalTemp,
  //         topK: optimalTopK,
  //       });
  //     }
  //     if (capabilities.available === 'after-download') {
  //       throw new Error(
  //         'AI model is downloading. Check progress at chrome://components'
  //       );
  //     }
  //   } catch (err) {
  //     console.error(
  //       'window.ai.languageModel failed, trying Summarizer...',
  //       err
  //     );
  //   }
  // }

  // Try Method 3: Summarizer API (fallback)
  // if (typeof Summarizer !== 'undefined') {
  //   try {
  //     const availability = await Summarizer.availability();
  //     if (availability === 'readily' || availability === 'available') {
  //       console.warn(
  //         '⚠️ Using Summarizer API - designed for summarization, not chat!'
  //       );
  //       console.log('##HELIX condition 3 - available');
  //       const summarizer = await Summarizer.create({
  //         sharedContext: pageContext.substring(0, 1000),
  //         type: 'tldr',
  //         format: 'plain-text',
  //         length: 'medium',
  //       });

  //       // Wrap Summarizer to match AILanguageModel interface
  //       return {
  //         append: async (content: { role: string; content: { type: string; value: any }[] }[]): Promise<void> => {
  //           return;
  //         },
  //         prompt: async (input: string): Promise<string> => {
  //           const combinedText = `Page content: ${pageContext.substring(
  //             0,
  //             800
  //           )}\n\nUser question: ${input}\n\nProvide a helpful response based on the page content.`;
  //           return await summarizer.summarize(combinedText, {
  //             context: 'Answer the user question based on the page content',
  //           });
  //         },
  //         promptStreaming: (input: string): ReadableStream<string> => {
  //           const combinedText = `Page content: ${pageContext.substring(
  //             0,
  //             800
  //           )}\n\nUser question: ${input}\n\nProvide a helpful response.`;
  //           return summarizer.summarizeStreaming(combinedText);
  //         },
  //         destroy: () => summarizer.destroy(),
  //       };
  //     }
  //   } catch (err) {
  //     console.error('Summarizer failed:', err);
  //   }
  // }

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

    // Try window.ai
    // if (typeof window.ai !== 'undefined' && window.ai.languageModel) {
    //   try {
    //     const caps = await window.ai.languageModel.capabilities();
    //     if (caps.available === 'readily') {
    //       return {
    //         available: true,
    //         message: '✅ Chrome AI is ready!',
    //       };
    //     }
    //     if (caps.available === 'after-download') {
    //       return {
    //         available: false,
    //         message: '⏬ Downloading AI model...',
    //       };
    //     }
    //   } catch (err) {
    //     console.error('window.ai check failed', err);
    //   }
    // }

    // Try Summarizer
    // if (typeof Summarizer !== 'undefined') {
    //   try {
    //     const availability = await Summarizer.availability();
    //     if (availability === 'readily' || availability === 'available') {
    //       return {
    //         available: true,
    //         message: '⚠️ Summarizer API available (limited)',
    //       };
    //     }
    //   } catch (err) {
    //     console.error('Summarizer check failed', err);
    //   }
    // }

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
    isStreaming: false,
    streamingMessageId: null,
    abortController: null,
  });

  let session: AILanguageModel | null = null;
  let pageContext = '';

  subscribe((state) => {
    window.sessionStorage.setItem('debug_chat_store', JSON.stringify(state));
  });

  console.log({ chrome });
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

      // Extract page content or use provided context
      if (providedPageContext) {
        pageContext = providedPageContext;
        // console.log('##HELIX pageContext (provided)', pageContext);
      } else {
        globalStorage().get('pageMarkdown', { whereKey: tabId.toString() });
        pageContext = await extractPageContent({ tabId });
        // console.log('##HELIX pageContext (extracted)', pageContext);
      }
    },

    /**
     * Set page context externally (for side panel mode)
     */
    setPageContext(context: string) {
      pageContext = context;
      console.log('##HELIX pageContext (set externally)', pageContext);
    },

    /**
     * Send a message to the AI
     */
    async sendMessage(userMessage: string, images?: string[]) {
      if (!userMessage.trim()) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: Date.now(),
        type: 'user',
        content: userMessage,
        images: images,
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
          console.log('##HELIX session 1', session);
        }

        // Send prompt to AI

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
        const errorMessage = getErrorMessage(err);

        // Add error message to chat
        const errorMsg = createErrorMessage(err);

        update((state) => ({
          ...state,
          messages: [...state.messages, errorMsg],
          isLoading: false,
          error: errorMessage,
        }));

        // Reset session on error
        safeDestroySession(session);
        session = null;
      }
    },

    async summarise(userMessage: string) {
      if (!userMessage.trim()) return;

      // Create abort controller for this streaming session
      const abortController = new AbortController();

      // Add user message
      const userMsg: ChatMessage = {
        id: Date.now(),
        type: 'user',
        content: userMessage,
        images: [],
        timestamp: new Date(),
      };

      // Create assistant message placeholder for streaming
      const assistantMsgId = Date.now() + 1;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      update((state) => ({
        ...state,
        messages: [...state.messages, userMsg, assistantMsg],
        isLoading: false,
        isStreaming: true,
        streamingMessageId: assistantMsgId,
        abortController,
        error: null,
        inputValue: '',
      }));

      if (typeof Summarizer === 'undefined') {
        throw new Error('Summarizer API not available');
      }

      const summarizer = await Summarizer.create({
        sharedContext: userMessage,
        type: 'tldr',
        format: 'markdown',
        length: 'short',
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            console.log(`Downloaded ${e.loaded * 100}%`);
          });
        },
      });

      const stream = summarizer.summarizeStreaming(userMessage, {
        signal: abortController.signal,
      });

      try {
        const streamTimeout = setTimeout(() => {
          console.warn('Stream timeout - falling back to regular prompt');
          throw new Error('Stream timeout');
        }, 30000); // 30 second timeout

        let hasReceivedChunks = false;
        let chunkCount = 0;

        // Wrap the stream iteration in a try-catch to handle Chrome AI specific errors
        try {
          for await (const chunk of stream) {
            // Check if streaming was aborted
            if (abortController.signal.aborted) {
              break;
            }

            clearTimeout(streamTimeout);
            hasReceivedChunks = true;
            chunkCount++;

            if (chunk && typeof chunk === 'string') {
              update((state) => {
                const updatedMessages = state.messages.map((msg) => {
                  if (msg.id === assistantMsgId) {
                    return {
                      ...msg,
                      content: msg.content + chunk,
                    };
                  }
                  return msg;
                });

                return {
                  ...state,
                  messages: updatedMessages,
                };
              });
            }
          }
        } catch (iterationError) {
          console.error('Error during stream iteration:', iterationError);
          // If we got some chunks before the error, continue with what we have
          if (hasReceivedChunks) {
            console.log(
              `Stream failed after ${chunkCount} chunks, but we have content`
            );
          } else {
            throw iterationError;
          }
        }

        clearTimeout(streamTimeout);

        // If no chunks were received, this might indicate an issue
        if (!hasReceivedChunks) {
          console.warn(
            'No chunks received from stream - falling back to regular prompt'
          );
          throw new Error('No chunks received from stream');
        }
      } catch (streamError) {
        console.error('Error processing stream chunks:', streamError);
        console.error('Stream error details:', getErrorDetails(streamError));
        throw streamError;
      }

      // Mark streaming as complete
      update((state) => ({
        ...state,
        isStreaming: false,
        streamingMessageId: null,
        abortController: null,
      }));
    },

    async translate(userMessage: string, targetLanguage: string) {
      if (!userMessage.trim()) return;

      // Create abort controller for this translation session
      const abortController = new AbortController();

      // Add user message with language context
      const userMsg: ChatMessage = {
        id: Date.now(),
        type: 'user',
        content: userMessage,
        images: [],
        timestamp: new Date(),
      };

      // Create assistant message placeholder for the translation
      const assistantMsgId = Date.now() + 1;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      update((state) => ({
        ...state,
        messages: [...state.messages, userMsg, assistantMsg],
        isLoading: false,
        isStreaming: true,
        streamingMessageId: assistantMsgId,
        abortController,
        error: null,
        inputValue: '',
      }));

      let detectedLanguage = 'en'; // Default fallback

      try {
        // Step 1: Detect the source language
        if (typeof LanguageDetector === 'undefined') {
          throw new Error('LanguageDetector API not available');
        }

        const detectorAvailability = await LanguageDetector.availability();
        if (detectorAvailability === 'unavailable') {
          throw new Error(
            'Language Detector is not available. Please enable it in Chrome flags.'
          );
        }

        const detector = await LanguageDetector.create({
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              console.log(`Language Detector Downloaded ${e.loaded * 100}%`);
            });
          },
        });

        const detectionResults = await detector.detect(userMessage);
        if (detectionResults && detectionResults.length > 0) {
          detectedLanguage = detectionResults[0].detectedLanguage;
          console.log(`Detected language: ${detectedLanguage}`);
        }

        detector.destroy();

        // Step 2: Check if translation is needed
        if (detectedLanguage === targetLanguage) {
          // Same language, show message instead of translating
          update((state) => {
            const updatedMessages = state.messages.map((msg) => {
              if (msg.id === assistantMsgId) {
                return {
                  ...msg,
                  content: `ℹ️ The text is already in ${targetLanguage}. No translation needed.`,
                };
              }
              return msg;
            });

            return {
              ...state,
              messages: updatedMessages,
              isLoading: false,
              isStreaming: false,
              streamingMessageId: null,
              abortController: null,
            };
          });
          return;
        }

        // Step 3: Create translator
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

        const translator = await Translator.create({
          sourceLanguage: detectedLanguage,
          targetLanguage,
          signal: abortController.signal,
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              console.log(`Translator Downloaded ${e.loaded * 100}%`);
            });
          },
        });

        // Step 4: Translate the text
        const translatedText = await translator.translate(userMessage);

        translator.destroy();

        // Step 5: Simulate streaming by breaking the translation into chunks
        const words = translatedText.split(' ');
        const chunkSize = Math.max(1, Math.ceil(words.length / 10)); // Break into ~10 chunks

        for (let i = 0; i < words.length; i += chunkSize) {
          // Check if streaming was aborted
          if (abortController.signal.aborted) {
            break;
          }

          const chunk = words.slice(i, i + chunkSize).join(' ');

          update((state) => {
            const updatedMessages = state.messages.map((msg) => {
              if (msg.id === assistantMsgId) {
                return {
                  ...msg,
                  content: msg.content + (msg.content ? ' ' : '') + chunk,
                };
              }
              return msg;
            });

            return {
              ...state,
              messages: updatedMessages,
            };
          });

          // Add a delay to simulate streaming
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        // Mark streaming as complete
        update((state) => ({
          ...state,
          isStreaming: false,
          streamingMessageId: null,
          abortController: null,
        }));
      } catch (err) {
        console.error('Translation error:', err);
        const errorMessage = getErrorMessage(err);

        // Update error message in chat
        update((state) => {
          const updatedMessages = state.messages.map((msg) => {
            if (msg.id === assistantMsgId) {
              return {
                ...msg,
                content: createErrorMessage(err).content,
              };
            }
            return msg;
          });

          return {
            ...state,
            messages: updatedMessages,
            isLoading: false,
            isStreaming: false,
            streamingMessageId: null,
            abortController: null,
            error: errorMessage,
          };
        });
      }
    },

    /**
     * Send a message to the AI with streaming response
     */
    async sendMessageStreaming(userMessage: string, images?: string[]) {
      if (!userMessage.trim()) return;

      // Create abort controller for this streaming session
      const abortController = new AbortController();

      // Add user message
      const userMsg: ChatMessage = {
        id: Date.now(),
        type: 'user',
        content: userMessage,
        images: images,
        timestamp: new Date(),
      };

      // Create assistant message placeholder for streaming
      const assistantMsgId = Date.now() + 1;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      update((state) => ({
        ...state,
        messages: [...state.messages, userMsg, assistantMsg],
        isLoading: false,
        isStreaming: true,
        streamingMessageId: assistantMsgId,
        abortController,
        error: null,
      }));

      try {
        // Create or reuse session with retry mechanism
        if (!session) {
          try {
            // const systemPromptAndPageContext = `${systemPrompt(
            //   7
            // )} ${pageContext}`;
            // IMPORTANT: runs 1st time only - session
            session = await createAISession(pageContext);
            console.log('##HELIX session 5', session);
          } catch (sessionError) {
            console.error('Failed to create AI session:', sessionError);
            throw new Error(
              `Failed to create AI session: ${getErrorMessage(sessionError)}`
            );
          }
        }

        // if (typeof session.promptStreaming !== 'function') {
        //   console.warn(
        //     'Session does not support streaming. Falling back to regular prompt.'
        //   );
        //   console.log('##HELIX session 2', session);
        //   // Fallback to regular prompt
        //   const aiResponse = await session.prompt(userMessage);

        //   // Update the streaming message with the complete response
        //   update((state) => {
        //     const updatedMessages = state.messages.map((msg) => {
        //       if (msg.id === assistantMsgId) {
        //         return {
        //           ...msg,
        //           content: aiResponse.trim(),
        //         };
        //       }
        //       return msg;
        //     });

        //     return {
        //       ...state,
        //       messages: updatedMessages,
        //       isStreaming: false,
        //       streamingMessageId: null,
        //     };
        //   });
        //   return;
        // }

        if (images && images.length > 0 && session) {
          for await (const image of images) {
            // Convert any image string to a PNG File before sending to the session
            const rawFile = await imageStringToFile(image, 'image');
            const file = await ensurePngFile(rawFile, 'image.png');

            console.log('Appending image!!!!');
            await session?.append([
              {
                role: 'user',
                content: [{ type: 'image', value: file }],
              },
            ]);
          }
        }

        // Create stream with error handling
        let stream;
        try {
          console.log('##HELIX session 3', {
            session,
            stream,
          });
          // IMPORTANT: working AI session - runs every prompt
          // Pass the actual user message, not pageContext (pageContext is already in systemPrompt)
          stream = session.promptStreaming(userMessage);
          console.log('##HELIX session 4', {
            session,
            stream,
          });
        } catch (streamCreationError) {
          console.error('Failed to create stream:', streamCreationError);
          throw new Error(
            `Failed to create stream: ${getErrorMessage(streamCreationError)}`
          );
        }

        // Process stream chunks with timeout and better error handling
        try {
          const streamTimeout = setTimeout(() => {
            console.warn('Stream timeout - falling back to regular prompt');
            throw new Error('Stream timeout');
          }, 30000); // 30 second timeout

          let hasReceivedChunks = false;
          let chunkCount = 0;

          // Wrap the stream iteration in a try-catch to handle Chrome AI specific errors
          try {
            for await (const chunk of stream) {
              // Check if streaming was aborted
              if (abortController.signal.aborted) {
                break;
              }

              clearTimeout(streamTimeout);
              hasReceivedChunks = true;
              chunkCount++;

              if (chunk && typeof chunk === 'string') {
                update((state) => {
                  const updatedMessages = state.messages.map((msg) => {
                    if (msg.id === assistantMsgId) {
                      return {
                        ...msg,
                        content: msg.content + chunk,
                      };
                    }
                    return msg;
                  });

                  return {
                    ...state,
                    messages: updatedMessages,
                  };
                });
              }
            }
          } catch (iterationError) {
            console.error('Error during stream iteration:', iterationError);
            // If we got some chunks before the error, continue with what we have
            if (hasReceivedChunks) {
              console.log(
                `Stream failed after ${chunkCount} chunks, but we have content`
              );
            } else {
              throw iterationError;
            }
          }

          clearTimeout(streamTimeout);

          // If no chunks were received, this might indicate an issue
          if (!hasReceivedChunks) {
            console.warn(
              'No chunks received from stream - falling back to regular prompt'
            );
            throw new Error('No chunks received from stream');
          }
        } catch (streamError) {
          console.error('Error processing stream chunks:', streamError);
          console.error('Stream error details:', getErrorDetails(streamError));
          throw streamError;
        }

        // Mark streaming as complete
        update((state) => ({
          ...state,
          isStreaming: false,
          streamingMessageId: null,
          abortController: null,
        }));
      } catch (err) {
        console.error('Streaming error:', err);
        const errorMessage = getErrorMessage(err);

        // // Try fallback to regular prompt if streaming fails
        // console.log('Attempting fallback to regular prompt...');
        // try {
        //   // Try with existing session first
        //   let aiResponse;
        //   try {
        //     if (!session) throw new Error('No session available');
        //     aiResponse = await session.prompt(userMessage);
        //   } catch (sessionError) {
        //     console.warn('Existing session failed, creating new session...');
        //     // Destroy old session and create new one
        //     safeDestroySession(session);
        //     session = null;

        //     // Create new session
        //     session = await createAISession(pageContext);
        //     aiResponse = await session.prompt(userMessage);
        //   }

        //   // Update the streaming message with the complete response
        //   update((state) => {
        //     const updatedMessages = state.messages.map((msg) => {
        //       if (msg.id === assistantMsgId) {
        //         return {
        //           ...msg,
        //           content: aiResponse.trim(),
        //         };
        //       }
        //       return msg;
        //     });

        //     return {
        //       ...state,
        //       messages: updatedMessages,
        //       isStreaming: false,
        //       streamingMessageId: null,
        //       error: null,
        //     };
        //   });

        //   console.log('Fallback to regular prompt successful');
        //   return;
        // } catch (fallbackError) {
        //   console.error('Fallback also failed:', fallbackError);
        // }

        // If fallback also fails, show error
        update((state) => {
          const updatedMessages = state.messages.map((msg) => {
            if (msg.id === assistantMsgId) {
              return {
                ...msg,
                content: createErrorMessage(err).content,
              };
            }
            return msg;
          });

          return {
            ...state,
            messages: updatedMessages,
            isStreaming: false,
            streamingMessageId: null,
            abortController: null,
            error: errorMessage,
          };
        });

        // Reset session on error
        safeDestroySession(session);
        session = null;
      }
    },

    /**
     * Stop current streaming
     */
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

    /**
     * Set messages directly (for state restoration)
     */
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

    /**
     * Clear all messages
     */
    clear() {
      safeDestroySession(session);
      session = null;
      // Send a message to the background script to clear the telescope state in Chrome storage (side panel integration)
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
              // No action needed on UI, this is just cleanup
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

    /**
     * Destroy session and cleanup
     */
    destroy() {
      safeDestroySession(session);
      session = null;
    },
  };
}

function getActiveTabId() {
  return new Promise<number>((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        resolve(tabs[0].id);
      } else {
        reject(new Error('No active tab found'));
      }
    });
  });
}

export const chatStore = createChatStore();
