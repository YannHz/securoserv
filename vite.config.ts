import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
    allowedHosts: process.env.PUBLIC_TUNNEL_HOST
      ? [process.env.PUBLIC_TUNNEL_HOST]
      : [],
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
});
