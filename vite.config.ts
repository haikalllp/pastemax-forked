import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "./", // Relative base path for assets
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173, // Explicitly set port to match what Electron is looking for
    hmr: {
      overlay: false, // Disable HMR overlay to avoid CSP issues
    },
  },
  optimizeDeps: {
    exclude: ['electron'], // Prevent Vite from trying to bundle Electron
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
