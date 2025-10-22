declare namespace chrome {
  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      title?: string;
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
  }

  namespace runtime {
    function getURL(path: string): string;
    const lastError: { message: string } | undefined;

    // Fixed: onMessage should be an object, not a function
    const onMessage: {
      addListener(callback: (message: any) => void): void;
      removeListener(callback: (message: any) => void): void;
    };
  }

  namespace find {
    interface FindOptions {
      text: string;
      caseSensitive?: boolean;
      entireWord?: boolean;
      includeMatches?: boolean;
      matchDiacritics?: boolean;
    }

    interface FindResult {
      numberOfMatches: number;
      activeMatchOrdinal: number;
    }

    function find(query: FindOptions, callback?: (result: FindResult) => void): void;
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
}
