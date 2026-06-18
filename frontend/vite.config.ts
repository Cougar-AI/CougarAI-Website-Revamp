import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const backendTarget = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:5000"

// https://vite.dev/config/
console.log("🔍 VITE_BACKEND_API_URL:", process.env.VITE_BACKEND_API_URL)
console.log("🔍 VITE_PROXY_TARGET:", process.env.VITE_PROXY_TARGET)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
          chunkSizeWarningLimit:1800,    
  },

  server: {
    proxy: {
      "/auth": {
        target: backendTarget,
        changeOrigin: true,
        bypass(req) {
          // Frontend-only routes under /auth must not be proxied to Flask
          const url = req.url ?? "";
          if (url === "/auth/success" || url.startsWith("/auth/success?") || url === "/auth" || url.startsWith("/auth?")) {
            return url;
          }
        },
      },
      "/events": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/forms": {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
