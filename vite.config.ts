import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    // Les console.log/debug/info sont retirés du bundle de production ; warn/error sont conservés.
    pure: ['console.log', 'console.debug', 'console.info'],
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('leaflet')) return 'leaflet';
          if (id.includes('framer-motion')) return 'motion';
        },
      },
    },
  },
});
