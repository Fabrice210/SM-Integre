import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Mode API en dev avec VITE_API_URL=/api/v1 : l'API Django passe par ce proxy (pas de CORS).
    proxy: { '/api': 'http://localhost:8000' },
  },
  preview: { port: 4180 },
})
