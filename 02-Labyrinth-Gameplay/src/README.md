# Mist Maze source layout

## Main
- `App.jsx` — game lifecycle, input/event loop, orchestration.
- `main.jsx` — React/Vercel entry point.

## Config
- `config/constants.js` — levels, themes, canvas/view constants.
- `config/ammo.js` — ammo quantities, frequency, and spacing.
- `config/weapons.js` — weapon stats and spawn plan.
- `config/powerUps.js` — power-up definitions, durations, spawn order.
- `config/enemies.js` — enemy definitions, difficulty stages, and pursuit ramp constants.
- `config/runtime.js` — HUD/vision/render runtime constants.
- `config/presentations.js` — themed weapon/ammo/power-up names.
- `config/support.js` — support payment-link environment variables.
- `config/labyrinth.js` — Labyrinth difficulty, timing, steel, and breaker settings.
- `config/labyrinthLights.js` — the ten Labyrinth light tools and light geometry.

## Systems
- `audio/MazeAudioEngine.js` — music and sound effects.
- `services/leaderboard.js` — local/global leaderboard and Supabase.
- `services/developerAnalytics.js` — aggregate developer usage event recording.
- `game/maze.js` — maze generation, pathfinding, collision/spawn helpers.
- `game/gameplay.js` — combat, pickups, enemies, pursuit, projectiles, effects.
- `game/labyrinth.js` — full-maze rebuilds, steel segments, lights, and Wall Breakers.
- `game/rendering.js` — 2D and 3D drawing.
- `game/world.js` — world creation and view-mode setup.

## UI
- `components/GameUi.jsx` — HUD, settings, touch controls, locator, and Labyrinth lights.
- `components/DeveloperAnalytics.jsx` — password-gated developer analytics dashboard.
- `components/LevelSelectScreen.jsx` — first page, previews, leaderboards.
- `components/StatCard.jsx` — small reusable status card.
- `styles/` — extracted game and first-page styles.

## Utilities
- `utils/math.js` — shared math/format helpers.
- `utils/player.js` — player-name helpers.
