import type { StorybookConfig } from '@storybook/svelte-vite';

const config: StorybookConfig = {
  stories: [
    "../src/**/*.stories.@(js|ts|svelte)",
    "../src/entrypoints/**/*.stories.@(js|ts|svelte)"
  ],
  addons: [
    "@storybook/addon-svelte-csf"
  ],
  framework: {
    name: "@storybook/svelte-vite",
    options: {
      builder: {
        viteConfigPath: ".storybook/vite.config.ts",
      },
    }
  },
  core: {
    disableTelemetry: true,
  },
  typescript: {
    check: false,
  },
};
export default config;