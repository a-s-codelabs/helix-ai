# Telescope Features Integration

This document describes the integration of Telescope AI features into the Helix browser extension.

## Overview

Telescope features have been successfully integrated into Helix, bringing AI-powered page analysis and search capabilities to the extension.

## Features Integrated

### 1. **AI Chat with Chrome Built-in AI**
- Integrated Chrome's Built-in AI (Gemini Nano) support
- Multiple API variants supported:
  - `window.ai.languageModel` (Official Chrome Prompt API)
  - Global `LanguageModel` (Alternative API)
  - `Summarizer` API (Fallback for summarization)
- Context-aware chat that understands the current page content
- Message history tracking

### 2. **Page Content Extraction**
- Automatically extracts relevant content from the current page
- Provides context to AI for better responses
- Smart extraction of headings, paragraphs, lists, and tables

### 3. **Dual-Mode Interface**
- **Search Mode**: Real-time page search with highlighting
- **AI Chat Mode**: Conversational AI assistant for page analysis
- Automatic mode switching based on user input

### 4. **State Management**
- `chatStore.ts`: Manages AI chat state, sessions, and messages
- `searchStore.ts`: Manages search functionality (existing)
- Clean separation of concerns using Svelte stores

## Architecture

```
helix-ai/
├── src/
│   ├── lib/
│   │   ├── chatStore.ts        # AI chat state management
│   │   └── searchStore.ts      # Search state management
│   ├── entrypoints/
│   │   ├── content.ts          # Content script integration
│   │   └── telescope-ui/       # UI components
│   │       ├── App.svelte      # Main app with chat integration
│   │       ├── Telescope.svelte           # Main container
│   │       ├── TelescopeInput.svelte      # Input component
│   │       ├── TelescopeChatbox.svelte    # Chat container
│   │       ├── TelescopeMessageContainer.svelte  # Message display
│   │       └── type.ts         # TypeScript types
```

## Key Components

### chatStore.ts
The core chat state management with:
- `init()`: Initialize AI and extract page context
- `sendMessage(message)`: Send message to AI
- `clear()`: Clear chat history
- `destroy()`: Clean up AI session

### Chrome AI Integration
Supports multiple API detection strategies:
1. Checks Global LanguageModel API
2. Falls back to window.ai.languageModel
3. Final fallback to Summarizer API
4. Provides clear error messages if unavailable

### Page Context Extraction
```typescript
- Extracts text from: h1-h6, p, li, td, th elements
- Includes page title and URL
- Truncates to 3000 characters for efficiency
- Smart content prioritization
```

## Usage

### User Interaction
1. Press `Ctrl+E` (Windows/Linux) or `Cmd+E` (Mac) to open Telescope
2. Type a query:
   - **Short query**: Activates search mode
   - **Long query or multiline**: Activates AI mode
   - Press Enter to send to AI
3. View AI responses in the chat interface
4. Navigate search results with up/down arrows

### Requirements
- Chrome 138+ (Dev or Canary channel recommended)
- Chrome Built-in AI flags enabled:
  - `chrome://flags/#prompt-api-for-gemini-nano`
  - `chrome://flags/#optimization-guide-on-device-model`
- Gemini Nano model downloaded via `chrome://components`

## Implementation Details

### Type Definitions
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  aiAvailable: boolean;
  aiStatus: string;
}
```

### State Flow
```
User Input → Determine Mode (search/ask/chat)
         ↓
   Search Mode: searchStore.search()
         ↓
   AI Mode: chatStore.sendMessage()
         ↓
Extract Page Context → Create AI Session → Get Response
         ↓
   Update UI with Response
```

## Best Practices Applied

✅ **Functional Programming**: Store-based state management
✅ **Separation of Concerns**: Clear module boundaries
✅ **Error Handling**: Graceful degradation with user-friendly messages
✅ **Type Safety**: Full TypeScript coverage
✅ **Performance**: Context truncation and efficient DOM extraction
✅ **Privacy**: All AI processing happens locally (no external APIs)

## Future Enhancements

Potential improvements from the original telescope TODO:
- [ ] Multi-modal support (image input)
- [ ] Options page for AI configuration
- [ ] Alternative AI provider support
- [ ] Suggested questions feature
- [ ] Enhanced context extraction algorithms

## Testing

To test the integration:

```bash
# Development mode
pnpm run dev

# Build for production
pnpm run build

# Type checking
pnpm run check
```

Load the extension in Chrome:
1. Navigate to `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3` directory

## Compatibility

- ✅ Chrome 138+ with AI features enabled
- ✅ Windows, macOS, Linux
- ✅ Manifest V3 compliant
- ✅ WXT framework architecture

## Credits

Based on the Telescope project's AI integration patterns, adapted for the Helix/WXT architecture.

