type TabId = `tab_id_${number}`;

export type InputIntent =
  | 'translator'
  | 'summarize'
  | 'prompt'
  | 'writer'
  | 'rewriter';
export type Source =
  | 'translator'
  | 'summarize'
  | 'prompt'
  | 'writer'
  | 'rewriter'
  | 'language-detector';

export const DB_SCHEMA = {
  config: {
    storageKey: 'local:global:config' as const,
    default: {
      version: '0.0.1',
      userLang: 'en',
      maxTopK: 100 as number | undefined,
      maxTemperature: 1.0 as number | undefined,
      floatingTelescopeEnabled: true,
      selectionTelescopeEnabled: true,
    },
  },
  tabIds: {
    storageKey: 'local:global:tabIds' as const,
    default: [] as number[],
  },
  downloadStatus: {
    storageKey: 'local:global:downloadStatus' as const,
    maxLimit: 10,
    default: {} as Record<
      string,
      {
        isDownloading: boolean | undefined;
        loaded: number | undefined;
        // total: number | undefined;
        uniqueKey: string;
        source: Source;
        createdAt: number;
      }
    >,
  },
  pageMarkdown: {
    storageKey: 'local:global:pageMarkdown' as const,
    default: {} as Record<TabId, string>,
    maxLimit: 100,
  },
  state_tabId_message: {
    storageKey: 'local:state_tabId_message' as const,
    default: {} as Record<
      number,
      {
        messages: {
          id: number;
          role: 'user' | 'assistant' | 'system';
          content: string;
          timestamp: number;
          source: 'append' | 'move' | 'addtochat';
          actionSource: 'summarise' | 'translate' | 'prompt';
        }[];
      }
    >,
  },
  action_state: {
    storageKey: 'local:global:action_state' as const,
    default: {} as {
      // isStreaming: boolean;
      // streamingId: number | null;
    } & (
      | {
          actionSource: 'addToChat';
          content: string;
        }
      | {
          actionSource: 'summarise';
          content: string;
        }
      | {
          actionSource: 'translate';
          content: string;
          targetLanguage: string | null;
        }
      | {
          actionSource: 'input-options';
          messages: {
            id: number;
            role: 'user' | 'assistant' | 'system';
            content: string;
            timestamp: number;
            source: 'append' | 'move' | 'addtochat';
            actionSource: InputIntent;
          }[];
        }
      | {
          actionSource: 'popup';
        }
      | {
          actionSource: 'context-image';
          content: string;
        }
    ),
  },
  telescopeSettings: {
    storageKey: 'local:global:telescopeSettings' as const,
    default: {} as Record<string, Record<string, string | number>>,
  },
};
export type DBStorageKey = keyof typeof DB_SCHEMA;

export type ExtractColumnType<T extends DBStorageKey> =
  T extends keyof typeof DB_SCHEMA ? (typeof DB_SCHEMA)[T]['default'] : never;
