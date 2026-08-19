import { defineConfig } from "vite";
import path from "path";
// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    // For Node.js native modules
    conditions: ["node"],
    mainFields: ["module", "jsnext:main", "jsnext"],
    alias: {
      "@": path.resolve(__dirname, "../src"),
    },
  },
  plugins: [
    {
      name: "restart",
      closeBundle() {
        process.stdin.emit("data", "rs");
      },
    },
  ],
});
