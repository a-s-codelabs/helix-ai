declare namespace chrome {

  namespace runtime {
    function getURL(path: string): string;
    function sendMessage(
      message: any,
      callback?: (response: any) => void
    ): void;
    const lastError: { message: string } | undefined;

    // Fixed: onMessage should be an object, not a function
    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: any,
          sendResponse: any
        ) => void | boolean
      ): void;
      removeListener(
        callback: (
          message: any,
          sender: any,
          sendResponse: any
        ) => void | boolean
      ): void;
    };
  }

  namespace storage {
    namespace local {
      function get(
        keys: string | string[] | object,
        callback: (result: any) => void
      ): void;
      function set(items: object, callback?: () => void): void;
      function remove(keys: string | string[], callback?: () => void): void;
    }
  }

  namespace sidePanel {
    interface PanelBehavior {
      openPanelOnActionClick?: boolean;
    }

    interface PanelOptions {
      enabled?: boolean;
      path?: string;
      tabId?: number;
    }

    interface OpenOptions {
      tabId?: number;
      windowId?: number;
    }

    function setPanelBehavior(behavior: PanelBehavior): Promise<void>;
    function setOptions(options: PanelOptions): Promise<void>;
    function open(options: OpenOptions): Promise<void>;

    const onOpened: {
      addListener(callback: (info: any) => void): void;
    };
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      title?: string;
      windowId?: number;
    }

    function query(
      queryInfo: { active: boolean; currentWindow: boolean },
      callback: (tabs: Tab[]) => void
    ): void;
    function sendMessage(
      tabId: number,
      message: any,
      callback?: (response: any) => void
    ): void;
    function create(createProperties: { url: string }): void;

    const onUpdated: {
      addListener(
        callback: (tabId: number, changeInfo: any, tab: Tab) => void
      ): void;
    };
  }

  // namespace find {
  //   interface FindOptions {
  //     text: string;
  //     caseSensitive?: boolean;
  //     entireWord?: boolean;
  //     includeMatches?: boolean;
  //     matchDiacritics?: boolean;
  //   }

    // interface FindResult {
    //   numberOfMatches: number;
    //   activeMatchOrdinal: number;
    // }

    // function find(query: FindOptions, callback?: (result: FindResult) => void): void;
    function highlightResults(): void;
    function removeHighlighting(): void;
  }

  namespace omnibox {
    interface SuggestResult {
      content: string;
      description: string;
    }

    function setDefaultSuggestion(suggestion: { description: string }): void;
    const onInputChanged: {
      addListener(callback: (text: string, suggest: (results: SuggestResult[]) => void) => void): void;
    };
    const onInputEntered: {
      addListener(callback: (text: string, disposition: string) => void): void;
    };
  }

  // Chrome AI/ML APIs (experimental)
  namespace ml {
    interface TextGenerationOptions {
      text: string;
      maxTokens?: number;
      temperature?: number;
    }

    interface TextGenerationResult {
      text: string;
      confidence: number;
    }

    function generateText(options: TextGenerationOptions, callback: (result: TextGenerationResult) => void): void;
  }

