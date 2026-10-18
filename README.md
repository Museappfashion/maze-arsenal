# Mist Maze

## Folder structure

```text
mist-maze/
├── api/
│   ├── country.js
│   └── developer-analytics.js
├── src/
│   ├── App.jsx
│   └── main.jsx
├── supabase/
│   ├── setup.sql
│   └── developer-analytics.sql
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## First-time setup

1. Install Node.js 20.19+ or 22.12+ (or newer) for Vite 8.
2. Open a terminal in this folder.
3. Run:

```bash
npm install
```

4. Copy `.env.example` to `.env.local`.
5. Put your real Supabase Project URL and Publishable Key in `.env.local`.
6. In Supabase, enable **Authentication -> Anonymous Sign-Ins**.
7. In Supabase **SQL Editor**, run `supabase/setup.sql`.
8. Start locally:

```bash
npm run dev
```

9. Test a production build:

```bash
npm run build
```

## GitHub

Do not upload `.env.local`.

```bash
git init
git add .
git commit -m "Rebrand game as Mist Maze"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/maze-arsenal.git
git push -u origin main
```

## Vercel

1. Import the GitHub repository into Vercel.
2. Vercel should detect **Vite** automatically.
3. Add these environment variables in Vercel Project Settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
   - `DEVELOPER_DASHBOARD_KEY`

`SUPABASE_SECRET_KEY` and `DEVELOPER_DASHBOARD_KEY` are server-only. Never
prefix either one with `VITE_`.
4. Deploy.
5. Test the generated `.vercel.app` address.
6. Add your custom domain under Vercel Project -> Settings -> Domains.
7. Copy the DNS records Vercel shows into the DNS settings at your domain registrar.

`api/country.js` is a Vercel Function used for leaderboard country flags.

## Vercel Web Analytics

The project includes `@vercel/analytics` and mounts `<Analytics />` in
`src/main.jsx`.

In Vercel, open the project and enable **Analytics**. After the updated
deployment is live, visit the production site and Vercel will begin collecting
traffic data.


## Thanksgiving: Free the flock

The **Only until Thanksgiving** card on the opening page leads to a separate
farm lobby and farm supply store, with a **Back to first page** button. This
season runs through U.S. Thanksgiving, **November 26, 2026**, in the player's
local time. New runs close at midnight afterward; a run already in progress
can finish. The deadline lives in `src/services/thanksgivingSeason.js`.

The farm is a randomized 66 × 66 mesh of tangled paths, matching Abandoned
City's footprint. Irregular crop pens, bent chicken-wire walls, barns, hay
bales, crates, barrels, and carts create tight turns and confusing junctions.
Every open area remains connected; the layout changes on each run. You play
as a turkey; you and the farmer start at random, safely separated locations.
The farmer navigates the obstacles at 1.1× the turkey's normal movement speed.
Rescue as many caged turkeys as possible before being caught. Cages, corn, and
power-ups continuously replenish in random open locations, with population
caps to keep long runs stable.

- Move with **WASD / arrows** or the touch joystick.
- Hold **E / Space** or **FREE** near a cage to rescue its turkey.
- Walk over corn to earn **1 hux per piece**.
- Press **1–5** or tap a supply: Turkey Trot, Mud Trap, Haystack Hop, Feather Gust, or Fence Slip.
- Mud Trap slows the farmer when crossed; Feather Gust pushes a nearby farmer away; Fence Slip crosses chicken wire briefly. These replace Farmer Stunner, Scarecrow Decoy, and Cornfield Cover, keeping saved charges.
- Press **Escape** to pause; losing focus also pauses the chase.

Hux buys single-use farm supplies. Free supplies are much denser: 45 on entry,
up to 60 at once, with new pickups every second. As you move, the game keeps
at least three supplies within 12 walking tiles, using actual open paths.

| Farm supply | Effect |
| --- | --- |
| Turkey Trot | Double movement speed for 12 seconds |
| Mud Trap | A 25-second puddle slows the farmer by 80% for 10 seconds when crossed |
| Haystack Hop | Teleport at least 20 tiles away and 28 tiles from the farmer, plus 4 seconds of double speed |
| Feather Gust | From up to 14 clear tiles away, push the farmer up to 10 tiles and stagger him for 2.5 seconds |
| Fence Slip | Cross chicken wire for 12 seconds; solid obstacles and outer bounds remain solid |

Hux, unused supplies, best rescue count, and total rescued turkeys are saved
in browser storage separately from Miz and the original game's progression.
Getting caught or returning to the menu keeps all earned rewards.

**Turkey Disguise costs 1,000 hux; Blobby Alien costs 10,000 MIZ**, with one character equipped at a time. Both are plain in Abandoned
City, wear a space helmet in Orbital Ruins, a jungle hat in Emerald Wilds,
and a metal helmet in Fallen Keep. Buy and equip them in Myst's Store or the
farm store. In 2D they replace the character sprite; 3D shows the character
in the existing status display. Characters never change movement, collision,
combat, or leaderboard eligibility. Existing hux-bought turkey unlocks and
their equipped state migrate automatically without charging again.

Three additional permanent player skins are available in Myst's Store:
**Shadow Wisp (3,500 MIZ)**, **Ember Spirit (6,000 MIZ)**, and **Crystal Guardian
(8,000 MIZ)**. Their full player silhouettes, themed details, and 3D status
portraits change the character itself. These share the single equipped
character slot with turkey and alien, persist across reloads, and preserve
all combat stats. The store groups player cosmetics separately from coin
and counter decorations.

The farm retains its autumn style and randomized connected paths, with fewer
pens, walls, and solid obstacles to create more room for evasion.

Farm regression checks:

```bash
node --test scripts/tests/thanksgiving.test.mjs scripts/tests/hux-economy.test.mjs
# With the dev server running and Playwright available:
GAME_TEST_URL=http://127.0.0.1:5189 node scripts/tests/thanksgiving-browser.mjs
GAME_TEST_URL=http://127.0.0.1:5189 node scripts/tests/turkey-cosmetic-browser.mjs
GAME_TEST_URL=http://127.0.0.1:5189 node scripts/tests/october-update-browser.mjs
```

## October update

The calm blue update board on the first page lists the current release's
changes. The existing menus, themes, and Free the Flock artwork are retained.

- Every combat maze has **50 additional ammo pickups and 50 additional medkits**, on distinct reachable tiles. Labyrinth remains free of combat supplies.
- Every Labyrinth difficulty now shifts at **30-second intervals**.
- Rankings show unnamed opponents as **Random Player**. Your custom name includes **(you)**; an entry already named You does not repeat the suffix.
- 3D environments use perspective floor textures, stable world-anchored wall materials, and wall-depth clipping for sprites. Abandoned City has skyscrapers of varying heights, windowed facades, foundations, and textured asphalt. Orbital Ruins has an open-space backdrop with exposed cosmic rock surfaces. Emerald Wilds uses natural vegetation and roots for barriers. Fallen Keep has large, weathered flagstones.
- Coin cosmetics cost **20–180 MIZ**. Blobby Alien costs **10,000 MIZ**; Turkey Disguise costs **1,000 hux**. One-use powers cost **250–2,500 MIZ**.

The **MYST POWERS** control in a combat run activates purchased charges. A
charge is spent only when its effect can apply. Mist Guard replaces Null
Pulse; existing Null Pulse inventory becomes Mist Guard inventory.

| Power | MIZ | Effect |
| --- | ---: | --- |
| Vital Restore | 350 | Restore health to maximum |
| Ammo Refill | 250 | Refill ammo to maximum |
| Mist Guard | 800 | Eight seconds of immunity and clear hostile projectiles |
| Velocity Bloom | 650 | 75% faster movement for 30 seconds |
| Field Armor | 600 | Half incoming damage for 30 seconds |
| Cartographer Flash | 1000 | Reveal the map without awarding exploration coins |
| Arsenal Key | 1500 | Unlock standard weapons for this run |
| Purge Orb | 1250 | Defeat the eight nearest standard enemies; bosses are excluded |
| Phoenix Spark | 2000 | Revive after defeat at half health with eight seconds of protection |
| Exit Fold | 2500 | Move directly to the exit |

Phoenix Spark is available through MYST POWERS on the defeat screen. Revival
and Exit Fold make the run unranked. All purchased and unused charges remain
saved between runs.

## Touch controls

Touchscreen devices automatically receive an in-game control overlay:

- Left joystick: move / strafe.
- Right joystick: aim in 2D or look in 3D; on combat levels, touching it also attacks.
- WEAPON: cycles to the next owned weapon.
- P1 / P2: activate stored power-up slots.
- Labyrinth replaces combat buttons with LIGHT and BREAKER controls.

Keyboard and mouse controls remain enabled on desktop and touchscreen laptops.

## Labyrinth

The fourth opening-page option is **Labyrinth: The Shifting Dark**.

Before a run, choose:

- Difficulty: Easy, Normal, Hard, or Nightmare.
- Time limit: 1–10 minutes. Longer limits generate larger, harder mazes.

Labyrinth rules:

- No enemies, weapons, ammo, medkits, or standard power-ups.
- Every shift generates an entirely new maze topology while preserving the player's exact position and the fixed exit position.
- Collected lights, the equipped light, stored Wall Breakers, the active Breaker timer, and the run timer survive each full rebuild.
- Ten collectible light tools replace weapons: Candle, Glowstick, Flashlight, Lantern, Headlamp, Floodlight, Searchlight, Twin Beam, Prism Lamp, and Watcher's Lantern.
- The original Labyrinth base light is always present. Collected lights add circular or directional illumination on top of it.
- Purple Wall Breaker pickups can be stored up to 10 at a time.
- Activating one gives 10 seconds of wall smashing.
- Silver braced steel walls are generated as complete logical wall segments and cannot be smashed.
- There is no revealing minimap. The locator shows only a blue player dot and green exit dot.
- Labyrinth has its own dark lighting and procedural music theme.
- Reach the exit before the countdown reaches zero.
- Labyrinth runs are not submitted to the combat leaderboards.

## Mobile visibility upgrade

The current build includes:

- Vercel Web Analytics.
- Automatic touchscreen controls.
- Left joystick for movement.
- Right AIM/LOOK joystick uses absolute aiming in 2D and finger-delta looking in 3D; releasing or canceling the touch immediately clears the control.
- 1.7x player-following camera zoom in 2D on touch devices.
- Full-viewport mobile gameplay.
- Landscape-first layout with a rotate-phone prompt in portrait.
- Compact mobile health/ammo/weapon/time HUD.
- Combat levels retain the mobile minimap and Sonar enemy markers.
- Labyrinth uses LIGHT and BREAKER actions, keeps the original base light at all times, and uses only the blue/green-dot locator without storing discovered-map tiles.
- Higher canvas contrast on mobile.
- Fullscreen/landscape button where the browser supports it.
- Desktop keyboard and mouse controls remain unchanged.

## View settings and run summary

The **VIEW** section in Settings includes three persistent controls, all on by
default:

- **Labels** — shows or hides in-world labels.
- **Minimap** — shows or hides the minimap in both 2D and 3D.
- **Pointer** — shows or hides the exit guide. The guide compares 16 directions
  and lights the closest direction toward the exit.

The minimap is rendered through a stable buffered canvas so a completed frame
replaces the previous frame without exposing a cleared canvas.

At the end of every run, the game displays enemies killed, maze discovered,
and the remaining straight-line distance to the exit as a percentage of the
spawn-to-exit distance. **Play Again** starts a fresh run with the same level
settings, while **Main Menu** returns to level selection.

Run the production build and the Vite-alias import-cycle audit together with:

```bash
npm run verify
```


## Combat behavior

- Once an enemy begins pursuing the player, its pursuit speed multiplier ramps linearly from 1x to 3x over 10 seconds and remains at 3x for that pursuit.
- Charger charge speed stacks multiplicatively with the pursuit multiplier.
- Frost still halves the resulting enemy movement speed.
- Temporary maximum-capacity effects never confiscate resources already earned when they expire. Juggernaut can therefore leave health above the normal maximum until damage reduces it naturally.
- Healing and ammo-grant paths preserve existing overflow rather than clamping it downward.



## Developer analytics

Run `supabase/developer-analytics.sql` if the original database setup was
already completed before this feature was added. Fresh installs can simply run
the current `supabase/setup.sql`.

The private dashboard is available at:

```text
/?developer=1
```

Enter the value configured as `DEVELOPER_DASHBOARD_KEY`.

The dashboard shows per anonymous Supabase user:

- games started and finished,
- total active play minutes,
- `$1`, `$2`, `$5`, and custom support-button click attempts,
- latest in-game player name and last-seen time.

The paper-and-pencil button beside Settings lets players send private letters
to the developer. Existing Supabase projects must run
`supabase/developer-letters.sql` once. Letters then appear in the Developer
Inbox on `/?developer=1`.

Support counts are click attempts, not confirmed payments. The client has no
SELECT permission on the analytics table; dashboard reads go through the
server-only Vercel function.
