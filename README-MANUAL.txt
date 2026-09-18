MIST MAZE — GAMEPLAY UI V3.2 FULL
===================================

This full package includes the previous Myst/miz V3.1 files plus the new
gameplay UI/navigation changes.

NEW BEHAVIOR

END OF GAME
- PLAY NEW GAME is always shown after victory or defeat.
- On a combat victory with another combat level available, PLAY NEXT GAME
  is also shown.
- Labyrinth and the final combat level only show PLAY NEW GAME because
  there is no next combat level.

DISPLAY CONTROLS
- MINIMAP ON/OFF is a Settings button.
- LABELS ON/OFF is a Settings button.
- EXIT POINTER ON/OFF is a Settings button.
- M and L no longer toggle these options.
- Preferences persist locally.

3D
- Combat 3D now has a real minimap overlay.
- The minimap can be turned completely off.
- An exit pointer automatically shows LEFT / RIGHT / UP / DOWN relative
  to the exit.
- The pointer can be turned completely off.

GROUND ITEMS
- Extra pulse, bob, spin, and hologram layers on ground pickups are removed.
- Static pickup art remains.
- Level 0 never shows Demolition/dynamite; its Demolition spawn is replaced
  with Shield so the pickup count stays balanced.

FILES ADDED / REPLACED
  vite.config.js
  src/main.jsx
  src/features/gameplayUxEnhancement.js

The ZIP also contains the existing Myst store, miz economy, and visual polish
files from the previous full package.
