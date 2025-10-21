import { writable } from 'svelte/store';

export interface SearchResult {
  element: HTMLElement;
  text: string;
  index: number;
  highlighted: boolean;
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  currentIndex: number;
  totalResults: number;
  isVisible: boolean;
  isSearching: boolean;
  isAskMode: boolean;
  aiResponse: string;
}

export interface ChromeFindResult {
  numberOfMatches: number;
  activeMatchOrdinal: number;
}

// Create the search store
function createSearchStore() {
  const { subscribe, set, update } = writable<SearchState>({
    query: '',
    results: [],
    currentIndex: 0,
    totalResults: 0,
    isVisible: false,
    isSearching: false,
    isAskMode: false,
    aiResponse: '',
  });

  let highlightElements: HTMLElement[] = [];

  return {
    subscribe,

    // Show the search UI
    show: () => update((state) => ({ ...state, isVisible: true })),

    // Hide the search UI
    hide: () => {
      clearHighlights();
      update((state) => ({
        ...state,
        isVisible: false,
        query: '',
        results: [],
        currentIndex: 0,
        totalResults: 0,
      }));
    },

    // Perform search using Chrome's built-in find API
    search: (query: string) => {
      if (!query.trim()) {
        // Clear Chrome highlighting
        if (chrome?.find) {
          chrome.find.removeHighlighting();
        }
        update((state) => ({
          ...state,
          query: '',
          results: [],
          currentIndex: 0,
          totalResults: 0,
          isSearching: false,
          isAskMode: false,
        }));
        return;
      }

      update((state) => ({
        ...state,
        isSearching: true,
        query,
        isAskMode: false,
      }));

      // Use Chrome's built-in find API
      if (chrome?.find) {
        chrome.find.find(
          {
            text: query,
            caseSensitive: false,
            entireWord: false,
            includeMatches: true,
          },
          (result: ChromeFindResult) => {
            update((state) => ({
              ...state,
              totalResults: result.numberOfMatches,
              currentIndex: result.activeMatchOrdinal - 1, // Chrome uses 1-based indexing
              isSearching: false,
            }));
          }
        );
      } else {
        // Fallback to custom search if Chrome API is not available
        performCustomSearch(query);
      }
    },

    // Set ask mode (AI will be handled by chatStore)
    setAskMode: (isAskMode: boolean) => {
      update((state) => ({
        ...state,
        isAskMode,
        aiResponse: isAskMode ? '' : state.aiResponse,
      }));
    },

    // Navigate to next result using Chrome's find API
    next: () => {
      if (chrome?.find) {
        chrome.find.find(
          {
            text: '', // Empty text to navigate to next
            caseSensitive: false,
            entireWord: false,
            includeMatches: true,
          },
          (result: ChromeFindResult) => {
            update((state) => ({
              ...state,
              currentIndex: result.activeMatchOrdinal - 1,
              totalResults: result.numberOfMatches,
            }));
          }
        );
      }
    },

    // Navigate to previous result using Chrome's find API
    previous: () => {
      if (chrome?.find) {
        // Chrome doesn't have a direct "previous" method, so we'll use a workaround
        // by searching again and cycling through results
        chrome.find.find(
          {
            text: '', // Empty text to navigate to previous
            caseSensitive: false,
            entireWord: false,
            includeMatches: true,
          },
          (result: ChromeFindResult) => {
            update((state) => ({
              ...state,
              currentIndex: result.activeMatchOrdinal - 1,
              totalResults: result.numberOfMatches,
            }));
          }
        );
      }
    },

    // Clear all highlights
    clearHighlights: () => {
      if (chrome?.find) {
        chrome.find.removeHighlighting();
      } else {
        clearHighlights();
      }
    },
  };

  // Fallback custom search function
  function performCustomSearch(query: string) {
    // Clear previous highlights
    clearHighlights();

    // Find all text nodes that contain the query
    const results: SearchResult[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.textContent || '';
          return text.toLowerCase().includes(query.toLowerCase())
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      }
    );

    let index = 0;
    let node: Text | null;

    while ((node = walker.nextNode() as Text | null)) {
      const text = node.textContent || '';
      const regex = new RegExp(`(${query})`, 'gi');
      const matches = [...text.matchAll(regex)];

      for (const match of matches) {
        if (match.index !== undefined) {
          // Create a wrapper element for highlighting
          const wrapper = document.createElement('span');
          wrapper.className = 'telescope-search-highlight';
          wrapper.setAttribute('data-search-index', index.toString());

          // Split the text and wrap the match
          const beforeText = text.substring(0, match.index);
          const matchText = text.substring(
            match.index,
            match.index + match[0].length
          );
          const afterText = text.substring(match.index + match[0].length);

          wrapper.innerHTML = `${beforeText}<mark class="telescope-search-match">${matchText}</mark>${afterText}`;

          // Replace the text node with our wrapper
          node.parentNode?.replaceChild(wrapper, node);

          results.push({
            element: wrapper,
            text: matchText,
            index,
            highlighted: false,
          });

          highlightElements.push(wrapper);
          index++;
        }
      }
    }

    update((state) => ({
      ...state,
      results,
      totalResults: results.length,
      currentIndex: 0,
      isSearching: false,
    }));

    // Highlight the first result
    if (results.length > 0) {
      highlightResult(0);
    }
  }

  function clearHighlights() {
    highlightElements.forEach((element) => {
      const parent = element.parentNode;
      if (parent) {
        // Replace the wrapper with just the text content
        const textNode = document.createTextNode(element.textContent || '');
        parent.replaceChild(textNode, element);
      }
    });
    highlightElements = [];
  }

  function highlightResult(index: number) {
    // Remove previous highlights
    document.querySelectorAll('.telescope-search-current').forEach((el) => {
      el.classList.remove('telescope-search-current');
    });

    // Add highlight to current result
    const currentResult = document.querySelector(
      `[data-search-index="${index}"]`
    );
    if (currentResult) {
      currentResult.classList.add('telescope-search-current');
    }
  }

  function scrollToResult(index: number) {
    const result = document.querySelector(`[data-search-index="${index}"]`);
    if (result) {
      result.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  }
}

export const searchStore = createSearchStore();

// Add CSS for search highlighting
const style = document.createElement('style');
style.textContent = `
  .telescope-search-highlight {
    position: relative;
  }

  .telescope-search-highlight .telescope-search-match {
    background-color: #fbbf24;
    color: #000;
    padding: 1px 2px;
    border-radius: 2px;
    font-weight: 500;
  }

  .telescope-search-current .telescope-search-match {
    background-color: #3b82f6;
    color: white;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
  }
`;
document.head.appendChild(style);
