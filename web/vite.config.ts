import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" so the site works on GitHub Pages under /multi-agent-market-research/
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { rollupOptions: { output: { manualChunks: { charts: ["recharts"], react: ["react", "react-dom", "react-router-dom"] } } } },
});
