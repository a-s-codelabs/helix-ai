import { writable } from 'svelte/store';
import {
  imageStringToFile,
  base64ToFile as utilsBase64ToFile,
  ensurePngFile,
} from '../utils/file';
import { globalStorage } from '../globalStorage';
import { createErrorMessage, getErrorDetails, getErrorMessage, safeDestroySession } from './helper';
import { extractPageContent } from './extract-helper';
import { monitorHelperSync } from './monitor-helper';

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
      addEventListener: (
        type: string,
        listener: (e: any) => void
      ) => void;
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
      if (availability === 'readily' || availability === 'available') {
        const session = await LanguageModel.create({
          ...config,
          monitor(m) {
            const createdAt = Date.now()
            m.addEventListener('downloadprogress', (e) => {
              monitorHelperSync({ source: 'prompt', loaded: e.loaded, createdAt, options: {} });
            });
          },
        });
        return session;
      }
      if (availability === 'downloadable') {
        const session = await LanguageModel.create({
          ...config,
          monitor(m) {
            const createdAt = Date.now()
            m.addEventListener('downloadprogress', (e) => {
              monitorHelperSync({ source: 'prompt', loaded: e.loaded, createdAt, options: {} });
            });
          },
        });

        throw new Error(
          'AI model is downloading. Check progress at chrome://components'
        );
      }
    } catch (err) {
      console.error('Global LanguageModel failed, trying window.ai...', err);
    }
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
        message: '❌ Window object not available',
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
        if (!session) {
          session = await createAISession(pageContext);
        }


        const aiResponse = await session.prompt(userMessage);

        if (!aiResponse || typeof aiResponse !== 'string') {
          throw new Error('Invalid response from AI model');
        }

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

      const userMsg: ChatMessage = {
        id: Date.now(),
        type: 'user',
        content: userMessage,
        images: [],
        timestamp: new Date(),
      };

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
          const createdAt = Date.now()
          m.addEventListener('downloadprogress', (e) => {
            monitorHelperSync({ source: 'summarize', loaded: e.loaded, createdAt, options: { type: 'tldr', format: 'markdown', length: 'short' } });
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

        try {
          for await (const chunk of stream) {
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
          if (hasReceivedChunks) {
            console.log(
              `Stream failed after ${chunkCount} chunks, but we have content`
            );
          } else {
            throw iterationError;
          }
        }

        clearTimeout(streamTimeout);

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

      update((state) => ({
        ...state,
        isStreaming: false,
        streamingMessageId: null,
        abortController: null,
      }));
    },

    async translate(userMessage: string, targetLanguage: string) {
      if (!userMessage.trim()) return;

      const abortController = new AbortController();

      const userMsg: ChatMessage = {
        id: Date.now(),
        type: 'user',
        content: userMessage,
        images: [],
        timestamp: new Date(),
      };

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
            const createdAt = Date.now()
            m.addEventListener('downloadprogress', (e) => {
              monitorHelperSync({ source: 'language-detector', loaded: e.loaded, createdAt, options: { sourceLanguage: detectedLanguage, targetLanguage } });
            });
          },
        });

        const detectionResults = await detector.detect(userMessage);
        if (detectionResults && detectionResults.length > 0) {
          detectedLanguage = detectionResults[0].detectedLanguage;
        }

        detector.destroy();

        if (detectedLanguage === targetLanguage) {
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
            const createdAt = Date.now()
            m.addEventListener('downloadprogress', (e) => {
              monitorHelperSync({ source: 'translator', loaded: e.loaded, createdAt, options: { sourceLanguage: detectedLanguage, targetLanguage } });
            });
          },
        });

        const translatedText = await translator.translate(userMessage);

        translator.destroy();

        const words = translatedText.split(' ');
        const chunkSize = Math.max(1, Math.ceil(words.length / 10));

        for (let i = 0; i < words.length; i += chunkSize) {
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

          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        update((state) => ({
          ...state,
          isStreaming: false,
          streamingMessageId: null,
          abortController: null,
        }));
      } catch (err) {
        console.error('Translation error:', err);
        const errorMessage = getErrorMessage(err);

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

      const abortController = new AbortController();

      const userMsg: ChatMessage = {
        id: Date.now(),
        type: 'user',
        content: userMessage,
        images: images,
        timestamp: new Date(),
      };

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
        if (!session) {
          try {
            session = await createAISession(pageContext);
          } catch (sessionError) {
            console.error('Failed to create AI session:', sessionError);
            throw new Error(
              `Failed to create AI session: ${getErrorMessage(sessionError)}`
            );
          }
        }

        if (images && images.length > 0 && session) {
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

        let stream;
        try {
          stream = session.promptStreaming(userMessage);

        } catch (streamCreationError) {
          console.error('Failed to create stream:', streamCreationError);
          throw new Error(
            `Failed to create stream: ${getErrorMessage(streamCreationError)}`
          );
        }

        try {
          const streamTimeout = setTimeout(() => {
            console.warn('Stream timeout - falling back to regular prompt');
            throw new Error('Stream timeout');
          }, 30000); // 30 second timeout

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
            if (hasReceivedChunks) {
              console.log(
                `Stream failed after ${chunkCount} chunks, but we have content`
              );
            } else {
              throw iterationError;
            }
          }

          clearTimeout(streamTimeout);

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

        update((state) => ({
          ...state,
          isStreaming: false,
          streamingMessageId: null,
          abortController: null,
        }));
      } catch (err) {
        console.error('Streaming error:', err);
        const errorMessage = getErrorMessage(err);

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
