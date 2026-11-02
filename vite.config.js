import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    rollupOptions: {
      input: { main: resolve('index.html'), blueprint: resolve('blueprint.html'), preview: resolve('preview.html') },
    },
  },
});
