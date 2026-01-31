import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  publicDir: "src/public",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: process.env.INPUT,
    },
  },
});
