import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: "Helix AI",
    description: "Free AI Sidebar Chatbot in any site to prompt, attach images with Chrome AI.",
    permissions: ['storage', 'sidePanel', 'activeTab', 'contextMenus'],
    host_permissions: ['<all_urls>'],
    icons: {
      '16': 'icon/16.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png',
    },
    browser_specific_settings: {
      gecko: {
        id: 'helix-ai@helix.ai',
        strict_min_version: '115.0',
      },
    },
    sidebar_action: {
      default_title: 'Helix AI',
      default_panel: 'sidepanel.html',
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
