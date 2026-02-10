import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  // Cloud Run/Deployment platforms inject PORT env variable
  const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;

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
      host: true // Listen on all addresses (0.0.0.0)
    },
    preview: {
      port: port, // Use container port
      host: true, // Listen on all addresses (0.0.0.0)
      allowedHosts: true // Allow cloud hosts
    }
  };
});