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


## Touch controls

Touchscreen devices automatically receive an in-game control overlay:

- Left joystick: move / strafe.
- Right joystick: aim in 2D or look in 3D; on combat levels, touching it also attacks.
- WEAPON: cycles to the next owned weapon.
- P1 / P2: activate stored power-up slots.
- Labyrinth replaces combat buttons with a BREAKER button.

Keyboard and mouse controls remain enabled on desktop and touchscreen laptops.

## Labyrinth

The fourth opening-page option is **Labyrinth: The Shifting Dark**.

Before a run, choose:

- Difficulty: Easy, Normal, Hard, or Nightmare.
- Time limit: 1–10 minutes. Longer limits generate larger, harder mazes.

Labyrinth rules:

- No enemies, weapons, ammo, medkits, or standard power-ups.
- The maze changes repeatedly during the run while preserving a route to the exit.
- Shifts are deliberately biased toward the player's current area so walls can visibly change inside the circle of light.
- Purple Wall Breaker pickups can be stored up to 10 at a time.
- Activating one gives 10 seconds of wall smashing.
- Silver braced steel walls are generated as complete wall segments, are more common, and cannot be smashed.
- There is no revealing minimap. The locator shows only a blue player dot and green exit dot.
- Labyrinth has its own dark lighting, reduced sight distance, and procedural music theme.
- Reach the exit before the countdown reaches zero.
- Labyrinth runs are not submitted to the combat leaderboards.

## Mobile visibility upgrade

The current build includes:

- Vercel Web Analytics.
- Automatic touchscreen controls.
- Left joystick for movement.
- Right AIM/LOOK joystick attacks while touched.
- 1.7x player-following camera zoom in 2D on touch devices.
- Full-viewport mobile gameplay.
- Landscape-first layout with a rotate-phone prompt in portrait.
- Compact mobile health/ammo/weapon/time HUD.
- Combat levels retain the mobile minimap and Sonar enemy markers.
- Labyrinth uses only the blue/green-dot locator and never stores discovered-map tiles.
- Higher canvas contrast on mobile.
- Fullscreen/landscape button where the browser supports it.
- Desktop keyboard and mouse controls remain unchanged.


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

Support counts are click attempts, not confirmed payments. The client has no
SELECT permission on the analytics table; dashboard reads go through the
server-only Vercel function.

