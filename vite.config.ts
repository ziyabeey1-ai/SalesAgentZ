import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env for existing code compatibility
      'process.env': {
        API_KEY: env.API_KEY || ''
      }
    },
    server: {
      port: 3000,
      open: true
    }
  };
});