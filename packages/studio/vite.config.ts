import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  base: "/veloiq-studio/",
  build: {
    outDir: resolve(__dirname, "../../backend/veloiq_framework/studio/static"),
    emptyOutDir: true,
  },
});
