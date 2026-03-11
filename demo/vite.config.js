import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      'canvas-datagrid/svelte': '../svelte/index.js',
      'canvas-datagrid': '../lib/main.js',
    },
  },
});
