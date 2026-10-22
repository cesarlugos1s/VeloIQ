import { defineConfig } from "tsup";

export default defineConfig({
  // "banner" is the light entry point for external websites (React + antd only).
  entry: { index: "src/index.ts", banner: "src/banner/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "antd",
    "@ant-design/icons",
    "@refinedev/core",
    "@refinedev/antd",
    "@refinedev/react-router-v6",
    "@tanstack/react-query",
    "react-router-dom",
    "axios",
    "dayjs",
  ],
  treeshake: true,
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
