// api/developer-analytics.js
import { createClient } from "@supabase/supabase-js";

const AUTH_USERS_PAGE_SIZE = 1000;
const MAX_AUTH_USER_PAGES = 20;

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
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function listAuthUsers(supabase) {
  const users = [];

  for (let page = 1; page <= MAX_AUTH_USER_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PAGE_SIZE,
    });

    if (error) {
      throw error;
    }

    const pageUsers = data?.users ?? [];
    users.push(...pageUsers);

    if (pageUsers.length < AUTH_USERS_PAGE_SIZE) {
      break;
    }
  }

  return users;
}

function normalizeUsageRow(row) {
  return {
    userId: row.user_id,
    playerName: row.last_player_name ?? "",
    gamesStarted: Number(row.games_started ?? 0),
    gamesFinished: Number(row.games_finished ?? 0),
    secondsPlayed: Number(row.seconds_played ?? 0),
    donation1Attempts: Number(row.donation_1_attempts ?? 0),
    donation2Attempts: Number(row.donation_2_attempts ?? 0),
    donation5Attempts: Number(row.donation_5_attempts ?? 0),
    donationCustomAttempts: Number(row.donation_custom_attempts ?? 0),
    lastSeenAt: row.last_seen_at ?? null,
  };
}

function emptyUsageForAuthUser(user) {
  return {
    userId: user.id,
    playerName: "",
    gamesStarted: 0,
    gamesFinished: 0,
    secondsPlayed: 0,
    donation1Attempts: 0,
    donation2Attempts: 0,
    donation5Attempts: 0,
    donationCustomAttempts: 0,
    lastSeenAt: user.last_sign_in_at ?? user.created_at ?? null,
  };
}

function buildTotals(users) {
  return users.reduce(
    (result, user) => {
      result.gamesStarted += user.gamesStarted;
      result.gamesFinished += user.gamesFinished;
      result.secondsPlayed += user.secondsPlayed;
      result.donationAttempts +=
        user.donation1Attempts +
        user.donation2Attempts +
        user.donation5Attempts +
        user.donationCustomAttempts;
      return result;
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

export default {
  async fetch(request) {
    if (request.method !== "GET") {
      return json({ error: "Method not allowed." }, 405);
    }

    const dashboardKey =
      process.env.DEVELOPER_DASHBOARD_KEY?.trim() ?? "";
    const suppliedKey = getBearerToken(request);

    if (!dashboardKey || !suppliedKey || suppliedKey !== dashboardKey) {
      return json({ error: "Unauthorized." }, 401);
    }

    const supabaseUrl =
      process.env.SUPABASE_URL?.trim() ??
      process.env.VITE_SUPABASE_URL?.trim() ??
      "";
    const supabaseSecret =
      process.env.SUPABASE_SECRET_KEY?.trim() ?? "";

    if (!supabaseUrl || !supabaseSecret) {
      return json(
        { error: "Developer analytics server is not configured." },
        503,
      );
    }

    const supabase = createClient(supabaseUrl, supabaseSecret, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

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
      .order("last_seen_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("Developer analytics query failed:", error.message);
      return json({ error: "Analytics query failed." }, 500);
    }

    const usageUsers = (data ?? []).map(normalizeUsageRow);
    const userMap = new Map(
      usageUsers.map((user) => [user.userId, user]),
    );

    try {
      const authUsers = await listAuthUsers(supabase);

      for (const authUser of authUsers) {
        if (!userMap.has(authUser.id)) {
          userMap.set(authUser.id, emptyUsageForAuthUser(authUser));
        }
      }
    } catch (authError) {
      console.warn(
        "Developer analytics auth-user merge failed:",
        authError?.message ?? authError,
      );
    }

    const users = [...userMap.values()].sort((left, right) => {
      const leftTime = Date.parse(left.lastSeenAt ?? "") || 0;
      const rightTime = Date.parse(right.lastSeenAt ?? "") || 0;
      return rightTime - leftTime;
    });

    return json({
      totals: buildTotals(users),
      users,
    });
  },
};
