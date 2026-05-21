import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@juicemantics/veloiq-ui": path.resolve(__dirname, "../../../packages/ui/src/index.ts"),
    },
    dedupe: ["react", "react-dom", "antd", "@ant-design/icons", "@refinedev/antd", "@refinedev/core", "@tanstack/react-query", "axios", "dayjs", "react-resizable-panels", "react-router-dom"],
  },
  server: {
    host: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, "") },
      "/auth": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/admin": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
});
