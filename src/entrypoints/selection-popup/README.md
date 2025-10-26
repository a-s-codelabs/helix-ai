# Selection Popup Component

A modern, accessible text selection popup that appears when users highlight text on a webpage.

## Features

- ✨ Modern, glassmorphic design with smooth animations
- 🎯 Three built-in actions: Summarise, Translate, Add to Chat
- ♿ Fully accessible with keyboard navigation
- 📱 Responsive design (mobile-friendly)
- 🎨 Dark theme with hover effects
- ⚡ Performance optimized with debouncing
- 🎭 Smooth transitions using Svelte 5

## Components

### SelectionPopup.svelte

The main popup UI component that displays action buttons.

**Props:**

- `x: number` - X coordinate for positioning
- `y: number` - Y coordinate for positioning
- `onAction: (action: SelectionAction) => void` - Callback when an action is clicked
- `onClose?: () => void` - Optional callback when popup should close

### SelectionPopupContainer.svelte

Container component that manages popup visibility and state.

**Props:**

- `state: SelectionPopupState` - The current state of the popup
- `onAction: (action: SelectionAction, text: string) => void` - Callback with action and selected text
- `onClose: () => void` - Callback when popup should close

## Usage

The selection popup is automatically integrated into the content script and will appear when users select text on any webpage.

### How it works:

1. User selects text on a webpage
2. After a short debounce (100ms), the popup appears above the selection
3. User can click one of three actions:
   - **Summarise** (📝) - Summarise the selected text
   - **Translate** (🌐) - Translate the selected text
   - **Add to Chat** (💬) - Add the selected text to chat
4. When an action is clicked, the `handleSelectionAction` function in `content.ts` is called
5. Press `Escape` or click elsewhere to close the popup

### Customization

To modify the actions, edit the `actions` array in `SelectionPopup.svelte`:

```typescript
const actions: Array<{ id: SelectionAction; icon: string; label: string }> = [
  { id: 'summarise', icon: '📝', label: 'Summarise' },
  { id: 'translate', icon: '🌐', label: 'Translate' },
  { id: 'addToChat', icon: '💬', label: 'Add to Chat' },
];
```

### Implementing Action Handlers

Update the `handleSelectionAction` function in `src/entrypoints/content.ts`:

```typescript
const handleSelectionAction = (action: SelectionAction, text: string) => {
  switch (action) {
    case 'summarise':
      // TODO: Implement summarization
      break;
    case 'translate':
      // TODO: Implement translation
      break;
    case 'addToChat':
      // TODO: Implement add to chat
      break;
  }
};
```

## Styling

The component uses a dark glassmorphic design with:

- Semi-transparent dark background (rgba(17, 24, 39, 0.95))
- Backdrop blur for glass effect
- Blue hover states (#3b82f6)
- Smooth transitions and scale animations
- Mobile-responsive (hides labels on small screens)

## Accessibility

- Keyboard navigation support (Tab between buttons)
- `Escape` key to close
- Proper ARIA labels and roles
- Focus visible indicators
- Semantic HTML structure

## Performance

- Debounced selection detection (100ms)
- Efficient event handling
- Lazy UI mounting
- Shadow DOM isolation
- Minimal re-renders with Svelte 5 runes

## Browser Support

Works in all modern browsers that support:

- Shadow DOM
- CSS backdrop-filter
- ES6 modules
- Svelte 5
