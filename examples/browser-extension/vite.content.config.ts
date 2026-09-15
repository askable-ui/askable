import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    // The module build writes the manifest, popup, and worker first.
    emptyOutDir: false,
    outDir: 'dist',
    lib: {
      entry: fileURLToPath(new URL('./src/content.ts', import.meta.url)),
      name: 'AskableCompanionContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});
