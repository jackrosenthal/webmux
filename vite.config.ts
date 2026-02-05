import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  build: {
    outDir: "dist/client",
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8002",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8002",
        ws: true,
      },
      "/auth": {
        target: "http://localhost:8002",
        changeOrigin: true,
      },
    },
  },
});
