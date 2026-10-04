import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import path from 'node:path'
import { aiMiddleware } from './server/ai.ts'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // ponytail: AI proxy lives in the dev/preview server; move to a real backend when deploying.
    { name: 'ai-api', configureServer: (s) => { s.middlewares.use(aiMiddleware) }, configurePreviewServer: (s) => { s.middlewares.use(aiMiddleware) } },
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
