MIST MAZE — FINAL CLEAN CUMULATIVE V5
=====================================

This ZIP contains the current cumulative patch WITHOUT the old recursive
GameUiFlickerFix design.

REPLACE / ADD THE FILES USING THE PATHS INSIDE THIS ZIP.

WHAT THIS FIXES

1. MENDEL — THE TRAIL
- Mendel's level 3 is named The Trail.
- The medieval identity is not dispatched for Mendel.
- Fallen Keep statues, torches/candles and medieval special props are not
  used for Mendel's Trail.
- Yellow shrubs are interspersed across The Trail.
- Other usernames keep the normal Fallen Keep treatment.

2. MINIMAP
- Stable standalone minimap renderer.
- No GameUi wrapper or GameUi import loop.
- Player marker is an arrow snapped to 16 directions.
- 16 directions = 22.5 degree increments.
- The original minimap canvas stays in layout but its pixels are hidden
  behind the stable overlay, preventing the repeated clear/redraw flash.
- The Minimap setting hides the map in both 2D and 3D.

3. SETTINGS
Under the existing VIEW section, this patch adds:
- LABELS: ON / OFF
- MINIMAP: ON / OFF

Both settings persist in localStorage.
The Minimap toggle also controls the standalone minimap renderer.
The label setting updates common world/settings label flags and hides HTML
world/enemy/pickup/weapon labels when disabled.

4. AMMO
Support drops:
  4-9 -> 6-11

Route/extra drops:
  4-8 -> 6-10

That is exactly +2 ammo per generated normal ammo pickup.

5. SPECIAL PLAYERS
- Feivel permanently retains Black Sword while normal weapons remain usable.
- Asher permanently retains Sword Gun while normal weapons remain usable.
- Their special weapon remains available after switching away.
- Special weapons show only for their matching username.
- Feivel can be typed in the username field without gameplay hotkeys stealing
  the key presses.
- Legacy Robbienator exports are retained for build compatibility.

6. MENDEL NAMES
Mendel only:
  Orbital Ruins -> Under 770
  Emerald Wilds -> Jungle
  Fallen Keep -> The Trail

Under 770 uses the lighter Labyrinth-style treatment.

RECURSION FIX
The old bad chain was:

  GameUi.jsx
    -> GameUiFlickerFix.jsx
    -> GameUiEnhanced.jsx
    -> GameUi.jsx

THIS ZIP DOES NOT CONTAIN GameUiFlickerFix.jsx.

vite.config.js uses:
  GameUi.jsx -> GameUiEnhanced.jsx

The minimap and settings fixes live in standalone feature modules and do not
import GameUi or GameUiEnhanced.

DELETE THESE OLD FILES IF THEY STILL EXIST
  src/components/GameUiFlickerFix.jsx
  src/styles/minimapPointerFix.css

They are not referenced by this V5 package.

NO App.jsx CHANGE IS REQUIRED.
