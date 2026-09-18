// vite.config.js

import {
  fileURLToPath,
  URL,
} from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function sourcePath(relativePath) {
  return fileURLToPath(
    new URL(
      relativePath,
      import.meta.url,
    ),
  );
}

function mistMazeUiPolish() {
  return {
    name:
      "mist-maze-ui-polish",
    enforce: "pre",

    transform(code, id) {
      const cleanId =
        id
          .split("?")[0]
          .replaceAll(
            "\\",
            "/",
          );

      let nextCode =
        code;

      if (
        cleanId.endsWith(
          "/src/game/rendering-2.0.js",
        )
      ) {
        nextCode =
          nextCode.replace(
            "drawAnimatedPickupEffects(ctx, world);",
            "/* Extra pickup pulse/spin layer intentionally disabled. */",
          );

        nextCode =
          nextCode.replace(
            /drawOrbitalHolographicPickups\(\s*ctx,\s*world,\s*\);/g,
            "/* Orbital ground pickups stay visually stable. */",
          );

        nextCode =
          nextCode.replace(
            /drawOrbitalProjectedWeaponPickups3D\(\s*ctx,\s*world,\s*\);/g,
            "/* Orbital 3D pickup hologram motion intentionally disabled. */",
          );
      }

      if (
        cleanId.endsWith(
          "/src/components/GameUi.jsx",
        )
      ) {
        nextCode =
          nextCode.replace(
            "Minimap hidden. Press M to show it.",
            "Minimap hidden. Use Settings to show it.",
          );
      }

      if (
        cleanId.endsWith(
          "/src/features/runtimeEnhancements.js",
        )
      ) {
        nextCode =
          nextCode.replace(
            /const primary\s*=\s*world\.gameOver\s*\?\s*"START NEW GAME"\s*:\s*"TRY AGAIN";/,
            'const primary = "PLAY NEW GAME";',
          );
      }

      if (
        cleanId.endsWith(
          "/src/features/nextLevelEnhancement.js",
        )
      ) {
        nextCode =
          nextCode.replace(
            /restartButton\.textContent\s*=\s*"START NEW GAME";/,
            'restartButton.textContent = "PLAY NEW GAME";',
          );

        nextCode =
          nextCode.replace(
            /nextButton\.textContent\s*=\s*details\s*\?\s*`PLAY \$\{details\.label\} — \$\{details\.subtitle\}`\s*:\s*"PLAY NEXT LEVEL";/,
            'nextButton.textContent = "PLAY NEXT GAME";',
          );
      }

      if (
        nextCode ===
        code
      ) {
        return null;
      }

      return {
        code:
          nextCode,
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [
    mistMazeUiPolish(),
    react(),
  ],

  resolve: {
    alias: [
      {
        find:
          /^(?:.*\/)?config\/constants\.js$/,
        replacement:
          sourcePath(
            "./src/config/constants-enhanced.js",
          ),
      },
      {
        find:
          /^(?:.*\/)?config\/weapons\.js$/,
        replacement:
          sourcePath(
            "./src/config/weapons-enhanced.js",
          ),
      },
      {
        find:
          /^(?:.*\/)?config\/presentations\.js$/,
        replacement:
          sourcePath(
            "./src/config/presentations-enhanced.js",
          ),
      },
      {
        find:
          /^(?:.*\/)?audio\/MazeAudioEngine\.js$/,
        replacement:
          sourcePath(
            "./src/audio/MazeAudioEngine-enhanced.js",
          ),
      },
      {
        find:
          /^(?:.*\/)?components\/GameUi\.jsx$/,
        replacement:
          sourcePath(
            "./src/components/GameUiEnhanced.jsx",
          ),
      },
      {
        find:
          /^(?:.*\/)?components\/LevelSelectScreen\.jsx$/,
        replacement:
          sourcePath(
            "./src/components/LevelSelectScreen-2.0.jsx",
          ),
      },
      {
        find:
          /^(?:.*\/)?services\/leaderboard\.js$/,
        replacement:
          sourcePath(
            "./src/services/leaderboard-enhanced.js",
          ),
      },
      {
        find:
          /^(?:.*\/)?game\/gameplay\.js$/,
        replacement:
          sourcePath(
            "./src/game/gameplay-2.0.js",
          ),
      },
      {
        find:
          /^(?:.*\/)?game\/labyrinth\.js$/,
        replacement:
          sourcePath(
            "./src/game/labyrinth-enhanced.js",
          ),
      },
      {
        find:
          /^(?:.*\/)?game\/world\.js$/,
        replacement:
          sourcePath(
            "./src/game/world-enhanced.js",
          ),
      },
      {
        find:
          /^(?:.*\/)?game\/rendering\.js$/,
        replacement:
          sourcePath(
            "./src/game/rendering-2.0.js",
          ),
      },
    ],
  },
});
