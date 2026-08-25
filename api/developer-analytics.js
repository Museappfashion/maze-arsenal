// api/developer-analytics.js
import { createClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

function getServerConfig() {
  return {
    dashboardKey:
      process.env.DEVELOPER_DASHBOARD_KEY?.trim() || "",
    supabaseUrl:
      process.env.SUPABASE_URL?.trim() ||
      process.env.VITE_SUPABASE_URL?.trim() ||
      "",
    supabaseSecret:
      process.env.SUPABASE_SECRET_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      "",
  };
}

function createAdminClient(supabaseUrl, supabaseSecret) {
  return createClient(supabaseUrl, supabaseSecret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function getBearerToken(request) {
  const authorization =
    request.headers.authorization ??
    request.headers.Authorization ??
    "";

  return authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function sendJson(response, status, data) {
  response.setHeader("Cache-Control", "private, no-store");
  return response.status(status).json(data);
}

async function listUsageRows(supabase) {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("developer_usage_stats")
      .select(
        [
          "user_id",
          "last_player_name",
          "games_started",
          "games_finished",
          "seconds_played",
          "donation_1_attempts",
          "donation_2_attempts",
          "donation_5_attempts",
          "donation_custom_attempts",
          "last_seen_at",
        ].join(","),
      )
      .order("last_seen_at", {
        ascending: false,
      })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < PAGE_SIZE) {
      return rows;
    }
  }
}

function normalizeUsageRow(row) {
  return {
    userId: row.user_id,
    playerName: row.last_player_name ?? "",
    gamesStarted: Number(row.games_started ?? 0),
    gamesFinished: Number(row.games_finished ?? 0),
    secondsPlayed: Number(row.seconds_played ?? 0),
    donation1Attempts: Number(
      row.donation_1_attempts ?? 0,
    ),
    donation2Attempts: Number(
      row.donation_2_attempts ?? 0,
    ),
    donation5Attempts: Number(
      row.donation_5_attempts ?? 0,
    ),
    donationCustomAttempts: Number(
      row.donation_custom_attempts ?? 0,
    ),
    lastSeenAt: row.last_seen_at ?? null,
  };
}

function buildTotals(users) {
  return users.reduce(
    (totals, user) => {
      totals.gamesStarted += user.gamesStarted;
      totals.gamesFinished += user.gamesFinished;
      totals.secondsPlayed += user.secondsPlayed;
      totals.donationAttempts +=
        user.donation1Attempts +
        user.donation2Attempts +
        user.donation5Attempts +
        user.donationCustomAttempts;

      return totals;
    },
    {
      users: users.length,
      gamesStarted: 0,
      gamesFinished: 0,
      secondsPlayed: 0,
      donationAttempts: 0,
    },
  );
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, {
      code: "METHOD_NOT_ALLOWED",
      error: "Method not allowed.",
    });
  }

  const {
    dashboardKey,
    supabaseUrl,
    supabaseSecret,
  } = getServerConfig();

  if (!dashboardKey) {
    return sendJson(response, 503, {
      code: "DASHBOARD_KEY_NOT_CONFIGURED",
      error:
        "Developer dashboard key is not configured. " +
        "Set DEVELOPER_DASHBOARD_KEY in Vercel and redeploy.",
    });
  }

  const suppliedKey = getBearerToken(request);

  if (!suppliedKey || suppliedKey !== dashboardKey) {
    return sendJson(response, 401, {
      code: "INVALID_DASHBOARD_KEY",
      error: "Developer dashboard key is incorrect.",
    });
  }

  if (!supabaseUrl || !supabaseSecret) {
    return sendJson(response, 503, {
      code: "SUPABASE_SERVER_NOT_CONFIGURED",
      error:
        "Supabase server credentials are missing. " +
        "Set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel.",
    });
  }

  const supabaseAdmin = createAdminClient(
    supabaseUrl,
    supabaseSecret,
  );

  let usageRows;

  try {
    usageRows = await listUsageRows(supabaseAdmin);
  } catch (error) {
    console.error(
      "Developer analytics query failed:",
      error?.message ?? error,
      error?.code ?? "",
    );

    return sendJson(response, 500, {
      code: "ANALYTICS_QUERY_FAILED",
      error:
        "Could not read developer analytics. " +
        "Run supabase/developer-analytics.sql in Supabase.",
      detail:
        typeof error?.message === "string"
          ? error.message.slice(0, 240)
          : "",
    });
  }

  const users = usageRows
    .map(normalizeUsageRow)
    .sort((left, right) => {
      const leftTime =
        Date.parse(left.lastSeenAt ?? "") || 0;
      const rightTime =
        Date.parse(right.lastSeenAt ?? "") || 0;

      return rightTime - leftTime;
    });

  return sendJson(response, 200, {
    totals: buildTotals(users),
    users,
    diagnostics: {
      database: "ok",
      trackedRows: users.length,
    },
  });
}
