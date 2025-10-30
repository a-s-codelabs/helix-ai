import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    permissions: ['storage', 'sidePanel', 'activeTab', 'contextMenus'],
    host_permissions: ['<all_urls>'],
    icons: {
      '16': 'icon/16.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    action: {
      default_title: 'Open Helix AI',
    },
    commands: {
      'open-floating-telescope': {
        suggested_key: {
          default: 'Ctrl+Y',
          mac: 'Command+Y',
        },
        "global": true,
        description: 'Open floating telescope search',
      },
    },
  },
});
