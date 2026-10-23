import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The portal is served by the host app's backend at /portals/{{site}}/
// (`veloiq build` builds it, `veloiq run` serves it). `npm run dev` serves it
// at the same path and sends the API, sign-in and translation calls to the backend.
const backend = { target: "http://127.0.0.1:{{backend_port}}", changeOrigin: true };

export default defineConfig({
  base: "/portals/{{site}}/",
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "antd", "@ant-design/icons", "@refinedev/antd", "@refinedev/core", "@tanstack/react-query", "axios", "dayjs", "react-resizable-panels", "react-router-dom"],
  },
  optimizeDeps: {
    include: ["@tanstack/react-query", "@tanstack/query-core"],
  },
  server: {
    host: true,
    port: {{frontend_port}},
    proxy: {
      "/api": backend,
      "/auth": backend,
      "/i18n": backend,
      // Framework assets such as the Plotly.js runtime every chart loads.
      "/veloiq-assets": backend,
    },
  },
});
