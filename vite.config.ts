import { defineConfig } from "vite";
import { CONFIG } from "./src/config.ts";

// Relative base so the build works at https://<user>.github.io/<any-repo>/ and on custom domains.
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    // One self-contained IIFE bundle, so the page also works opened straight from disk (file://).
    rollupOptions: { output: { format: "iife", inlineDynamicImports: true } },
  },
  plugins: [
    {
      name: "file-protocol-friendly",
      apply: "build",
      enforce: "post",
      transformIndexHtml(html) {
        // Chrome blocks type="module" and crossorigin assets on file://; a deferred classic script loads everywhere.
        return html
          .replace(/<script type="module" crossorigin/g, "<script defer")
          .replace(/<link rel="stylesheet" crossorigin/g, '<link rel="stylesheet"');
      },
    },
    {
      name: "site-meta",
      transformIndexHtml(html) {
        const url = CONFIG.SITE_URL.replace(/\/?$/, "/");
        // Social crawlers need absolute image URLs; fall back to a relative one until SITE_URL is set.
        const og = CONFIG.SITE_URL ? url + "og.jpg" : "og.jpg";
        return html
          .replaceAll("%OG_IMAGE%", og)
          .replaceAll("%SITE_URL%", CONFIG.SITE_URL ? url : "")
          .replaceAll("%NAME%", CONFIG.NAME);
      },
    },
  ],
});
