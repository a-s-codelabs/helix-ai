# Side Panel Page Content Fix

## Problem

The side panel was not receiving page content because it runs in a different context (extension page) and couldn't directly access the current tab's DOM.

## Solution

Implemented a message-passing system to fetch page content from the active tab's content script.

## Changes Made

### 1. Modified `src/lib/chatStore.ts`

- Added optional `providedPageContext` parameter to `init()` method
- Added `setPageContext()` method to set page context externally
- Now supports both direct extraction (content script mode) and external provision (side panel mode)

### 2. Modified `src/entrypoints/background.ts`

- Added `GET_PAGE_CONTENT` message handler
- Queries for active tab and forwards request to content script
- Returns page content back to the side panel

### 3. Modified `src/entrypoints/content.ts`

- Added `EXTRACT_PAGE_CONTENT` message handler
- Extracts page content using the markdown converters
- Sends page context back to background script

### 4. Modified `src/lib/sidePanelStore.ts`

- Added `getPageContent()` utility function
- Requests page content from background script
- Handles timeouts and errors gracefully

### 5. Modified `src/entrypoints/telescope-ui/App.svelte`

- Detects when running in side panel mode
- Fetches page content using `sidePanelUtils.getPageContent()` before initializing chat
- Falls back to direct extraction in content script mode

## Message Flow

```
Side Panel (App.svelte)
    ↓ (calls getPageContent)
sidePanelStore.ts
    ↓ (sends GET_PAGE_CONTENT message)
Background Script
    ↓ (queries active tab)
    ↓ (sends EXTRACT_PAGE_CONTENT to content script)
Content Script (active tab)
    ↓ (extracts page content)
    ↓ (sends back page context)
Background Script
    ↓ (forwards page context)
Side Panel
    ↓ (initializes chatStore with page context)
Chat Store (ready with page content)
```

## Testing

To test this fix:

1. Open the extension in Chrome
2. Navigate to any webpage
3. Open the side panel
4. Check the console for these messages:
   - "App: In side panel mode, fetching page content..."
   - "Background: Received GET_PAGE_CONTENT message"
   - "Content script: Received EXTRACT_PAGE_CONTENT request"
   - "Background: Received page content from content script"
   - "App: Received page content, initializing chat store"
5. Try asking a question about the page content in the chat

## Error Handling

- Handles cases where content script is not loaded (shows error message)
- Handles timeouts (10 second timeout for page content request)
- Falls back to initialization without context if page content fetch fails
- Provides fallback text extraction if markdown conversion fails
