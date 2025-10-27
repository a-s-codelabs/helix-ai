type TabId = `tab_id_${number}`;

export const DB_SCHEMA = {
  config: {
    storageKey: 'local:global:config' as const,
    default: {
      version: '0.0.1',
      userLang: "en",
      maxTopK: 100 as number | undefined,
      maxTemperature: 1.0 as number | undefined,
    },
  },
  tabIds: {
    storageKey: 'local:global:tabIds' as const,
    default: [] as number[],
  },
  downloadStatus: {
    storageKey: 'local:global:downloadStatus' as const,
    default: [] as {
      isDownloading: boolean | undefined;
      progress: number | undefined;
      total: number | undefined;
      uniqueKey: `${"translate" | "summarize" | "prompt"}-${string}`;
      source: string;
    }[],
  },
  pageMarkdown: {
    storageKey: 'local:global:pageMarkdown' as const,
    default: {} as Record<TabId, string>,
    maxLimit: 100,
  },
  state_tabId_message: {
    storageKey: 'local:state_tabId_message' as const,
    default: {} as Record<number, {
      messages: {
        id: number;
        role: "user" | "assistant" | "system";
        content: string;
        timestamp: number;
        source: "append" | "move" | "addtochat";
        actionSource: "summarise" | "translate" | "prompt";
      }[];
    }>,
  }
}
export type DBStorageKey = keyof typeof DB_SCHEMA;


export type ExtractColumnType<T extends DBStorageKey> = T extends keyof typeof DB_SCHEMA ? (typeof DB_SCHEMA[T])['default'] : never;
