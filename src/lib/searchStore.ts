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
}

// Create the search store
function createSearchStore() {
  const { subscribe, set, update } = writable<SearchState>({
    query: '',
    results: [],
    currentIndex: 0,
    totalResults: 0,
    isVisible: false,
    isSearching: false
  });

  let highlightElements: HTMLElement[] = [];

  return {
    subscribe,
    
    // Show the search UI
    show: () => update(state => ({ ...state, isVisible: true })),
    
    // Hide the search UI
    hide: () => {
      clearHighlights();
      update(state => ({ 
        ...state, 
        isVisible: false, 
        query: '', 
        results: [], 
        currentIndex: 0, 
        totalResults: 0 
      }));
    },
    
    // Perform search
    search: (query: string) => {
      if (!query.trim()) {
        clearHighlights();
        update(state => ({ 
          ...state, 
          query: '', 
          results: [], 
          currentIndex: 0, 
          totalResults: 0,
          isSearching: false 
        }));
        return;
      }

      update(state => ({ ...state, isSearching: true, query }));

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
          }
        }
      );

      let index = 0;
      let node: Text | null;
      
      while (node = walker.nextNode() as Text | null) {
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
            const matchText = text.substring(match.index, match.index + match[0].length);
            const afterText = text.substring(match.index + match[0].length);
            
            wrapper.innerHTML = `${beforeText}<mark class="telescope-search-match">${matchText}</mark>${afterText}`;
            
            // Replace the text node with our wrapper
            node.parentNode?.replaceChild(wrapper, node);
            
            results.push({
              element: wrapper,
              text: matchText,
              index,
              highlighted: false
            });
            
            highlightElements.push(wrapper);
            index++;
          }
        }
      }

      update(state => ({ 
        ...state, 
        results, 
        totalResults: results.length, 
        currentIndex: 0,
        isSearching: false 
      }));

      // Highlight the first result
      if (results.length > 0) {
        highlightResult(0);
      }
    },
    
    // Navigate to next result
    next: () => {
      update(state => {
        if (state.results.length === 0) return state;
        
        const newIndex = (state.currentIndex + 1) % state.results.length;
        highlightResult(newIndex);
        scrollToResult(newIndex);
        
        return { ...state, currentIndex: newIndex };
      });
    },
    
    // Navigate to previous result
    previous: () => {
      update(state => {
        if (state.results.length === 0) return state;
        
        const newIndex = state.currentIndex === 0 
          ? state.results.length - 1 
          : state.currentIndex - 1;
        highlightResult(newIndex);
        scrollToResult(newIndex);
        
        return { ...state, currentIndex: newIndex };
      });
    },
    
    // Clear all highlights
    clearHighlights: () => {
      clearHighlights();
    }
  };

  function clearHighlights() {
    highlightElements.forEach(element => {
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
    document.querySelectorAll('.telescope-search-current').forEach(el => {
      el.classList.remove('telescope-search-current');
    });

    // Add highlight to current result
    const currentResult = document.querySelector(`[data-search-index="${index}"]`);
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
        inline: 'nearest'
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
