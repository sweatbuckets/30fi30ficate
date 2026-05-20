import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")]
    },
    proxy: {
      "/api/certspotter": {
        target: "https://api.certspotter.com",
        changeOrigin: true,
        rewrite: (pathValue) => pathValue.replace(/^\/api\/certspotter/, "/v1/issuances")
      }
    }
  }
});
