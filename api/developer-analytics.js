// api/developer-analytics.js
import { createClient } from "@supabase/supabase-js";

const TABLE_NAME = "developer_usage_stats";

const VALID_EVENTS = new Set([
  "game_started",
  "game_finished",
  "play_seconds",
  "donation_attempt",
]);

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

function getBearerToken(request) {
  const header = request.headers.get("authorization") ?? "";

  return header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : "";
}

function getServerConfig() {
  return {
    dashboardKey:
      process.env.DEVELOPER_DASHBOARD_KEY?.trim() ?? "",

    supabaseUrl:
      process.env.SUPABASE_URL?.trim() ??
      process.env.VITE_SUPABASE_URL?.trim() ??
      "",

    supabaseSecret:
      process.env.SUPABASE_SECRET_KEY?.trim() ??
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
      "",
  };
}

function createServerSupabaseClient(url, secret) {
  return createClient(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function normalizePlayerName(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 40);
}

function normalizeUserId(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 128);
}

function normalizeDonationType(value) {
  const type = String(value ?? "");

  if (["1", "2", "5", "custom"].includes(type)) {
    return type;
  }

  return "custom";
}

function createEmptyStats(userId) {
  return {
    user_id: userId,
    last_player_name: "",
    games_started: 0,
    games_finished: 0,
    seconds_played: 0,
    donation_1_attempts: 0,
    donation_2_attempts: 0,
    donation_5_attempts: 0,
    donation_custom_attempts: 0,
    last_seen_at: new Date().toISOString(),
  };
}

function applyEvent(stats, event) {
  const next = {
    ...stats,
    last_seen_at: new Date().toISOString(),
  };

  if (event.playerName) {
    next.last_player_name = event.playerName;
  }

  switch (event.type) {
    case "game_started":
      next.games_started += 1;
      break;

    case "game_finished":
      next.games_finished += 1;
      break;

    case "play_seconds":
      next.seconds_played += event.seconds;
      break;

    case "donation_attempt":
      if (event.donationType === "1") {
        next.donation_1_attempts += 1;
      } else if (event.donationType === "2") {
        next.donation_2_attempts += 1;
      } else if (event.donationType === "5") {
        next.donation_5_attempts += 1;
      } else {
        next.donation_custom_attempts += 1;
      }
      break;

    default:
      break;
  }

  return next;
}

function normalizeDashboardUser(row) {
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

function calculateTotals(users) {
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

async function handleDashboardRequest(
  request,
  supabase,
  dashboardKey,
) {
  const suppliedKey = getBearerToken(request);

  if (
    !dashboardKey ||
    !suppliedKey ||
    suppliedKey !== dashboardKey
  ) {
    return json({ error: "Unauthorized." }, 401);
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
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
    .limit(1000);

  if (error) {
    console.error(
      "Developer analytics dashboard query failed.",
      {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
    );

    return json(
      { error: "Analytics query failed." },
      500,
    );
  }

  const users = (data ?? []).map(normalizeDashboardUser);

  return json({
    totals: calculateTotals(users),
    users,
  });
}

async function handleAnalyticsEvent(request, supabase) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  const type = String(body?.type ?? "");
  const userId = normalizeUserId(body?.userId);

  if (!VALID_EVENTS.has(type)) {
    return json({ error: "Invalid analytics event." }, 400);
  }

  if (!userId) {
    return json({ error: "Missing user ID." }, 400);
  }

  const event = {
    type,
    playerName: normalizePlayerName(body?.playerName),
    seconds: Math.max(
      0,
      Math.min(3600, Math.floor(Number(body?.seconds) || 0)),
    ),
    donationType: normalizeDonationType(
      body?.donationType,
    ),
  };

  const { data: existing, error: readError } =
    await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

  if (readError) {
    console.error("Analytics read failed.", {
      message: readError.message,
      code: readError.code,
      details: readError.details,
      hint: readError.hint,
    });

    return json(
      { error: "Analytics recording failed." },
      500,
    );
  }

  const current = existing ?? createEmptyStats(userId);
  const updated = applyEvent(current, event);

  const { error: saveError } = await supabase
    .from(TABLE_NAME)
    .upsert(updated, {
      onConflict: "user_id",
    });

  if (saveError) {
    console.error("Analytics save failed.", {
      message: saveError.message,
      code: saveError.code,
      details: saveError.details,
      hint: saveError.hint,
    });

    return json(
      { error: "Analytics recording failed." },
      500,
    );
  }

  return json({
    ok: true,
  });
}

export default {
  async fetch(request) {
    try {
      const {
        dashboardKey,
        supabaseUrl,
        supabaseSecret,
      } = getServerConfig();

      if (!supabaseUrl || !supabaseSecret) {
        console.error(
          "Developer analytics configuration missing.",
          {
            hasSupabaseUrl: Boolean(supabaseUrl),
            hasSupabaseSecret: Boolean(supabaseSecret),
            hasDashboardKey: Boolean(dashboardKey),
          },
        );

        return json(
          {
            error:
              "Developer analytics server is not configured.",
          },
          503,
        );
      }

      const supabase = createServerSupabaseClient(
        supabaseUrl,
        supabaseSecret,
      );

      if (request.method === "GET") {
        return handleDashboardRequest(
          request,
          supabase,
          dashboardKey,
        );
      }

      if (request.method === "POST") {
        return handleAnalyticsEvent(
          request,
          supabase,
        );
      }

      return json(
        { error: "Method not allowed." },
        405,
      );
    } catch (error) {
      console.error("Developer analytics crashed.", {
        message:
          error instanceof Error
            ? error.message
            : String(error),
        stack:
          error instanceof Error
            ? error.stack
            : undefined,
      });

      return json(
        {
          error:
            "Developer analytics encountered a server error.",
        },
        500,
      );
    }
  },
};