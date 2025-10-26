# Chrome Search and AI Integration Test

## Overview
This document describes how to test the Chrome built-in search and AI integration in the Helix AI extension.

## Features Implemented

### 1. Chrome Built-in Search
- Uses `chrome.find` API for native search functionality
- Provides fallback to custom DOM search if Chrome API is unavailable
- Supports case-insensitive search with highlighting
- Navigation between search results using up/down arrows

### 2. Chrome AI Integration
- Uses `chrome.ml.generateText` API for AI responses
- Provides fallback response when Chrome AI is unavailable
- Automatically detects questions vs search queries
- Displays AI responses in chat format

### 3. Smart Input Detection
The system automatically detects whether input is a search query or a question based on:
- Question marks (?)
- Question words: what, how, why, when, where, who
- Question phrases: explain, tell me, can you

## Testing Instructions

### Test Chrome Search
1. Open the extension (Ctrl+E or Cmd+E)
2. Type a search term (e.g., "button", "text", "image")
3. Verify that Chrome's native search highlighting appears
4. Use up/down arrows to navigate between results
5. Verify result counter shows correct numbers

### Test Chrome AI
1. Open the extension (Ctrl+E or Cmd+E)
2. Type a question (e.g., "What is this page about?", "How does this work?")
3. Click "Ask" button or press Enter
4. Verify AI response appears in chat format
5. Check that the response is relevant to the question

### Test Fallback Behavior
1. Test in environments where Chrome APIs might not be available
2. Verify custom search still works
3. Verify placeholder AI responses are shown

## API Usage

### Chrome Find API
```typescript
chrome.find.find({
  text: query,
  caseSensitive: false,
  entireWord: false,
  includeMatches: true
}, (result) => {
  // Handle search results
});
```

### Chrome AI API
```typescript
chrome.ml.generateText({
  text: query,
  maxTokens: 500,
  temperature: 0.7
}, (result) => {
  // Handle AI response
});
```

## Browser Compatibility
- Chrome/Chromium browsers with extension APIs
- Fallback support for other browsers
- Progressive enhancement approach

## Notes
- Chrome AI APIs are experimental and may not be available in all contexts
- The extension gracefully degrades when APIs are unavailable
- Search functionality works on any webpage
- AI responses are contextual to the current page content

