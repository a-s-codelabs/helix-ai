# Helix UI App

A powerful browser extension for AI-powered web interactions with integrated content extraction and formatting capabilities.

## Features

### 🔭 Telescope UI
- AI-powered search and chat interface
- Context-aware interactions

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
│   ├── content.ts             # Content script
│   ├── popup/                 # Extension popup UI
│   ├── telescope-ui/          # Telescope AI interface
│   └── formatter/             # Formatter page (NEW)
│       ├── App.svelte         # Main formatter UI
│       └── main.ts            # Entry point
├── lib/
│   ├── chatStore.ts           # Chat state management
│   ├── searchStore.ts         # Search state management
│   ├── formatterStorage.ts    # Formatter storage (WXT storage API)
│   └── formatterUtils.ts      # Formatter utilities
└── types/
    ├── chrome.d.ts            # Chrome extension types
    └── formatter.ts           # Formatter types (NEW)
```

## Using the Formatter

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

## Target Browser
- Chrome 142 version

## Documentation

Please checkout the below for documentation and todo
- https://www.notion.so/salman2301/Helix-ai-27bbbc672b4880ca97c9d060a80646a0?source=copy_link


