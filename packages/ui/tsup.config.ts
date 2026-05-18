import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: false,
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
