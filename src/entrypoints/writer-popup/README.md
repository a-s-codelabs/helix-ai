# Writer API Integration

This integration adds Chrome's built-in Writer API to help users generate content in text fields.

## Features

- 🎯 **Automatic Detection**: Floating AI button appears when you click on any textarea or text input
- ✨ **Smart Generation**: Generate content based on prompts with customizable tone and length
- 🎨 **Context Aware**: Uses existing text as context for better results
- 🚀 **Fast & Private**: Runs entirely on-device using Chrome's built-in AI

## How to Use

1. **Click on any textarea or text input** on any webpage
2. A **floating AI button** appears in the top-right corner of the field
3. **Click the button** to open the AI Writer dialog
4. Enter your **prompt** (what you want to write)
5. Optionally adjust **tone** (formal/neutral/casual) and **length** (short/medium/long)
6. Click **Generate** or press `Cmd/Ctrl + Enter`
7. The generated content is automatically inserted into the field

## Setup Requirements

### 1. Chrome Version

- Chrome 137 or later
- Make sure you're on the Dev or Canary channel

### 2. Enable Gemini Nano

1. Go to `chrome://flags/#optimization-guide-on-device-model`
2. Set to **Enabled BypassPerfRequirement**
3. Restart Chrome

### 3. Enable Writer API

1. Go to `chrome://flags/#writer-api-for-gemini-nano`
2. Set to **Enabled**
3. Restart Chrome

### 4. Origin Trial Token (Required)

The Writer API requires an origin trial token for extensions:

1. Go to the [Writer API Origin Trial](https://developer.chrome.com/origintrials/#/view_trial/-8779204523605360639)
2. Acknowledge Google's Generative AI Prohibited Uses Policy
3. Click **Register**
4. Enter your extension ID: `chrome-extension://YOUR_EXTENSION_ID`
5. Copy the token provided
6. Add it to `wxt.config.ts`:

```typescript
manifest: {
  permissions: ['storage', 'sidePanel'],
  trial_tokens: [
    'YOUR_ORIGIN_TRIAL_TOKEN_HERE'
  ],
  // ... rest of config
}
```

### 5. Hardware Requirements

- **OS**: Windows 10/11, macOS 13+, Linux, or ChromeOS
- **Storage**: At least 22 GB free space
- **GPU**: More than 4 GB VRAM, OR
- **CPU**: 16 GB RAM + 4 CPU cores
- **Network**: Unlimited data or unmetered connection

## Keyboard Shortcuts

- `Esc` - Close the Writer dialog
- `Cmd/Ctrl + Enter` - Generate content

## API Configuration

The Writer API can be configured in `src/lib/writerApiHelper.ts`:

```typescript
const options: WriterOptions = {
  tone: 'formal' | 'neutral' | 'casual',
  length: 'short' | 'medium' | 'long',
  format: 'plain-text' | 'markdown',
  sharedContext: 'Optional context shared across requests',
};
```

## Architecture

```
src/entrypoints/writer-popup/
├── WriterAssistant.svelte      # Main container component
├── FloatingButton.svelte        # Floating AI button
├── WriterPopup.svelte          # AI Writer dialog
└── WriterPopupContainer.svelte # Container for popup

src/lib/
├── writerApiHelper.ts          # Writer API integration
└── writerPopupStore.ts         # State management
```

## Troubleshooting

### "Writer API is not available"

- Ensure you're using Chrome 137+ (Dev/Canary)
- Check that Writer API flag is enabled
- Verify hardware requirements are met
- Make sure you've added the origin trial token

### Model Not Downloading

- Check available storage space (needs 22 GB)
- Ensure you're on an unmetered connection
- Visit `chrome://on-device-internals` to check status

### Button Not Appearing

- Make sure the element is a `<textarea>` or `<input type="text">`
- Check browser console for any errors
- Try refreshing the page

## Resources

- [Writer API Documentation](https://developer.chrome.com/docs/ai/writer-api)
- [Writer API Playground](https://chrome.dev/web-ai-demos/writer-rewriter-api-playground/)
- [Built-in AI on Chrome](https://developer.chrome.com/docs/ai/built-in)
- [Origin Trial Guide](https://developer.chrome.com/docs/web-platform/origin-trials)
