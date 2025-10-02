declare namespace chrome {
  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      title?: string;
    }
    
    function query(queryInfo: { active: boolean; currentWindow: boolean }, callback: (tabs: Tab[]) => void): void;
    function sendMessage(tabId: number, message: any, callback?: (response: any) => void): void;
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
}
