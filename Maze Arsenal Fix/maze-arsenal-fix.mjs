// tools/apply-hardening.mjs
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function target(filePath) {
  return path.join(root, filePath);
}

function read(filePath) {
  return fs.readFileSync(target(filePath), "utf8");
}

function write(filePath, content) {
  const file = target(filePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`);
}

function replaceRegex(filePath, pattern, replacement, expected = 1) {
  const source = read(filePath);
  const matches = [...source.matchAll(pattern)];

  if (matches.length !== expected) {
    throw new Error(
      `${filePath}: expected ${expected} match(es), found ${matches.length}.`,
    );
  }

  write(filePath, source.replace(pattern, replacement));
}

function removeIfPresent(filePath) {
  const file = target(filePath);
  if (fs.existsSync(file)) {
    fs.rmSync(file);
  }
}

function updatePackageFiles() {
  const packageJson = JSON.parse(read("package.json"));

  packageJson.scripts = {
    ...packageJson.scripts,
    test: "node --test",
    check: "npm run test && npm run build",
  };
  packageJson.engines = {
    node: ">=22.12.0",
  };
  write("package.json", JSON.stringify(packageJson, null, 2));

  const packageLock = JSON.parse(read("package-lock.json"));
  packageLock.version = "1.1.0";
  packageLock.packages[""].version = "1.1.0";
  packageLock.packages[""].dependencies["@vercel/analytics"] = "2.0.1";
  packageLock.packages[""].dependencies["@vercel/speed-insights"] = "^2.0.0";
  packageLock.packages[""].engines = {
    node: ">=22.12.0",
  };
  packageLock.packages["node_modules/@vercel/speed-insights"] = {
    version: "2.0.0",
    resolved:
      "https://registry.npmjs.org/@vercel/speed-insights/-/speed-insights-2.0.0.tgz",
    integrity:
      "sha512-jwkNcrTeafWxjmWq4AHBaptSqZiJkYU5adLC9QBSqeim0GcqDMgN5Ievh8OG1rJ6W3A4l1oiP7qr9CWxGuzu3w==",
    license: "Apache-2.0",
    peerDependencies: {
      "@sveltejs/kit": "^1 || ^2",
      next: ">= 13",
      nuxt: ">= 3",
      react: "^18 || ^19 || ^19.0.0-rc",
      svelte: ">= 4",
      vue: "^3",
      "vue-router": "^4",
    },
    peerDependenciesMeta: {
      "@sveltejs/kit": { optional: true },
      next: { optional: true },
      nuxt: { optional: true },
      react: { optional: true },
      svelte: { optional: true },
      vue: { optional: true },
      "vue-router": { optional: true },
    },
  };
  write("package-lock.json", JSON.stringify(packageLock, null, 2));
}

updatePackageFiles();

write("api/country.js", "// api/country.js\nconst COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;\n\nfunction json(data, status = 200) {\n  return Response.json(data, {\n    status,\n    headers: {\n      \"Cache-Control\": \"public, max-age=0, must-revalidate\",\n    },\n  });\n}\n\nexport default {\n  async fetch(request) {\n    if (request.method !== \"GET\") {\n      return json({ error: \"Method not allowed.\" }, 405);\n    }\n\n    const country = String(\n      request.headers.get(\"x-vercel-ip-country\") ?? \"\",\n    )\n      .trim()\n      .toUpperCase();\n\n    return json({\n      country: COUNTRY_CODE_PATTERN.test(country) ? country : \"\",\n    });\n  },\n};\n");

write("api/developer-usage.js", "// api/developer-usage.js\nimport { createClient } from \"@supabase/supabase-js\";\n\nconst VALID_EVENTS = new Set([\n  \"visitor\",\n  \"game_start\",\n  \"game_finish\",\n  \"playtime\",\n  \"donation\",\n]);\nconst VALID_DONATION_KEYS = new Set([\"1\", \"2\", \"5\", \"custom\"]);\nconst MAX_PLAYTIME_SECONDS = 120;\n\nfunction json(data, status = 200) {\n  return Response.json(data, {\n    status,\n    headers: {\n      \"Cache-Control\": \"private, no-store\",\n    },\n  });\n}\n\nfunction getBearerToken(request) {\n  const header = request.headers.get(\"authorization\") ?? \"\";\n  return header.startsWith(\"Bearer \") ? header.slice(7).trim() : \"\";\n}\n\nfunction getServerSupabase() {\n  const supabaseUrl =\n    process.env.SUPABASE_URL?.trim() ??\n    process.env.VITE_SUPABASE_URL?.trim() ??\n    \"\";\n  const supabaseSecret = process.env.SUPABASE_SECRET_KEY?.trim() ?? \"\";\n\n  if (!supabaseUrl || !supabaseSecret) {\n    return null;\n  }\n\n  return createClient(supabaseUrl, supabaseSecret, {\n    auth: {\n      persistSession: false,\n      autoRefreshToken: false,\n    },\n  });\n}\n\nasync function getAuthenticatedUser(supabase, request) {\n  const accessToken = getBearerToken(request);\n\n  if (!accessToken) {\n    return null;\n  }\n\n  const {\n    data: { user },\n    error,\n  } = await supabase.auth.getUser(accessToken);\n\n  return error ? null : user;\n}\n\nexport default {\n  async fetch(request) {\n    if (request.method !== \"POST\") {\n      return json({ error: \"Method not allowed.\" }, 405);\n    }\n\n    const supabase = getServerSupabase();\n\n    if (!supabase) {\n      return json({ error: \"Developer analytics server is not configured.\" }, 503);\n    }\n\n    const user = await getAuthenticatedUser(supabase, request);\n\n    if (!user) {\n      return json({ error: \"Unauthorized.\" }, 401);\n    }\n\n    let body;\n    try {\n      body = await request.json();\n    } catch {\n      return json({ error: \"Invalid JSON body.\" }, 400);\n    }\n\n    const eventType = String(body?.eventType ?? \"\");\n    const donationKey =\n      body?.donationKey == null ? null : String(body.donationKey);\n\n    if (!VALID_EVENTS.has(eventType)) {\n      return json({ error: \"Invalid analytics event.\" }, 400);\n    }\n\n    if (\n      eventType === \"donation\" &&\n      !VALID_DONATION_KEYS.has(donationKey)\n    ) {\n      return json({ error: \"Invalid donation key.\" }, 400);\n    }\n\n    const seconds = Math.min(\n      MAX_PLAYTIME_SECONDS,\n      Math.max(0, Math.round(Number(body?.seconds) || 0)),\n    );\n    const playerName =\n      String(body?.playerName ?? \"\").trim().slice(0, 20) || null;\n    const { error } = await supabase.rpc(\n      \"record_developer_usage_server\",\n      {\n        p_user_id: user.id,\n        p_event: eventType,\n        p_donation_key: donationKey,\n        p_seconds: seconds,\n        p_player_name: playerName,\n      },\n    );\n\n    if (error) {\n      console.error(\"Developer analytics event failed:\", error.message);\n      return json({ error: \"Could not record analytics event.\" }, 500);\n    }\n\n    return json({ ok: true });\n  },\n};\n");

write("api/developer-analytics.js", "// api/developer-analytics.js\nimport { createClient } from \"@supabase/supabase-js\";\n\nconst PAGE_SIZE = 1000;\n\nfunction json(data, status = 200) {\n  return Response.json(data, {\n    status,\n    headers: {\n      \"Cache-Control\": \"private, no-store\",\n    },\n  });\n}\n\nfunction getBearerToken(request) {\n  const header = request.headers.get(\"authorization\") ?? \"\";\n  return header.startsWith(\"Bearer \") ? header.slice(7).trim() : \"\";\n}\n\nfunction getServerSupabase() {\n  const supabaseUrl =\n    process.env.SUPABASE_URL?.trim() ??\n    process.env.VITE_SUPABASE_URL?.trim() ??\n    \"\";\n  const supabaseSecret = process.env.SUPABASE_SECRET_KEY?.trim() ?? \"\";\n\n  if (!supabaseUrl || !supabaseSecret) {\n    return null;\n  }\n\n  return createClient(supabaseUrl, supabaseSecret, {\n    auth: {\n      persistSession: false,\n      autoRefreshToken: false,\n    },\n  });\n}\n\nasync function listAuthUsers(supabase) {\n  const users = [];\n\n  for (let page = 1; ; page += 1) {\n    const { data, error } = await supabase.auth.admin.listUsers({\n      page,\n      perPage: PAGE_SIZE,\n    });\n\n    if (error) {\n      throw error;\n    }\n\n    const pageUsers = data?.users ?? [];\n    users.push(...pageUsers);\n\n    if (pageUsers.length < PAGE_SIZE) {\n      return users;\n    }\n  }\n}\n\nasync function listUsageRows(supabase) {\n  const rows = [];\n\n  for (let from = 0; ; from += PAGE_SIZE) {\n    const { data, error } = await supabase\n      .from(\"developer_usage_stats\")\n      .select(\n        [\n          \"user_id\",\n          \"last_player_name\",\n          \"games_started\",\n          \"games_finished\",\n          \"seconds_played\",\n          \"donation_1_attempts\",\n          \"donation_2_attempts\",\n          \"donation_5_attempts\",\n          \"donation_custom_attempts\",\n          \"last_seen_at\",\n        ].join(\",\"),\n      )\n      .order(\"last_seen_at\", { ascending: false })\n      .range(from, from + PAGE_SIZE - 1);\n\n    if (error) {\n      throw error;\n    }\n\n    const pageRows = data ?? [];\n    rows.push(...pageRows);\n\n    if (pageRows.length < PAGE_SIZE) {\n      return rows;\n    }\n  }\n}\n\nfunction normalizeUsageRow(row) {\n  return {\n    userId: row.user_id,\n    playerName: row.last_player_name ?? \"\",\n    gamesStarted: Number(row.games_started ?? 0),\n    gamesFinished: Number(row.games_finished ?? 0),\n    secondsPlayed: Number(row.seconds_played ?? 0),\n    donation1Attempts: Number(row.donation_1_attempts ?? 0),\n    donation2Attempts: Number(row.donation_2_attempts ?? 0),\n    donation5Attempts: Number(row.donation_5_attempts ?? 0),\n    donationCustomAttempts: Number(row.donation_custom_attempts ?? 0),\n    lastSeenAt: row.last_seen_at ?? null,\n  };\n}\n\nfunction emptyUsageForAuthUser(user) {\n  return {\n    userId: user.id,\n    playerName: \"\",\n    gamesStarted: 0,\n    gamesFinished: 0,\n    secondsPlayed: 0,\n    donation1Attempts: 0,\n    donation2Attempts: 0,\n    donation5Attempts: 0,\n    donationCustomAttempts: 0,\n    lastSeenAt: user.last_sign_in_at ?? user.created_at ?? null,\n  };\n}\n\nfunction buildTotals(users) {\n  return users.reduce(\n    (result, user) => {\n      result.gamesStarted += user.gamesStarted;\n      result.gamesFinished += user.gamesFinished;\n      result.secondsPlayed += user.secondsPlayed;\n      result.donationAttempts +=\n        user.donation1Attempts +\n        user.donation2Attempts +\n        user.donation5Attempts +\n        user.donationCustomAttempts;\n      return result;\n    },\n    {\n      users: users.length,\n      gamesStarted: 0,\n      gamesFinished: 0,\n      secondsPlayed: 0,\n      donationAttempts: 0,\n    },\n  );\n}\n\nexport default {\n  async fetch(request) {\n    if (request.method !== \"GET\") {\n      return json({ error: \"Method not allowed.\" }, 405);\n    }\n\n    const dashboardKey = process.env.DEVELOPER_DASHBOARD_KEY?.trim() ?? \"\";\n    const suppliedKey = getBearerToken(request);\n\n    if (!dashboardKey || !suppliedKey || suppliedKey !== dashboardKey) {\n      return json({ error: \"Unauthorized.\" }, 401);\n    }\n\n    const supabase = getServerSupabase();\n\n    if (!supabase) {\n      return json(\n        { error: \"Developer analytics server is not configured.\" },\n        503,\n      );\n    }\n\n    let usageRows;\n    try {\n      usageRows = await listUsageRows(supabase);\n    } catch (error) {\n      console.error(\"Developer analytics query failed:\", error?.message ?? error);\n      return json({ error: \"Analytics query failed.\" }, 500);\n    }\n\n    const userMap = new Map(\n      usageRows\n        .map(normalizeUsageRow)\n        .map((user) => [user.userId, user]),\n    );\n\n    try {\n      const authUsers = await listAuthUsers(supabase);\n      for (const authUser of authUsers) {\n        if (!userMap.has(authUser.id)) {\n          userMap.set(authUser.id, emptyUsageForAuthUser(authUser));\n        }\n      }\n    } catch (error) {\n      console.warn(\n        \"Developer analytics auth-user merge failed:\",\n        error?.message ?? error,\n      );\n    }\n\n    const users = [...userMap.values()].sort((left, right) => {\n      const leftTime = Date.parse(left.lastSeenAt ?? \"\") || 0;\n      const rightTime = Date.parse(right.lastSeenAt ?? \"\") || 0;\n      return rightTime - leftTime;\n    });\n\n    return json({\n      totals: buildTotals(users),\n      users,\n    });\n  },\n};\n");

write("src/services/developerAnalytics.js", "// src/services/developerAnalytics.js\nimport { ensureGlobalLeaderboardSession, supabase } from \"./leaderboard.js\";\n\nconst PLAYTIME_HEARTBEAT_LIMIT_SECONDS = 120;\nconst DEVELOPER_USAGE_ENDPOINT = \"/api/developer-usage\";\n\nasync function recordUsage({\n  eventType,\n  donationKey = null,\n  seconds = 0,\n  playerName = \"\",\n}) {\n  if (!supabase) {\n    return false;\n  }\n\n  try {\n    const session = await ensureGlobalLeaderboardSession();\n    const normalizedSeconds = Math.min(\n      PLAYTIME_HEARTBEAT_LIMIT_SECONDS,\n      Math.max(0, Math.round(Number(seconds) || 0)),\n    );\n    const response = await fetch(DEVELOPER_USAGE_ENDPOINT, {\n      method: \"POST\",\n      headers: {\n        Accept: \"application/json\",\n        Authorization: `Bearer ${session.access_token}`,\n        \"Content-Type\": \"application/json\",\n      },\n      body: JSON.stringify({\n        eventType,\n        donationKey,\n        seconds: normalizedSeconds,\n        playerName: String(playerName ?? \"\").trim().slice(0, 20),\n      }),\n    });\n\n    if (!response.ok) {\n      const data = await response.json().catch(() => null);\n      throw new Error(data?.error ?? `Analytics request failed (${response.status}).`);\n    }\n\n    return true;\n  } catch (error) {\n    console.warn(\"Developer analytics event failed:\", error);\n    return false;\n  }\n}\n\nexport function recordDonationAttempt(donationKey) {\n  if (![\"1\", \"2\", \"5\", \"custom\"].includes(donationKey)) {\n    return Promise.resolve(false);\n  }\n\n  return recordUsage({\n    eventType: \"donation\",\n    donationKey,\n  });\n}\n\nexport function recordVisitorSeen() {\n  return recordUsage({\n    eventType: \"visitor\",\n  });\n}\n\nexport function recordGameStarted(world) {\n  return recordUsage({\n    eventType: \"game_start\",\n    playerName: world?.playerName ?? \"\",\n  });\n}\n\nexport function recordGameFinished(world) {\n  return recordUsage({\n    eventType: \"game_finish\",\n    seconds: PLAYTIME_HEARTBEAT_LIMIT_SECONDS,\n    playerName: world?.playerName ?? \"\",\n  });\n}\n\nexport function recordPlaySeconds(world, seconds) {\n  if (!Number.isFinite(seconds) || seconds <= 0) {\n    return Promise.resolve(false);\n  }\n\n  return recordUsage({\n    eventType: \"playtime\",\n    seconds,\n    playerName: world?.playerName ?? \"\",\n  });\n}\n");

write("src/components/RunEndOverlay.jsx", "// src/components/RunEndOverlay.jsx\nimport { formatTime } from \"../utils/math.js\";\n\nexport function RunEndOverlay({ world, onTryAgain, onMainMenu }) {\n  if (!world?.victory && !world?.gameOver) {\n    return null;\n  }\n\n  const victory = Boolean(world.victory);\n\n  return (\n    <div\n      role=\"dialog\"\n      aria-modal=\"true\"\n      aria-labelledby=\"run-end-title\"\n      style={{\n        position: \"fixed\",\n        inset: 0,\n        zIndex: 80,\n        display: \"grid\",\n        placeItems: \"center\",\n        padding: 20,\n        background: \"rgba(2, 6, 23, 0.74)\",\n        backdropFilter: \"blur(8px)\",\n      }}\n    >\n      <section\n        style={{\n          width: \"min(92vw, 390px)\",\n          padding: \"28px 24px 22px\",\n          borderRadius: 22,\n          border: \"1px solid rgba(148, 163, 184, 0.2)\",\n          background:\n            \"linear-gradient(180deg, rgba(15, 23, 42, 0.97), rgba(2, 6, 23, 0.98))\",\n          boxShadow: \"0 28px 90px rgba(0, 0, 0, 0.46)\",\n          textAlign: \"center\",\n        }}\n      >\n        <div\n          style={{\n            color: victory ? \"#67e8f9\" : \"#94a3b8\",\n            fontSize: 12,\n            fontWeight: 900,\n            letterSpacing: \"0.12em\",\n            textTransform: \"uppercase\",\n          }}\n        >\n          {victory ? \"Run complete\" : \"Run ended\"}\n        </div>\n        <h2\n          id=\"run-end-title\"\n          style={{\n            margin: \"8px 0 0\",\n            color: \"#f8fafc\",\n            fontSize: 32,\n            lineHeight: 1.08,\n          }}\n        >\n          {victory ? \"You escaped!\" : \"Try the maze again\"}\n        </h2>\n        <div\n          style={{\n            marginTop: 10,\n            color: \"#cbd5e1\",\n            fontSize: 15,\n          }}\n        >\n          {victory\n            ? `Escape time ${formatTime(world.time)}`\n            : `Run time ${formatTime(world.time)}`}\n        </div>\n        {victory &&\n          !world.labyrinthMode &&\n          world.leaderboardEligible === false && (\n            <div\n              style={{\n                marginTop: 12,\n                padding: \"9px 11px\",\n                borderRadius: 10,\n                background: \"rgba(245, 158, 11, 0.08)\",\n                border: \"1px solid rgba(245, 158, 11, 0.2)\",\n                color: \"#fbbf24\",\n                fontSize: 12,\n                lineHeight: 1.45,\n              }}\n            >\n              Leaderboard score not submitted because the view mode changed\n              during this run. Your existing personal best is unchanged.\n            </div>\n          )}\n        <button\n          type=\"button\"\n          onClick={onTryAgain}\n          autoFocus\n          style={{\n            width: \"100%\",\n            marginTop: 24,\n            padding: \"13px 18px\",\n            border: \"1px solid rgba(103, 232, 249, 0.7)\",\n            borderRadius: 14,\n            background:\n              \"linear-gradient(135deg, rgba(14, 165, 233, 0.96), rgba(6, 182, 212, 0.94))\",\n            color: \"#f8fafc\",\n            fontSize: 15,\n            fontWeight: 900,\n            letterSpacing: \"0.04em\",\n            cursor: \"pointer\",\n            boxShadow: \"0 12px 32px rgba(8, 145, 178, 0.24)\",\n          }}\n        >\n          TRY AGAIN\n        </button>\n        <button\n          type=\"button\"\n          onClick={onMainMenu}\n          style={{\n            marginTop: 9,\n            padding: \"7px 10px\",\n            border: \"1px solid rgba(148, 163, 184, 0.14)\",\n            borderRadius: 10,\n            background: \"rgba(15, 23, 42, 0.34)\",\n            color: \"#94a3b8\",\n            fontSize: 12,\n            fontWeight: 700,\n            cursor: \"pointer\",\n            opacity: 0.82,\n          }}\n        >\n          Back to main menu\n        </button>\n      </section>\n    </div>\n  );\n}\n");

write("src/components/ModeSwitchWarning.jsx", `// src/components/ModeSwitchWarning.jsx
export function ModeSwitchWarning({
  fromMode,
  toMode,
  onConfirm,
  onCancel,
}) {
  const fromLabel = fromMode === "3d" ? "3D" : "2D";
  const toLabel = toMode === "3d" ? "3D" : "2D";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mode-switch-warning-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(2, 6, 23, 0.72)",
        backdropFilter: "blur(7px)",
      }}
    >
      <section
        style={{
          width: "min(92vw, 430px)",
          padding: "25px 23px 21px",
          borderRadius: 20,
          border: "1px solid rgba(245, 158, 11, 0.34)",
          background:
            "linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.99))",
          boxShadow: "0 26px 80px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div
          style={{
            color: "#fbbf24",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Leaderboard warning
        </div>
        <h2
          id="mode-switch-warning-title"
          style={{
            margin: "8px 0 0",
            color: "#f8fafc",
            fontSize: 24,
            lineHeight: 1.15,
          }}
        >
          Switch from {fromLabel} to {toLabel}?
        </h2>
        <p
          style={{
            margin: "12px 0 0",
            color: "#cbd5e1",
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          Switching view mode during an active run makes this run ineligible
          for the leaderboard. Your existing personal best will not be deleted.
          This warning is shown only on your first confirmed switch.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            style={{
              padding: "11px 13px",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: 12,
              background: "rgba(15, 23, 42, 0.55)",
              color: "#cbd5e1",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            STAY IN {fromLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "11px 13px",
              border: "1px solid rgba(245, 158, 11, 0.5)",
              borderRadius: 12,
              background: "rgba(217, 119, 6, 0.9)",
              color: "#fff7ed",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            SWITCH ANYWAY
          </button>
        </div>
      </section>
    </div>
  );
}
`);

write("supabase/setup.sql", "-- supabase/setup.sql\n-- Mist Maze secure leaderboard and private developer analytics.\n-- Safe to re-run. Enable Authentication -> Anonymous Sign-Ins first.\n\ncreate table if not exists public.leaderboard_scores (\n  id bigint generated by default as identity primary key,\n  user_id uuid not null references auth.users(id) on delete cascade,\n  player_name text not null\n    check (char_length(player_name) between 1 and 20),\n  level_key text not null\n    check (level_key in ('level1', 'level2', 'level3')),\n  mode text not null\n    check (mode in ('2d', '3d')),\n  time_seconds numeric(10, 3) not null\n    check (time_seconds > 0 and time_seconds < 21600),\n  country_code text\n    check (country_code is null or country_code ~ '^[A-Z]{2}$'),\n  created_at timestamptz not null default now()\n);\n\nalter table public.leaderboard_scores\n  add column if not exists country_code text;\n\nalter table public.leaderboard_scores\n  drop constraint if exists leaderboard_scores_country_code_check;\n\nalter table public.leaderboard_scores\n  add constraint leaderboard_scores_country_code_check\n  check (\n    country_code is null\n    or country_code ~ '^[A-Z]{2}$'\n  );\n\nwith ranked_scores as (\n  select\n    id,\n    row_number() over (\n      partition by user_id, level_key, mode\n      order by time_seconds asc, created_at asc, id asc\n    ) as row_number\n  from public.leaderboard_scores\n)\ndelete from public.leaderboard_scores\nwhere id in (\n  select id\n  from ranked_scores\n  where row_number > 1\n);\n\ndrop index if exists public.leaderboard_scores_user_best_idx;\n\ncreate unique index if not exists leaderboard_scores_personal_best_uidx\n  on public.leaderboard_scores (user_id, level_key, mode);\n\ncreate index if not exists leaderboard_scores_fastest_idx\n  on public.leaderboard_scores\n  (level_key, mode, time_seconds, created_at);\n\nalter table public.leaderboard_scores enable row level security;\n\nrevoke all on table public.leaderboard_scores from anon;\nrevoke all on table public.leaderboard_scores from authenticated;\n\ndrop policy if exists \"leaderboard_read_all\"\n  on public.leaderboard_scores;\ndrop policy if exists \"leaderboard_insert_own\"\n  on public.leaderboard_scores;\n\ncreate table if not exists public.leaderboard_runs (\n  id uuid primary key default gen_random_uuid(),\n  user_id uuid not null references auth.users(id) on delete cascade,\n  level_key text not null\n    check (level_key in ('level1', 'level2', 'level3')),\n  mode text not null\n    check (mode in ('2d', '3d')),\n  started_at timestamptz not null default clock_timestamp()\n);\n\ncreate index if not exists leaderboard_runs_user_idx\n  on public.leaderboard_runs (user_id, started_at);\n\nalter table public.leaderboard_runs enable row level security;\n\nrevoke all on table public.leaderboard_runs from anon;\nrevoke all on table public.leaderboard_runs from authenticated;\n\ncreate or replace function public.start_leaderboard_run(\n  p_level_key text,\n  p_mode text\n)\nreturns uuid\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\ndeclare\n  current_user_id uuid := auth.uid();\n  new_run_id uuid;\nbegin\n  if current_user_id is null then\n    raise exception 'Authentication required';\n  end if;\n\n  if p_level_key not in ('level1', 'level2', 'level3') then\n    raise exception 'Invalid level';\n  end if;\n\n  if p_mode not in ('2d', '3d') then\n    raise exception 'Invalid mode';\n  end if;\n\n  delete from public.leaderboard_runs\n  where user_id = current_user_id;\n\n  insert into public.leaderboard_runs (\n    user_id,\n    level_key,\n    mode\n  )\n  values (\n    current_user_id,\n    p_level_key,\n    p_mode\n  )\n  returning id into new_run_id;\n\n  return new_run_id;\nend;\n$$;\n\nrevoke all\n  on function public.start_leaderboard_run(text, text)\n  from public, anon;\ngrant execute\n  on function public.start_leaderboard_run(text, text)\n  to authenticated;\n\ncreate or replace function public.finish_leaderboard_run(\n  p_run_id uuid,\n  p_player_name text,\n  p_country_code text default null\n)\nreturns jsonb\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\ndeclare\n  current_user_id uuid := auth.uid();\n  run_record public.leaderboard_runs%rowtype;\n  clean_name text := nullif(\n    left(trim(coalesce(p_player_name, '')), 20),\n    ''\n  );\n  clean_country text := nullif(upper(trim(coalesce(p_country_code, ''))), '');\n  elapsed_seconds numeric;\n  rounded_seconds numeric(10, 3);\n  minimum_seconds numeric;\n  affected_rows integer := 0;\nbegin\n  if current_user_id is null then\n    raise exception 'Authentication required';\n  end if;\n\n  delete from public.leaderboard_runs\n  where id = p_run_id\n    and user_id = current_user_id\n  returning * into run_record;\n\n  if not found then\n    raise exception 'Leaderboard run is missing or already finished';\n  end if;\n\n  elapsed_seconds := extract(\n    epoch from (clock_timestamp() - run_record.started_at)\n  );\n\n  minimum_seconds := case run_record.level_key\n    when 'level1' then 2\n    when 'level2' then 3\n    when 'level3' then 4\n    else 2\n  end;\n\n  if elapsed_seconds < minimum_seconds\n     or elapsed_seconds >= 21600 then\n    raise exception 'Leaderboard run duration is invalid';\n  end if;\n\n  rounded_seconds := round(elapsed_seconds, 3);\n\n  if clean_country is not null and clean_country !~ '^[A-Z]{2}$' then\n    clean_country := null;\n  end if;\n\n  insert into public.leaderboard_scores (\n    user_id,\n    player_name,\n    level_key,\n    mode,\n    time_seconds,\n    country_code,\n    created_at\n  )\n  values (\n    current_user_id,\n    coalesce(clean_name, 'You'),\n    run_record.level_key,\n    run_record.mode,\n    rounded_seconds,\n    clean_country,\n    clock_timestamp()\n  )\n  on conflict (user_id, level_key, mode)\n  do update set\n    player_name = excluded.player_name,\n    time_seconds = excluded.time_seconds,\n    country_code = excluded.country_code,\n    created_at = excluded.created_at\n  where excluded.time_seconds < public.leaderboard_scores.time_seconds;\n\n  get diagnostics affected_rows = row_count;\n\n  return jsonb_build_object(\n    'improved',\n    affected_rows > 0,\n    'timeSeconds',\n    rounded_seconds\n  );\nend;\n$$;\n\nrevoke all\n  on function public.finish_leaderboard_run(uuid, text, text)\n  from public, anon;\ngrant execute\n  on function public.finish_leaderboard_run(uuid, text, text)\n  to authenticated;\n\ncreate or replace function public.get_global_leaderboard()\nreturns table (\n  level_key text,\n  mode text,\n  player_name text,\n  country_code text,\n  time_seconds numeric,\n  created_at timestamptz,\n  global_rank bigint,\n  is_current_user boolean\n)\nlanguage sql\nsecurity definer\nset search_path = public\nas $$\n  with ranked as (\n    select\n      scores.user_id,\n      scores.level_key,\n      scores.mode,\n      scores.player_name,\n      scores.country_code,\n      scores.time_seconds,\n      scores.created_at,\n      rank() over (\n        partition by scores.level_key, scores.mode\n        order by scores.time_seconds asc, scores.created_at asc\n      ) as global_rank\n    from public.leaderboard_scores as scores\n  )\n  select\n    ranked.level_key,\n    ranked.mode,\n    ranked.player_name,\n    ranked.country_code,\n    ranked.time_seconds,\n    ranked.created_at,\n    ranked.global_rank,\n    ranked.user_id = (select auth.uid()) as is_current_user\n  from ranked\n  where\n    ranked.global_rank <= 10\n    or ranked.user_id = (select auth.uid())\n  order by\n    ranked.level_key,\n    ranked.mode,\n    ranked.global_rank;\n$$;\n\nrevoke all\n  on function public.get_global_leaderboard()\n  from public, anon;\ngrant execute\n  on function public.get_global_leaderboard()\n  to authenticated;\n\ncreate table if not exists public.developer_usage_stats (\n  user_id uuid primary key references auth.users(id) on delete cascade,\n  last_player_name text\n    check (\n      last_player_name is null\n      or char_length(last_player_name) between 1 and 20\n    ),\n  games_started bigint not null default 0\n    check (games_started >= 0),\n  games_finished bigint not null default 0\n    check (games_finished >= 0),\n  seconds_played bigint not null default 0\n    check (seconds_played >= 0),\n  donation_1_attempts bigint not null default 0\n    check (donation_1_attempts >= 0),\n  donation_2_attempts bigint not null default 0\n    check (donation_2_attempts >= 0),\n  donation_5_attempts bigint not null default 0\n    check (donation_5_attempts >= 0),\n  donation_custom_attempts bigint not null default 0\n    check (donation_custom_attempts >= 0),\n  created_at timestamptz not null default now(),\n  last_seen_at timestamptz not null default now()\n);\n\nalter table public.developer_usage_stats\n  add column if not exists active_run_started_at timestamptz;\nalter table public.developer_usage_stats\n  add column if not exists last_playtime_at timestamptz;\nalter table public.developer_usage_stats\n  add column if not exists last_game_start_at timestamptz;\nalter table public.developer_usage_stats\n  add column if not exists last_donation_at timestamptz;\n\nalter table public.developer_usage_stats enable row level security;\n\nrevoke all on table public.developer_usage_stats from anon;\nrevoke all on table public.developer_usage_stats from authenticated;\ngrant select on table public.developer_usage_stats to service_role;\n\ndrop function if exists public.record_developer_usage(\n  text,\n  text,\n  integer,\n  text\n);\n\ncreate or replace function public.record_developer_usage_server(\n  p_user_id uuid,\n  p_event text,\n  p_donation_key text default null,\n  p_seconds integer default 0,\n  p_player_name text default null\n)\nreturns void\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\ndeclare\n  current_time timestamptz := clock_timestamp();\n  clean_name text := nullif(\n    left(trim(coalesce(p_player_name, '')), 20),\n    ''\n  );\n  safe_seconds integer := greatest(\n    0,\n    least(coalesce(p_seconds, 0), 120)\n  );\n  wall_seconds integer := 0;\n  credited_seconds integer := 0;\n  stats public.developer_usage_stats%rowtype;\nbegin\n  if p_user_id is null then\n    raise exception 'User id is required';\n  end if;\n\n  if p_event is null\n     or p_event not in (\n       'visitor',\n       'game_start',\n       'game_finish',\n       'playtime',\n       'donation'\n     ) then\n    raise exception 'Invalid analytics event';\n  end if;\n\n  if p_event = 'donation'\n     and (\n       p_donation_key is null\n       or p_donation_key not in ('1', '2', '5', 'custom')\n     ) then\n    raise exception 'Invalid donation key';\n  end if;\n\n  insert into public.developer_usage_stats (\n    user_id,\n    last_player_name,\n    last_seen_at\n  )\n  values (\n    p_user_id,\n    clean_name,\n    current_time\n  )\n  on conflict (user_id) do nothing;\n\n  select *\n  into stats\n  from public.developer_usage_stats\n  where user_id = p_user_id\n  for update;\n\n  if stats.active_run_started_at is not null then\n    wall_seconds := greatest(\n      0,\n      floor(\n        extract(\n          epoch from (\n            current_time\n            - coalesce(stats.last_playtime_at, stats.active_run_started_at)\n          )\n        )\n      )::integer\n    );\n  end if;\n\n  if p_event = 'visitor' then\n    update public.developer_usage_stats\n    set\n      last_player_name = coalesce(clean_name, last_player_name),\n      last_seen_at = current_time\n    where user_id = p_user_id;\n    return;\n  end if;\n\n  if p_event = 'game_start' then\n    if stats.last_game_start_at is null\n       or current_time - stats.last_game_start_at >= interval '2 seconds' then\n      credited_seconds := least(wall_seconds, 120);\n\n      update public.developer_usage_stats\n      set\n        last_player_name = coalesce(clean_name, last_player_name),\n        games_started = games_started + 1,\n        seconds_played = seconds_played + credited_seconds,\n        active_run_started_at = current_time,\n        last_playtime_at = current_time,\n        last_game_start_at = current_time,\n        last_seen_at = current_time\n      where user_id = p_user_id;\n    else\n      update public.developer_usage_stats\n      set\n        last_player_name = coalesce(clean_name, last_player_name),\n        last_seen_at = current_time\n      where user_id = p_user_id;\n    end if;\n    return;\n  end if;\n\n  if p_event = 'playtime' then\n    if stats.active_run_started_at is not null then\n      credited_seconds := least(safe_seconds, wall_seconds, 120);\n      update public.developer_usage_stats\n      set\n        last_player_name = coalesce(clean_name, last_player_name),\n        seconds_played = seconds_played + credited_seconds,\n        last_playtime_at = current_time,\n        last_seen_at = current_time\n      where user_id = p_user_id;\n    end if;\n    return;\n  end if;\n\n  if p_event = 'game_finish' then\n    if stats.active_run_started_at is not null\n       and current_time - stats.active_run_started_at >= interval '1 second' then\n      credited_seconds := least(\n        greatest(safe_seconds, 0),\n        wall_seconds,\n        120\n      );\n\n      update public.developer_usage_stats\n      set\n        last_player_name = coalesce(clean_name, last_player_name),\n        games_finished = games_finished + 1,\n        seconds_played = seconds_played + credited_seconds,\n        active_run_started_at = null,\n        last_playtime_at = null,\n        last_seen_at = current_time\n      where user_id = p_user_id;\n    end if;\n    return;\n  end if;\n\n  if p_event = 'donation' then\n    if stats.last_donation_at is null\n       or current_time - stats.last_donation_at >= interval '2 seconds' then\n      update public.developer_usage_stats\n      set\n        donation_1_attempts = donation_1_attempts\n          + case when p_donation_key = '1' then 1 else 0 end,\n        donation_2_attempts = donation_2_attempts\n          + case when p_donation_key = '2' then 1 else 0 end,\n        donation_5_attempts = donation_5_attempts\n          + case when p_donation_key = '5' then 1 else 0 end,\n        donation_custom_attempts = donation_custom_attempts\n          + case when p_donation_key = 'custom' then 1 else 0 end,\n        last_donation_at = current_time,\n        last_seen_at = current_time\n      where user_id = p_user_id;\n    else\n      update public.developer_usage_stats\n      set last_seen_at = current_time\n      where user_id = p_user_id;\n    end if;\n  end if;\nend;\n$$;\n\nrevoke all\n  on function public.record_developer_usage_server(\n    uuid,\n    text,\n    text,\n    integer,\n    text\n  )\n  from public, anon, authenticated;\ngrant execute\n  on function public.record_developer_usage_server(\n    uuid,\n    text,\n    text,\n    integer,\n    text\n  )\n  to service_role;\n");

write("test/leaderboard.test.js", "// test/leaderboard.test.js\nimport assert from \"node:assert/strict\";\nimport test from \"node:test\";\nimport {\n  addLeaderboardTime,\n  createEmptyLeaderboards,\n} from \"../src/services/leaderboard.js\";\n\ntest(\"local personal best stores one result and drops slower attempts\", () => {\n  let leaderboards = createEmptyLeaderboards();\n\n  leaderboards = addLeaderboardTime(\n    leaderboards,\n    \"level1\",\n    \"2d\",\n    12.5,\n    \"Player\",\n  );\n  const afterFirst = leaderboards;\n\n  leaderboards = addLeaderboardTime(\n    leaderboards,\n    \"level1\",\n    \"2d\",\n    14.25,\n    \"Player\",\n  );\n\n  assert.equal(leaderboards, afterFirst);\n  assert.equal(leaderboards.level1[\"2d\"].length, 1);\n  assert.equal(leaderboards.level1[\"2d\"][0].time, 12.5);\n});\n\ntest(\"local personal best replaces the stored result when a run is faster\", () => {\n  let leaderboards = createEmptyLeaderboards();\n\n  leaderboards = addLeaderboardTime(\n    leaderboards,\n    \"level2\",\n    \"3d\",\n    30,\n    \"Player\",\n  );\n  leaderboards = addLeaderboardTime(\n    leaderboards,\n    \"level2\",\n    \"3d\",\n    21.75,\n    \"Player\",\n  );\n\n  assert.equal(leaderboards.level2[\"3d\"].length, 1);\n  assert.equal(leaderboards.level2[\"3d\"][0].time, 21.75);\n});\n");

write(".github/workflows/ci.yml", "name: CI\n\non:\n  push:\n  pull_request:\n\njobs:\n  test-and-build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22.12.0\n          cache: npm\n      - run: npm ci\n      - run: npm run check\n");

removeIfPresent("api/leaderboard-run.js");
removeIfPresent("eslint.config.js");
removeIfPresent("supabase/developer-analytics.sql");

replaceRegex(
  "src/services/leaderboard.js",
  /^export const GLOBAL_LEADERBOARD_TABLE = "leaderboard_scores";\n/mg,
  "",
);
replaceRegex(
  "src/services/leaderboard.js",
  /export const SUPABASE_URL = import\.meta\.env\.VITE_SUPABASE_URL\?\.trim\(\) \?\? "";\n\nexport const SUPABASE_PUBLISHABLE_KEY =\n  import\.meta\.env\.VITE_SUPABASE_PUBLISHABLE_KEY\?\.trim\(\) \?\? "";/g,
  `const ENV = import.meta.env ?? {};

export const SUPABASE_URL = ENV.VITE_SUPABASE_URL?.trim() ?? "";

export const SUPABASE_PUBLISHABLE_KEY =
  ENV.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";`,
);
replaceRegex(
  "src/services/leaderboard.js",
  /export function normalizeLevelLeaderboards\(levelBoards\) \{[\s\S]*?\n\}\nexport function normalizeLeaderboards/g,
  `export function normalizeLevelLeaderboards(levelBoards) {
  if (Array.isArray(levelBoards)) {
    return {
      "2d": normalizeLeaderboardEntries(levelBoards).slice(0, 1),
      "3d": [],
    };
  }

  return {
    "2d": normalizeLeaderboardEntries(levelBoards?.["2d"]).slice(0, 1),
    "3d": normalizeLeaderboardEntries(levelBoards?.["3d"]).slice(0, 1),
  };
}
export function normalizeLeaderboards`,
);
replaceRegex(
  "src/services/leaderboard.js",
  /if \(currentRaw\) \{\n      return normalizeLeaderboards\(JSON\.parse\(currentRaw\)\);\n    \}/g,
  `if (currentRaw) {
      const normalized = normalizeLeaderboards(JSON.parse(currentRaw));
      window.localStorage.setItem(
        LEADERBOARD_STORAGE_KEY,
        JSON.stringify(normalized),
      );
      return normalized;
    }`,
);
replaceRegex(
  "src/services/leaderboard.js",
  /export function addLeaderboardTime\([\s\S]*?\n\}\nexport async function ensureGlobalLeaderboardSession/g,
  "export function addLeaderboardTime(\n  leaderboards,\n  levelKey,\n  mode,\n  time,\n  playerName,\n) {\n  if (\n    !LEVELS[levelKey] ||\n    LEVELS[levelKey].leaderboard === false ||\n    !Number.isFinite(time) ||\n    time <= 0\n  ) {\n    return leaderboards;\n  }\n\n  const normalizedMode = mode === \"3d\" ? \"3d\" : \"2d\";\n  const levelBoards = normalizeLevelLeaderboards(leaderboards[levelKey]);\n  const currentBest = levelBoards[normalizedMode][0] ?? null;\n\n  if (currentBest && currentBest.time <= time) {\n    return leaderboards;\n  }\n\n  return {\n    ...leaderboards,\n    [levelKey]: {\n      ...levelBoards,\n      [normalizedMode]: [\n        {\n          time,\n          completedAt: new Date().toISOString(),\n          playerName: getPlayerDisplayName(playerName),\n          countryCode: \"\",\n          globalRank: null,\n          isCurrentUser: true,\n        },\n      ],\n    },\n  };\n}\n\nexport async function ensureGlobalLeaderboardSession",
);
replaceRegex(
  "src/services/leaderboard.js",
  /export async function submitGlobalLeaderboardTime\([\s\S]*$/g,
  "export async function beginGlobalLeaderboardRun(levelKey, mode) {\n  if (\n    !supabase ||\n    !LEVELS[levelKey] ||\n    LEVELS[levelKey].leaderboard === false\n  ) {\n    return null;\n  }\n\n  await ensureGlobalLeaderboardSession();\n\n  const { data, error } = await supabase.rpc(\"start_leaderboard_run\", {\n    p_level_key: levelKey,\n    p_mode: mode === \"3d\" ? \"3d\" : \"2d\",\n  });\n\n  if (error) {\n    throw error;\n  }\n\n  return typeof data === \"string\" ? data : null;\n}\n\nexport async function finishGlobalLeaderboardRun(\n  runId,\n  playerName,\n  countryCode,\n) {\n  if (!supabase || !runId) {\n    return null;\n  }\n\n  await ensureGlobalLeaderboardSession();\n\n  const { data, error } = await supabase.rpc(\"finish_leaderboard_run\", {\n    p_run_id: runId,\n    p_player_name: getPlayerDisplayName(playerName),\n    p_country_code: normalizeCountryCode(countryCode) || null,\n  });\n\n  if (error) {\n    throw error;\n  }\n\n  return data ?? null;\n}\n",
);

replaceRegex(
  "src/game/world.js",
  /    runMode: normalizedViewMode,\n/g,
  `    runMode: normalizedViewMode,
    leaderboardEligible: !labyrinthMode,
`,
);

replaceRegex(
  "src/App.jsx",
  /import \{ LevelSelectScreen \} from "\.\/components\/LevelSelectScreen\.jsx";\n/g,
  `import { LevelSelectScreen } from "./components/LevelSelectScreen.jsx";
import { ModeSwitchWarning } from "./components/ModeSwitchWarning.jsx";
import { RunEndOverlay } from "./components/RunEndOverlay.jsx";
`,
);
replaceRegex(
  "src/App.jsx",
  /import \{ sanitizePlayerName \} from "\.\/utils\/player\.js";\n/g,
  `import { sanitizePlayerName } from "./utils/player.js";

const MODE_SWITCH_WARNING_STORAGE_KEY =
  "maze-arsenal-mode-switch-warning-seen-v1";

function loadModeSwitchWarningSeen() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(MODE_SWITCH_WARNING_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveModeSwitchWarningSeen() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(MODE_SWITCH_WARNING_STORAGE_KEY, "1");
  } catch {
    // The session ref still prevents repeated warnings.
  }
}
`,
);

replaceRegex(
  "src/App.jsx",
  /import \{ GLOBAL_LEADERBOARD_ENABLED,[^\n]+from "\.\/services\/leaderboard\.js";\n/g,
  `import { GLOBAL_LEADERBOARD_ENABLED, addLeaderboardTime, beginGlobalLeaderboardRun, createEmptyUserRanks, detectCountryCode, fetchGlobalLeaderboards, finishGlobalLeaderboardRun, loadLeaderboards, saveLeaderboards } from "./services/leaderboard.js";
`,
);
replaceRegex(
  "src/App.jsx",
  /const analyticsRunEndedRef = useRef\(false\);\n/g,
  `const analyticsRunEndedRef = useRef(false);
const leaderboardRunPromiseRef = useRef(null);
`,
);
replaceRegex(
  "src/App.jsx",
  /const \[selectedLevel, setSelectedLevel\] = useState\(null\);\n/g,
  `const [selectedLevel, setSelectedLevel] = useState(null);
const [runGeneration, setRunGeneration] = useState(0);
const modeSwitchWarningSeenRef = useRef(loadModeSwitchWarningSeen());
const [pendingModeSwitch, setPendingModeSwitch] = useState(null);
`,
);
replaceRegex(
  "src/App.jsx",
  /const recordLeaderboardScore = useCallback\([\s\S]*?\nconst getAudioEngine = useCallback/g,
  "const beginLeaderboardRunForWorld = useCallback((world) => {\n  leaderboardRunPromiseRef.current = null;\n\n  if (!GLOBAL_LEADERBOARD_ENABLED || world.labyrinthMode) {\n    return;\n  }\n\n  void detectCountryCode();\n\n  leaderboardRunPromiseRef.current = beginGlobalLeaderboardRun(\n    world.level.key,\n    world.runMode,\n  ).catch((error) => {\n    console.warn(\"Global leaderboard run start failed:\", error);\n    setLeaderboardStatus(\"offline\");\n    return null;\n  });\n}, []);\n\nconst recordLeaderboardScore = useCallback(\n  (world) => {\n    if (world.labyrinthMode || world.leaderboardEligible === false) {\n      return;\n    }\n\n    const completedTime = world.time;\n    const levelKey = world.level.key;\n    const mode = world.runMode;\n    const runPlayerName = world.playerName;\n\n    if (!GLOBAL_LEADERBOARD_ENABLED) {\n      setLeaderboards((currentLeaderboards) => {\n        const nextLeaderboards = addLeaderboardTime(\n          currentLeaderboards,\n          levelKey,\n          mode,\n          completedTime,\n          runPlayerName,\n        );\n        saveLeaderboards(nextLeaderboards);\n        return nextLeaderboards;\n      });\n      return;\n    }\n\n    const runPromise = leaderboardRunPromiseRef.current;\n    leaderboardRunPromiseRef.current = null;\n\n    void (async () => {\n      try {\n        const runId = await runPromise;\n\n        if (!runId) {\n          throw new Error(\"Leaderboard run was not started.\");\n        }\n\n        const countryCode = await detectCountryCode();\n        await finishGlobalLeaderboardRun(\n          runId,\n          runPlayerName,\n          countryCode,\n        );\n        await refreshGlobalLeaderboards({ silent: true });\n      } catch (error) {\n        console.warn(\"Global leaderboard submission failed:\", error);\n        setLeaderboardStatus(\"offline\");\n      }\n    })();\n  },\n  [refreshGlobalLeaderboards],\n);\nconst getAudioEngine = useCallback",
);
replaceRegex(
  "src/App.jsx",
  /worldRef\.current = nextWorld;\n  startLevelAudio\(nextWorld\);/g,
  `worldRef.current = nextWorld;
  beginLeaderboardRunForWorld(nextWorld);
  startLevelAudio(nextWorld);`,
  2,
);
replaceRegex(
  "src/App.jsx",
  /setSelectedLevel\(levelKey\);\n  forceRefresh\(\);\n\}, \[clearTouchInput, forceRefresh, selectionMode, startLevelAudio\]\);/g,
  `setSelectedLevel(levelKey);
  setRunGeneration((value) => value + 1);
  forceRefresh();
}, [
  beginLeaderboardRunForWorld,
  clearTouchInput,
  forceRefresh,
  selectionMode,
  startLevelAudio,
]);`,
);
replaceRegex(
  "src/App.jsx",
  /analyticsRunEndedRef\.current = false;\n  void recordGameStarted\(nextWorld\);\n  forceRefresh\(\);\n\}, \[\n  clearTouchInput,\n  flushPlayAnalytics,\n  forceRefresh,\n  gameMode,\n  playerName,\n  selectedLevel,\n  startLevelAudio,\n\]\);/g,
  `analyticsRunEndedRef.current = false;
  void recordGameStarted(nextWorld);
  setRunGeneration((value) => value + 1);
  forceRefresh();
}, [
  beginLeaderboardRunForWorld,
  clearTouchInput,
  flushPlayAnalytics,
  forceRefresh,
  gameMode,
  playerName,
  selectedLevel,
  startLevelAudio,
]);`,
);
replaceRegex(
  "src/App.jsx",
  /const switchGameMode = useCallback\(\(\) => \{[\s\S]*?\n\}, \[clearTouchInput, forceRefresh, gameMode\]\);\n/g,
  `const performGameModeSwitch = useCallback(
  (requestedMode) => {
    const nextViewMode = requestedMode === "3d" ? "3d" : "2d";
    const world = worldRef.current;
    const activeLeaderboardRun =
      !world.labyrinthMode && !world.victory && !world.gameOver;

    if (
      typeof document !== "undefined" &&
      document.pointerLockElement
    ) {
      document.exitPointerLock?.();
    }

    setWorldViewMode(world, nextViewMode);

    if (activeLeaderboardRun) {
      world.leaderboardEligible = false;
      setMessage(
        world,
        "Leaderboard disabled for this run after switching 2D / 3D.",
        3.2,
      );
    }

    keysRef.current = {};
    clearTouchInput();
    setGameMode(nextViewMode);
    setSelectionMode(nextViewMode);
    forceRefresh();
  },
  [clearTouchInput, forceRefresh],
);

const switchGameMode = useCallback(() => {
  const nextViewMode = gameMode === "3d" ? "2d" : "3d";
  const world = worldRef.current;
  const shouldWarn =
    !world.labyrinthMode &&
    !world.victory &&
    !world.gameOver &&
    world.leaderboardEligible !== false &&
    !modeSwitchWarningSeenRef.current;

  if (shouldWarn) {
    if (
      typeof document !== "undefined" &&
      document.pointerLockElement
    ) {
      document.exitPointerLock?.();
    }

    setPendingModeSwitch(nextViewMode);
    return;
  }

  performGameModeSwitch(nextViewMode);
}, [gameMode, performGameModeSwitch]);

const confirmModeSwitch = useCallback(() => {
  if (!pendingModeSwitch) {
    return;
  }

  const nextViewMode = pendingModeSwitch;
  modeSwitchWarningSeenRef.current = true;
  saveModeSwitchWarningSeen();
  setPendingModeSwitch(null);
  performGameModeSwitch(nextViewMode);
}, [pendingModeSwitch, performGameModeSwitch]);

const cancelModeSwitch = useCallback(() => {
  setPendingModeSwitch(null);
}, []);
`,
);

replaceRegex(
  "src/App.jsx",
  /if \(\n    \(world\.victory \|\| world\.gameOver\) &&\n    !analyticsRunEndedRef\.current\n  \) \{[\s\S]*?void recordGameFinished\(world\);\n  \}/g,
  "if (\n    (world.victory || world.gameOver) &&\n    !analyticsRunEndedRef.current\n  ) {\n    analyticsRunEndedRef.current = true;\n\n    if (\n      typeof document !== \"undefined\" &&\n      document.pointerLockElement\n    ) {\n      document.exitPointerLock?.();\n    }\n\n    flushPlayAnalytics(world);\n    void recordGameFinished(world);\n  }",
);
replaceRegex(
  "src/App.jsx",
  /drawWorld\(ctx, world\);\n\n  hudAccumulatorRef\.current \+= dt;/g,
  `drawWorld(ctx, world);

  if (world.victory || world.gameOver) {
    forceRefresh();
    return;
  }

  hudAccumulatorRef.current += dt;`,
);
replaceRegex(
  "src/App.jsx",
  /  recordLeaderboardScore,\n  selectedLevel,\n\]\);/g,
  `  recordLeaderboardScore,
  runGeneration,
  selectedLevel,
]);`,
);
replaceRegex(
  "src/App.jsx",
  /  <style>\{GAME_STYLES\}<\/style>\n/g,
  `  <style>{GAME_STYLES}</style>
  {pendingModeSwitch && (
    <ModeSwitchWarning
      fromMode={gameMode}
      toMode={pendingModeSwitch}
      onConfirm={confirmModeSwitch}
      onCancel={cancelModeSwitch}
    />
  )}
  <RunEndOverlay
    world={world}
    onTryAgain={resetWorld}
    onMainMenu={returnToLevelSelect}
  />
`,
);

replaceRegex(
  "src/components/LevelSelectScreen.jsx",
  /        <span>Top \{LEADERBOARD_LIMIT\}<\/span>/g,
  `        <span>
          {status === "local" ? "Personal best" : \`Top \${LEADERBOARD_LIMIT}\`}
        </span>`,
);
replaceRegex(
  "src/components/LevelSelectScreen.jsx",
  /\{Array\.from\(\{ length: LEADERBOARD_LIMIT \}, \(_, index\) => \{/g,
  `{Array.from(
          { length: status === "local" ? 1 : LEADERBOARD_LIMIT },
          (_, index) => {`,
);
replaceRegex(
  "src/components/LevelSelectScreen.jsx",
  /: `Separate top \$\{LEADERBOARD_LIMIT\} lists for 2D and 3D`\}/g,
  `: "One personal best per level and view mode"}`,
);
replaceRegex(
  "src/components/LevelSelectScreen.jsx",
  /Your result will be saved to this level’s separate\{" "\}\n\s+\{viewMode === "3d" \? "3D" : "2D"\} top-ten leaderboard\./g,
  `Only your fastest {viewMode === "3d" ? "3D" : "2D"} result
                  is kept. Slower retries are discarded; a faster run replaces
                  your personal best.`,
);

replaceRegex(
  "README.md",
  /1\. Install Node\.js 20\.19\+ or 22\.12\+ \(or newer\) for Vite 8\./g,
  "1. Install Node.js 22.12+ (or newer). Supabase 2.112.3 requires Node 22+ and Vite 8 requires Node 22.12+.",
);
replaceRegex(
  "README.md",
  /9\. Test a production build:\n\n```bash\nnpm run build\n```/g,
  `9. Run the quality gate:

\`\`\`bash
npm run check
\`\`\`

\`npm run check\` runs the personal-best tests and a production Vite build.`,
);
replaceRegex(
  "README.md",
  /Run `supabase\/developer-analytics\.sql` if the original database setup was\nalready completed before this feature was added\. Fresh installs can simply run\nthe current `supabase\/setup\.sql`\./g,
  `Run the current \`supabase/setup.sql\` again for existing installations as well
as fresh installs. It is idempotent and migrates old leaderboard attempts into
one personal-best row per user, level, and view mode while hardening analytics
writes behind server-only functions.`,
);
replaceRegex(
  "README.md",
  /│   ├── country\.js\n│   └── developer-analytics\.js/g,
  `│   ├── country.js
│   ├── developer-analytics.js
│   └── developer-usage.js`,
);
replaceRegex(
  "README.md",
  /│   ├── setup\.sql\n│   └── developer-analytics\.sql/g,
  "│   └── setup.sql",
);

console.log("Maze Arsenal hardening applied.");
console.log("Run `npm run check`, then re-run `supabase/setup.sql` in Supabase.");
