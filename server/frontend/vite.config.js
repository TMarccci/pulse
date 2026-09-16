import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

// The production build is emitted straight into the backend's public/ dir so the
// Express server can serve the compiled dashboard.
export default defineConfig({
  plugins: [react(), tailwind()],
  build: {
    outDir: '../backend/public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});
