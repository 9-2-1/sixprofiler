import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { createHtmlPlugin } from "vite-plugin-html";

export default defineConfig({
  base: "./",
  plugins: [
    createHtmlPlugin({
      minify: true,
    }),
    viteSingleFile({
      removeViteModuleLoader: true,
      inlinePattern: ["assets/*"],
    }),
  ],
  resolve: {
    extensions: [".ts"],
  },
  build: {
    target: "es2015",
    // minify: false,
    assetsInlineLimit: 1024 * 1024 * 1024,
  },
});
