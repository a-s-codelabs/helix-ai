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
    namespace StorageChange {
      function addListener(callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void): void;
      function removeListener(callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void): void;
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

  // Chrome Built-in AI APIs
  namespace ai {
    // Writer API
    interface WriterCreateOptions {
      tone?: 'formal' | 'neutral' | 'casual';
      format?: 'markdown' | 'plain-text';
      length?: 'short' | 'medium' | 'long';
      sharedContext?: string;
      outputLanguage?: string;
      expectedInputLanguages?: string[];
      expectedContextLanguages?: string[];
    }

    interface WriterInstance {
      write(prompt: string, options?: { context?: string }): Promise<string>;
      writeStreaming(prompt: string, options?: { context?: string }): AsyncGenerator<string>;
      destroy(): void;
    }

    interface Writer {
      availability(): Promise<'available' | 'after-download' | 'unavailable'>;
      create(options?: WriterCreateOptions): Promise<WriterInstance>;
    }

    // Rewriter API
    interface RewriterCreateOptions {
      tone?: 'as-is' | 'more-formal' | 'more-casual';
      format?: 'as-is' | 'markdown' | 'plain-text';
      length?: 'as-is' | 'shorter' | 'longer';
      sharedContext?: string;
      outputLanguage?: string;
      expectedInputLanguages?: string[];
      expectedContextLanguages?: string[];
    }

    interface RewriterInstance {
      rewrite(text: string, options?: { context?: string }): Promise<string>;
      rewriteStreaming(text: string, options?: { context?: string }): AsyncGenerator<string>;
      destroy(): void;
    }

    interface Rewriter {
      availability(): Promise<'available' | 'after-download' | 'unavailable'>;
      create(options?: RewriterCreateOptions): Promise<RewriterInstance>;
    }

    // Proofreader API
    interface ProofreaderCreateOptions {
      expectedInputLanguages?: string[];
    }

    interface ProofreadCorrection {
      startIndex: number;
      endIndex: number;
      correctionType: string;
      explanation?: string;
    }

    interface ProofreadResult {
      corrected: string;
      corrections: ProofreadCorrection[];
    }

    interface ProofreaderInstance {
      proofread(text: string): Promise<ProofreadResult>;
      destroy(): void;
    }

    interface Proofreader {
      availability(): Promise<'available' | 'after-download' | 'unavailable'>;
      create(options?: ProofreaderCreateOptions): Promise<ProofreaderInstance>;
    }
  }
}

// Global AI API declarations
declare const Writer: chrome.ai.Writer;
declare const Rewriter: chrome.ai.Rewriter;
declare const Proofreader: chrome.ai.Proofreader;

// Type aliases for easier usage
type WriterInstance = chrome.ai.WriterInstance;
type WriterCreateOptions = chrome.ai.WriterCreateOptions;
type RewriterInstance = chrome.ai.RewriterInstance;
type RewriterCreateOptions = chrome.ai.RewriterCreateOptions;
type ProofreaderInstance = chrome.ai.ProofreaderInstance;
type ProofreaderCreateOptions = chrome.ai.ProofreaderCreateOptions;
type ProofreadResult = chrome.ai.ProofreadResult;
type ProofreadCorrection = chrome.ai.ProofreadCorrection;

