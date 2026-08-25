// vite.config.js
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "./components/GameUi.jsx",
        replacement: fileURLToPath(
          new URL("./src/components/GameUiEnhanced.jsx", import.meta.url),
        ),
      },
      {
        find: "./game/gameplay.js",
        replacement: fileURLToPath(
          new URL("./src/game/gameplay-enhanced.js", import.meta.url),
        ),
      },
      {
        find: "./game/labyrinth.js",
        replacement: fileURLToPath(
          new URL("./src/game/labyrinth-enhanced.js", import.meta.url),
        ),
      },
    ],
  },
  plugins: [react()],
});
