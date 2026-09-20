MIST MAZE — CHARACTER MODES + RECURSION FIX
===============================================

THIS PACK IS CUMULATIVE.

IT INCLUDES:
- Feivel special-weapon switching/access fix
- Asher special-weapon switching/access fix
- Special weapons visible only to their matching usernames
- Feivel username typing fix
- Mendel-only level names/themes
- Under 770 lighter Labyrinth styling
- Mendel-only The Trail with no Fallen Keep medieval identity
- Yellow shrubs on The Trail
- Stable non-recursive minimap overlay
- 16-direction minimap arrow
- +2 ammo per normal ammo pickup
- Corrected visual polish from the previous update
- Vite alias recursion repair

RECURSION FIX
-------------

The previous V3 pack redirected:

  GameUi.jsx
    -> GameUiFlickerFix.jsx
    -> GameUiEnhanced.jsx
    -> GameUi.jsx

That can cycle through the alias again.

THIS PACK REMOVES THAT DESIGN.

vite.config.js now restores:

  GameUi.jsx -> GameUiEnhanced.jsx

The minimap fix is now:
  src/features/minimapEnhancement.js

It draws a stable minimap overlay and never imports GameUi or
GameUiEnhanced, so there is no component import loop.

OLD FILES TO DELETE IF YOU ADDED THEM FROM V3
----------------------------------------------

  src/components/GameUiFlickerFix.jsx
  src/styles/minimapPointerFix.css

They are not referenced by this pack, so leaving them in the repo is
harmless, but deleting them avoids future confusion.

FEIVEL / ASHER
--------------

Feivel:
- Black Sword remains permanently owned.
- Feivel can select normal weapons.
- Switching to a normal weapon does not remove Black Sword.
- Black Sword remains available to switch back to.
- Black Sword appears in the sidebar only for Feivel.

Asher:
- Sword Gun remains permanently owned.
- Asher can select normal weapons.
- Switching to a normal weapon does not remove Sword Gun.
- Sword Gun remains available to switch back to.
- Sword Gun appears in the sidebar only for Asher.

Existing David ch / Portal Gun ownership is preserved.

USERNAME INPUT
--------------

Gameplay keyboard handlers are stopped only while an input, textarea,
select, or contenteditable field is receiving keyboard events.

No preventDefault call is used.

That means names such as:

  Feivel

type normally while gameplay weapon/movement hotkeys do not steal the
keypresses.

MENDEL ONLY
-----------

Level 1:
  Orbital Ruins -> Under 770

Under 770 uses the Labyrinth visual family but gets an additional
lighter blue/white treatment.

Level 2:
  Emerald Wilds -> Jungle

Level 3:
  Fallen Keep -> The Trail

For Mendel's Level 3 only:
- The medieval theme is not dispatched.
- Fallen Keep statues/torches/candles are therefore not used.
- The level uses a natural trail base.
- Interspersed yellow shrubs are added in 2D and 3D.

Other usernames keep the normal level names and themes.

MINIMAP
-------

The old React wrapper is no longer needed.

The standalone minimap enhancement:
- Leaves the original minimap in layout.
- Hides only its pixels.
- Draws a stable replacement canvas over it.
- Uses a 16-direction arrow.
- 16 directions = 22.5 degree increments.
- Works for the normal minimap and Labyrinth locator.
- Does not participate in the GameUi alias chain.

AMMO
----

Support ammo:
  4–9 -> 6–11

Route ammo:
  4–8 -> 6–10

This is exactly +2 per generated normal ammo drop.

FILES TO ADD / REPLACE
----------------------

REPLACE:
  vite.config.js
  src/main.jsx
  src/config/ammo.js
  src/config/weapons-enhanced.js
  src/game/world-enhanced.js
  src/features/visualPolish.js
  src/features/specialWeaponVisibility.js

ADD:
  src/config/specialPlayers.js
  src/config/characterProfiles.js
  src/features/characterModeEnhancement.js
  src/features/minimapEnhancement.js
  src/features/mendelVisuals.js

OPTIONALLY DELETE:
  src/components/GameUiFlickerFix.jsx
  src/styles/minimapPointerFix.css

NO App.jsx CHANGE IS REQUIRED.
