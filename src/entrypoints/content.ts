/*@ts-ignore */
import App from './telescope-ui/App.svelte';
import { mount, unmount } from 'svelte';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      position: 'inline',
      name: 'telescope-ui',
      anchor: 'body',
      onMount: (container) => {
        // Create the Svelte app inside the UI container
        return mount(App, { target: container });
      },
      onRemove: (app) => {
        unmount(app as any);
      },
    });

    // Call mount to add the UI to the DOM
    ui.mount();
  },
});
