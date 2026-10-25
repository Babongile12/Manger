import { defineConfig } from 'vite';

// base './' makes asset paths relative, which Capacitor (the phone app wrapper) needs.
export default defineConfig({
  base: './',
  build: { outDir: 'dist' }
});
