import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [
    svelte({
      extensions: ['.svelte'],
      compilerOptions: {
        dev: process.env.NODE_ENV !== 'production',
        hmr: true,
      },
    }),
  ],
  resolve: {
    alias: {
      $lib: '/src/lib',
    },
  },
  optimizeDeps: {
    include: ['svelte'],
  },
});