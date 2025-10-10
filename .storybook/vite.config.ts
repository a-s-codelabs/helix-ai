import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

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
      $lib: path.resolve(__dirname, '../src/lib'),
      '@': path.resolve(__dirname, '../src'),
      '~': path.resolve(__dirname, '../src'),
    },
  },
  optimizeDeps: {
    include: ['svelte'],
  },
});