import { writable } from 'svelte/store';
import type { Message } from '../entrypoints/telescope-ui/type';

export type ModelConfig = {
  id: string;
  name: string;
  provider: 'openai' | 'gemini';
  model: string;
};

export const AVAILABLE_MODELS: ModelConfig[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', model: 'gpt-4o' },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
  },
  { id: 'o3-mini', name: 'O3 Mini', provider: 'openai', model: 'o3-mini' },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    model: 'gemini-2.5-pro',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'gemini',
    model: 'gemini-2.5-flash-lite',
  },
];

export type ModelResponseState = {
  messages: Message[];
  isStreaming: boolean;
  streamingMessageId: number | null;
  error: string | null;
  isLoading: boolean;
};

export type MultiModelState = {
  activeModel: string | null;
  modelResponses: Record<string, ModelResponseState>;
  enabledModels: string[];
};

function createMultiModelStore() {
  const defaultState: MultiModelState = {
    activeModel: null,
    modelResponses: {},
    enabledModels: AVAILABLE_MODELS.map((m) => m.id),
  };

  const { subscribe, set, update } = writable<MultiModelState>(defaultState);

  return {
    subscribe,

    setActiveModel(modelId: string) {
      update((state) => ({
        ...state,
        activeModel: modelId,
      }));
    },

    setEnabledModels(modelIds: string[]) {
      update((state) => ({
        ...state,
        enabledModels: modelIds,
        activeModel: modelIds[0] || null,
      }));
    },

    initializeModelResponses(modelIds: string[]) {
      update((state) => {
        const modelResponses: Record<string, ModelResponseState> = {};
        for (const modelId of modelIds) {
          modelResponses[modelId] = {
            messages: [],
            isStreaming: false,
            streamingMessageId: null,
            error: null,
            isLoading: false,
          };
        }
        return {
          ...state,
          modelResponses,
          activeModel: modelIds[0] || null,
        };
      });
    },

    addUserMessage(modelId: string, message: Message) {
      update((state) => {
        const modelState = state.modelResponses[modelId];
        if (!modelState) return state;

        return {
          ...state,
          modelResponses: {
            ...state.modelResponses,
            [modelId]: {
              ...modelState,
              messages: [...modelState.messages, message],
            },
          },
        };
      });
    },

    addAssistantMessage(modelId: string, message: Message) {
      update((state) => {
        const modelState = state.modelResponses[modelId];
        if (!modelState) return state;

        return {
          ...state,
          modelResponses: {
            ...state.modelResponses,
            [modelId]: {
              ...modelState,
              messages: [...modelState.messages, message],
            },
          },
        };
      });
    },

    updateStreamingState(
      modelId: string,
      isStreaming: boolean,
      streamingMessageId: number | null
    ) {
      update((state) => {
        const modelState = state.modelResponses[modelId];
        if (!modelState) return state;

        return {
          ...state,
          modelResponses: {
            ...state.modelResponses,
            [modelId]: {
              ...modelState,
              isStreaming,
              streamingMessageId,
            },
          },
        };
      });
    },

    appendToStreamingMessage(
      modelId: string,
      messageId: number,
      chunk: string
    ) {
      update((state) => {
        const modelState = state.modelResponses[modelId];
        if (!modelState) return state;

        const updatedMessages = modelState.messages.map((msg) => {
          if (msg.id === messageId) {
            return { ...msg, content: msg.content + chunk };
          }
          return msg;
        });

        return {
          ...state,
          modelResponses: {
            ...state.modelResponses,
            [modelId]: {
              ...modelState,
              messages: updatedMessages,
            },
          },
        };
      });
    },

    updateMessageContent(modelId: string, messageId: number, content: string) {
      update((state) => {
        const modelState = state.modelResponses[modelId];
        if (!modelState) return state;

        const updatedMessages = modelState.messages.map((msg) => {
          if (msg.id === messageId) {
            return { ...msg, content };
          }
          return msg;
        });

        return {
          ...state,
          modelResponses: {
            ...state.modelResponses,
            [modelId]: {
              ...modelState,
              messages: updatedMessages,
            },
          },
        };
      });
    },

    setError(modelId: string, error: string | null) {
      update((state) => {
        const modelState = state.modelResponses[modelId];
        if (!modelState) return state;

        return {
          ...state,
          modelResponses: {
            ...state.modelResponses,
            [modelId]: {
              ...modelState,
              error,
              isLoading: false,
              isStreaming: false,
              streamingMessageId: null,
            },
          },
        };
      });
    },

    setLoading(modelId: string, isLoading: boolean) {
      update((state) => {
        const modelState = state.modelResponses[modelId];
        if (!modelState) return state;

        return {
          ...state,
          modelResponses: {
            ...state.modelResponses,
            [modelId]: {
              ...modelState,
              isLoading,
            },
          },
        };
      });
    },

    clear() {
      set(defaultState);
    },

    clearModel(modelId: string) {
      update((state) => {
        const modelState = state.modelResponses[modelId];
        if (!modelState) return state;

        return {
          ...state,
          modelResponses: {
            ...state.modelResponses,
            [modelId]: {
              messages: [],
              isStreaming: false,
              streamingMessageId: null,
              error: null,
              isLoading: false,
            },
          },
        };
      });
    },
  };
}

export const multiModelStore = createMultiModelStore();
