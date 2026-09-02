// vite.config.js
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function sourcePath(relativePath) {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /(?:^|\/)components\/GameUi\.jsx$/,
        replacement: sourcePath("./src/components/GameUiEnhanced.jsx"),
      },
      {
        find: /(?:^|\/)services\/leaderboard\.js$/,
        replacement: sourcePath("./src/services/leaderboard-enhanced.js"),
      },
      {
        find: /(?:^|\/)config\/presentations\.js$/,
        replacement: sourcePath("./src/config/presentations-enhanced.js"),
      },
      {
        find: /(?:^|\/)audio\/MazeAudioEngine\.js$/,
        replacement: sourcePath("./src/audio/MazeAudioEngine-enhanced.js"),
      },
      {
        find: /(?:^|\/)game\/gameplay\.js$/,
        replacement: sourcePath("./src/game/gameplay-enhanced.js"),
      },
      {
        find: /(?:^|\/)game\/labyrinth\.js$/,
        replacement: sourcePath("./src/game/labyrinth-enhanced.js"),
      },
      {
        find: /(?:^|\/)game\/world\.js$/,
        replacement: sourcePath("./src/game/world-enhanced.js"),
      },
      {
        find: /(?:^|\/)game\/rendering\.js$/,
        replacement: sourcePath("./src/game/rendering-enhanced.js"),
      },
    ],
  },
});
