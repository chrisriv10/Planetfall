import { defineConfig, loadEnv } from "vite";

export default defineConfig(({mode}) => ({
  server: {
    port: 5173, strictPort: true,
    proxy: { "/api/account": { target: process.env.VITE_SERVER_URL || loadEnv(mode,process.cwd()).VITE_SERVER_URL || "http://localhost:3000", changeOrigin: true } }
  },
  build: { target: "es2022", sourcemap: true, chunkSizeWarningLimit: 1600 }
}));
