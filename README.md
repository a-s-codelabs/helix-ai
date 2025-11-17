# Helix UI App

A powerful browser extension for AI-powered web interactions with integrated content extraction and formatting capabilities.

For reviewing google chrome builtin challenge 2025, please use this version 0.0.3

## Features

### 🔭 Telescope UI

- AI-powered search and chat interface
- Context-aware interactions

### ✨ Writer API (NEW)

- **AI-powered content generation** directly in text fields
- **On-device processing** using Chrome's built-in Gemini Nano
- **Smart assistance** with customizable tone and length
- **Privacy-first**: All processing happens locally on your device
- Works on any textarea or text input across all websites

See [WRITER_API_SETUP.md](WRITER_API_SETUP.md) for setup instructions.

### 📝 Formatter

- Extract recipes and images from web pages
- AI-powered content parsing using Claude
- Organize content into collections
- Export collections to Markdown

## Recommended IDE Setup

- [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode).

## Getting Started

1. Clone this repo using `git clone https://github.com/a-s-codelabs/helix-ai`
2. Install dependencies: `pnpm i` (or `npm i`)
3. Setup environment variables:
   - Copy `.env` and add your API keys
   - `VITE_API_CLAUDE_KEY` - Get from [Anthropic Console](https://console.anthropic.com/)
4. Run development mode: `pnpm run dev` (or `npm run dev`)

This will open the Chrome browser with the extension installed.

## Project Structure

```
src/
├── entrypoints/
│   ├── background.ts          # Background service worker
│   ├── content.ts             # Content script with Writer API integration
│   ├── popup/                 # Extension popup UI
│   ├── telescope-ui/          # Telescope AI interface
│   ├── writer-popup/          # Writer API UI components (NEW)
│   │   ├── WriterAssistant.svelte      # Main container
│   │   ├── FloatingButton.svelte       # AI trigger button
│   │   ├── WriterPopup.svelte         # Generation dialog
│   │   └── WriterPopupContainer.svelte # Popup wrapper
│   └── formatter/             # Formatter page
│       ├── App.svelte         # Main formatter UI
│       └── main.ts            # Entry point
├── lib/
│   ├── chatStore.ts           # Chat state management
│   ├── searchStore.ts         # Search state management
│   ├── writerApiHelper.ts     # Writer API wrapper (NEW)
│   ├── writerPopupStore.ts    # Writer state management (NEW)
│   ├── formatterStorage.ts    # Formatter storage (WXT storage API)
│   └── formatterUtils.ts      # Formatter utilities
└── types/
    ├── chrome.d.ts            # Chrome extension types
    ├── writer-api.d.ts        # Writer API types (NEW)
    └── formatter.ts           # Formatter types
```

## Using the Features

### Writer API

1. Click on any textarea or text input field on any webpage
2. A floating AI button appears in the top-right corner
3. Click the button to open the AI Writer dialog
4. Enter your prompt (what you want to write)
5. Optionally adjust tone and length
6. Click "Generate" or press `Cmd/Ctrl + Enter`
7. Generated content is automatically inserted

**Note**: Requires Chrome 137+ and origin trial token. See [setup guide](WRITER_API_SETUP.md).

### Formatter

1. After installing the extension, right-click and select "Open Helix Formatter" or navigate to the formatter page
2. Choose between Recipe or Image extraction
3. Enter a URL or paste content directly
4. Let Claude AI extract and format the data
5. Add to collections and export as Markdown

## Scripts

- `pnpm dev` - Start development server
- `pnpm dev:firefox` - Start development server for Firefox
- `pnpm build` - Build for production
- `pnpm build:firefox` - Build for Firefox
- `pnpm check` - Run Svelte type checking
- `pnpm storybook` - Start Storybook

## Firefox Support

- Use `pnpm dev:firefox` / `pnpm build:firefox` to launch with the Firefox-specific manifest entries (sidebar action + Gecko ID).
- Firefox renders Helix inside the native sidebar; the command palette still works, but keyboard shortcuts are managed from `about:addons` → “Manage Extension Shortcuts”.
- The same context menu entries and floating Telescope UI are available; features that rely on Chrome-only APIs automatically fall back to the Firefox equivalents.

## Target Browser

- Chrome 142 version

## Documentation

Please checkout the below for documentation and todo

- https://www.notion.so/salman2301/Helix-ai-27bbbc672b4880ca97c9d060a80646a0?source=copy_link
