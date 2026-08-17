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

function getServerConfig() {
  const dashboardKey =
    process.env.DEVELOPER_DASHBOARD_KEY?.trim() ?? "";

  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ??
    process.env.VITE_SUPABASE_URL?.trim() ??
    "";

  const supabaseSecret =
    process.env.SUPABASE_SECRET_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    "";

  return {
    dashboardKey,
    supabaseUrl,
    supabaseSecret,
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

function normalizeUser(row) {
  return {
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
  };
}

function calculateTotals(users) {
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
    try {
      if (request.method !== "GET") {
        return json({ error: "Method not allowed." }, 405);
      }

      const {
        dashboardKey,
        supabaseUrl,
        supabaseSecret,
      } = getServerConfig();

      const suppliedKey = getBearerToken(request);

      if (
        !dashboardKey ||
        !suppliedKey ||
        suppliedKey !== dashboardKey
      ) {
        return json({ error: "Unauthorized." }, 401);
      }

      if (!supabaseUrl || !supabaseSecret) {
        console.error("Developer analytics configuration missing.", {
          hasSupabaseUrl: Boolean(supabaseUrl),
          hasSupabaseSecret: Boolean(supabaseSecret),
          hasDashboardKey: Boolean(dashboardKey),
        });

        return json(
          {
            error:
              "Developer analytics server is not configured.",
          },
          503,
        );
      }

      let parsedUrl;

      try {
        parsedUrl = new URL(supabaseUrl);
      } catch {
        console.error(
          "Developer analytics has an invalid SUPABASE_URL.",
        );

        return json(
          {
            error:
              "Developer analytics server has an invalid Supabase URL.",
          },
          503,
        );
      }

      console.log("Developer analytics configuration loaded.", {
        supabaseHost: parsedUrl.hostname,
        hasSupabaseSecret: true,
      });

      const supabase = createServerSupabaseClient(
        supabaseUrl,
        supabaseSecret,
      );

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
        .limit(1000);

      if (error) {
        console.error("Developer analytics Supabase query failed.", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });

        return json(
          {
            error: "Analytics query failed.",
          },
          500,
        );
      }

      const users = (data ?? []).map(normalizeUser);
      const totals = calculateTotals(users);

      return json({
        totals,
        users,
      });
    } catch (error) {
      console.error("Developer analytics crashed.", {
        name:
          error instanceof Error
            ? error.name
            : "UnknownError",
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
          error: "Developer analytics encountered a server error.",
        },
        500,
      );
    }
  },
};