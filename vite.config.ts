import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  root: fileURLToPath(new URL("./apps/client", import.meta.url)),
  plugins: [react()],
  build: {
    outDir: `${workspaceRoot}dist`,
    emptyOutDir: true,
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
  },
});
