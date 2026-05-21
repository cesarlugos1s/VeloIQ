import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "antd", "@ant-design/icons", "@refinedev/antd", "@refinedev/core", "@tanstack/react-query", "axios", "dayjs", "react-resizable-panels", "react-router-dom"],
  },
  optimizeDeps: {
    include: ["@tanstack/react-query", "@tanstack/query-core"],
  },
  server: {
    host: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:{{backend_port}}", changeOrigin: true, rewrite: (path: string) => path.replace(/^\/api/, "") },
      "/auth": { target: "http://127.0.0.1:{{backend_port}}", changeOrigin: true },
      "/admin": { target: "http://127.0.0.1:{{backend_port}}", changeOrigin: true },
      "/views": { target: "http://127.0.0.1:{{backend_port}}", changeOrigin: true },
      "/i18n": { target: "http://127.0.0.1:{{backend_port}}", changeOrigin: true },
    },
  },
});
