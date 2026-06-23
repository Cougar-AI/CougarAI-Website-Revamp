import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { copyFileSync } from "fs"
import { resolve } from "path"

const backendTarget = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:5000"
console.log("🔍 VITE_BACKEND_API_URL:", process.env.VITE_BACKEND_API_URL)
console.log("🔍 VITE_PROXY_TARGET:", process.env.VITE_PROXY_TARGET)

const copyPdfWorker = {
  name: 'copy-pdf-worker',
  closeBundle() {
    copyFileSync(
      resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
      resolve('dist/pdf.worker.min.mjs')
    )
    console.log('✓ pdf.worker.min.mjs copied to dist/')
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyPdfWorker],
  build: {
    chunkSizeWarningLimit: 1800,
  },
  server: {
    proxy: {
      "/auth": {
        target: backendTarget,
        changeOrigin: true,
        bypass(req) {
          const url = req.url ?? "";
          if (url === "/auth/success" || url.startsWith("/auth/success?") || url === "/auth" || url.startsWith("/auth?")) {
            return url;
          }
        },
      },
      "/events": { target: backendTarget, changeOrigin: true },
      "/forms": { target: backendTarget, changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})