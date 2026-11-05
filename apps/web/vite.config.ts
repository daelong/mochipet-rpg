import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { copyAssetsPlugin } from '../../tools/assets.mjs';
export default defineConfig({
  plugins: [react(), tailwindcss(), copyAssetsPlugin()],
  server: {port: 5173, strictPort: true},
  build: {target: ['es2022', 'safari16.4'], chunkSizeWarningLimit: 1600, rollupOptions: {output: {manualChunks: {phaser: ['phaser']}}}}
});
