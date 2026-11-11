import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // En développement, l'API locale (port 4100) est jointe via le serveur Vite.
  server: { proxy: { "/api": "http://localhost:4100" } },
  preview: { proxy: { "/api": "http://localhost:4100" } },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "brand/njmdev-white.png"],
      manifest: {
        name: "NJMDev",
        short_name: "NJMDev",
        description: "NJMDev : supervision de MGA, du site Autonova, de Yiri Invest, de My Family et de Procedia",
        lang: "fr",
        start_url: "/",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        // Comme MGA et Yiri Invest : rien de précaché, chaque ouverture
        // charge la dernière version déployée ; le service worker sert aux
        // notifications push (public/push-worker.js).
        globPatterns: [],
        navigateFallback: undefined,
        importScripts: ["push-worker.js"],
      },
    }),
  ],
});
