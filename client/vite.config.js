import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Permite que os assets funcionem tanto na Web quanto no executável local do Desktop
  server: {
    port: 5173,
    host: true
  }
});
