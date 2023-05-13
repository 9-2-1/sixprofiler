import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  resolve: {
    extensions: [".ts"],
  },
  build: {
    target: "es2015",
    minify: false,
  },
});
