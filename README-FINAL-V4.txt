MIST MAZE — FINAL CUMULATIVE V4
=================================

This ZIP contains the cumulative fixes from the recent updates, including
the items that were still missing in the live build.

IMPORTANT
---------

Upload the files using the exact paths inside this ZIP.

Delete the two obsolete V3 files if they still exist:
  src/components/GameUiFlickerFix.jsx
  src/styles/minimapPointerFix.css

They are not used anymore.

WHAT THIS V4 FIXES
------------------

SETTINGS
- Adds a LABELS toggle to the existing VIEW settings card.
- Adds a MINIMAP toggle to the existing VIEW settings card.
- The controls are injected into the real Settings screen at runtime.
- They do not wrap or import GameUi, so there is no GameUi recursion.
- Settings are persisted in localStorage.

MINIMAP
- Uses a stable overlay canvas instead of resizing the React minimap canvas.
- Avoids the canvas-width/canvas-height clearing flicker.
- Player marker is a blue facing arrow.
- Facing snaps to 16 directions.
- 16 directions = 22.5 degree steps.
- Works in normal minimap and Labyrinth locator.
- Respects the Settings MINIMAP toggle.

AMMO
- Support ammo drops: 4–9 -> 6–11.
- Route/extra ammo drops: 4–8 -> 6–10.
- This is exactly +2 ammo per generated normal ammo drop.

FEIVEL
- Feivel types normally in the username box.
- Gameplay hotkeys do not steal username input.
- Black Sword remains permanently available to Feivel.
- Feivel can switch to normal weapons and back to Black Sword.
- Black Sword is special-sidebar-visible only for Feivel.

ASHER
- Sword Gun remains permanently available to Asher.
- Asher can switch to normal weapons and back to Sword Gun.
- Sword Gun is special-sidebar-visible only for Asher.

MENDEL
Level 1:
  Orbital Ruins -> Under 770
  Uses the Labyrinth visual family with a lighter blue/white treatment.

Level 2:
  Emerald Wilds -> Jungle

Level 3:
  Fallen Keep -> The Trail

For Mendel's The Trail:
- Fallen Keep identity is suppressed.
- Medieval statues/torches/candles are not dispatched for Mendel's Trail.
- Interspersed yellow shrubs are drawn in 2D and 3D.
- Mendel profile application is checked before each custom visual frame so
  it cannot miss the level because of username/world creation timing.

RECURSION
- GameUi.jsx aliases to GameUiEnhanced.jsx normally.
- There is no GameUiFlickerFix wrapper in this pack.
- Minimap and Settings enhancements are standalone features.
- No feature imports GameUiEnhanced back through the GameUi alias.

LEGACY SPECIAL-PLAYER COMPATIBILITY
- Complete Robbienator export compatibility from both Vercel error logs is
  retained in src/config/specialPlayers.js.

FILES
-----

REPLACE / ADD all files in this ZIP at their shown paths.

The key new file in V4 is:
  src/features/settingsToggleEnhancement.js

No App.jsx edit is required.

After uploading:
1. Commit all files together.
2. Make sure the Vercel deployment uses that new commit SHA.
3. Hard-refresh the deployed site.
4. Open Settings -> VIEW. You should see:
   LABELS: ON/OFF
   MINIMAP: ON/OFF
