MIST MAZE — 2.0 HIGH-IMPACT MANUAL FILES

NO TERMINAL REQUIRED.

WHAT THIS ADDS
1. Weapon recoil + camera kick
   - pistol: sharp snap
   - shotgun: heavy jolt
   - SMG: light rapid vibration
   - DMR/revolver: heavier kick
   - Robbienator DMR gets extra wobble

2. Combat impact feedback
   - enemy hit flashes
   - enemy death bursts
   - theme-based wall impact particles
   - damage camera shake

3. Animated pickups
   - pulsing glow
   - floating motion
   - rotating highlights
   - stronger Legendary presentation

4. Better result/PB presentation
   - NEW PERSONAL BEST screen
   - run time
   - improvement vs previous local PB
   - explored percentage

5. Run escalation
   - EARLY / MID / LATE / FINAL STRETCH
   - subtle stronger vignette/tension
   - progressively more aggressive enemy movement/wake radius

6. SKIP CITY / UNLOCK ORBITAL RUINS button
   - records City progression locally
   - does NOT create a leaderboard score

CITY
The accepted City wall/fog renderer is included unchanged as the base City layer.

RAPID FIRE
The existing enhanced Rapid Fire logic is preserved unchanged.
Its faster fire rate still scales ammo cost so continuous firing for the same amount
of time uses approximately the same total ammo as normal firing.

FINDER INSTALL
Copy/replace the files into the matching locations:

maze-arsenal/
├── vite.config.js
└── src/
    ├── components/
    │   └── LevelSelectScreen-2.0.jsx
    └── game/
        ├── gameplay-2.0.js
        ├── rendering-2.0.js
        └── rendering-city-conform.js

IMPORTANT
Replace vite.config.js.
Add/replace the three game files.
Add LevelSelectScreen-2.0.jsx.

Keep all your existing files. These wrappers depend on the existing enhanced files.
