// api/developer-usage.js
import { createClient } from "@supabase/supabase-js";

const VALID_EVENTS = new Set([
  "visitor",
  "game_start",
  "game_finish",
  "playtime",
  "donation",
]);
const VALID_DONATION_KEYS = new Set(["1", "2", "5", "custom"]);
const MAX_PLAYTIME_SECONDS = 120;

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

function getServerSupabase() {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ??
    process.env.VITE_SUPABASE_URL?.trim() ??
    "";
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";

  if (!supabaseUrl || !supabaseSecret) {
    return null;
  }

  return createClient(supabaseUrl, supabaseSecret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getAuthenticatedUser(supabase, request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  return error ? null : user;
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    const supabase = getServerSupabase();

    if (!supabase) {
      return json({ error: "Developer analytics server is not configured." }, 503);
    }

    const user = await getAuthenticatedUser(supabase, request);

    if (!user) {
      return json({ error: "Unauthorized." }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    const eventType = String(body?.eventType ?? "");
    const donationKey =
      body?.donationKey == null ? null : String(body.donationKey);

    if (!VALID_EVENTS.has(eventType)) {
      return json({ error: "Invalid analytics event." }, 400);
    }

    if (
      eventType === "donation" &&
      !VALID_DONATION_KEYS.has(donationKey)
    ) {
      return json({ error: "Invalid donation key." }, 400);
    }

    const seconds = Math.min(
      MAX_PLAYTIME_SECONDS,
      Math.max(0, Math.round(Number(body?.seconds) || 0)),
    );
    const playerName =
      String(body?.playerName ?? "").trim().slice(0, 20) || null;
    const { error } = await supabase.rpc(
      "record_developer_usage_server",
      {
        p_user_id: user.id,
        p_event: eventType,
        p_donation_key: donationKey,
        p_seconds: seconds,
        p_player_name: playerName,
      },
    );

    if (error) {
      console.error("Developer analytics event failed:", error.message);
      return json({ error: "Could not record analytics event." }, 500);
    }

    return json({ ok: true });
  },
};
