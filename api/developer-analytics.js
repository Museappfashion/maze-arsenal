// api/developer-analytics.js
import { createClient } from "@supabase/supabase-js";

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
      .limit(1000);

    if (error) {
      console.error("Developer analytics query failed:", error.message);
      return json({ error: "Analytics query failed." }, 500);
    }

    const users = (data ?? []).map((row) => ({
      userId: row.user_id,
      playerName: row.last_player_name ?? "",
      gamesStarted: Number(row.games_started ?? 0),
      gamesFinished: Number(row.games_finished ?? 0),
      secondsPlayed: Number(row.seconds_played ?? 0),
      donation1Attempts: Number(row.donation_1_attempts ?? 0),
      donation2Attempts: Number(row.donation_2_attempts ?? 0),
      donation5Attempts: Number(row.donation_5_attempts ?? 0),
      donationCustomAttempts: Number(
        row.donation_custom_attempts ?? 0,
      ),
      lastSeenAt: row.last_seen_at ?? null,
    }));

    const totals = users.reduce(
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

    return json({ totals, users });
  },
};
