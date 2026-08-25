// api/developer-usage.js
import { createClient } from "@supabase/supabase-js";

const VALID_EVENTS = new Set([
  "visitor",
  "game_start",
  "game_finish",
  "playtime",
  "donation",
]);

const VALID_DONATION_KEYS = new Set([
  "1",
  "2",
  "5",
  "custom",
]);

const MAX_PLAYTIME_SECONDS = 120;

function getServerConfig() {
  return {
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

function parseBody(body) {
  if (!body) {
    return {};
  }

  if (typeof body === "string") {
    return JSON.parse(body);
  }

  return body;
}

function sendJson(response, status, data) {
  response.setHeader("Cache-Control", "private, no-store");
  return response.status(status).json(data);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, {
      code: "METHOD_NOT_ALLOWED",
      error: "Method not allowed.",
    });
  }

  const { supabaseUrl, supabaseSecret } = getServerConfig();

  if (!supabaseUrl || !supabaseSecret) {
    return sendJson(response, 503, {
      code: "ANALYTICS_SERVER_NOT_CONFIGURED",
      error:
        "Developer analytics server is not configured. " +
        "Set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel.",
    });
  }

  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return sendJson(response, 401, {
      code: "MISSING_ACCESS_TOKEN",
      error: "Unauthorized.",
    });
  }

  const supabaseAdmin = createAdminClient(
    supabaseUrl,
    supabaseSecret,
  );

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (userError || !user) {
    console.warn(
      "Developer analytics user verification failed:",
      userError?.message ?? "No user returned.",
    );

    return sendJson(response, 401, {
      code: "INVALID_ACCESS_TOKEN",
      error: "Unauthorized.",
    });
  }

  let body;

  try {
    body = parseBody(request.body);
  } catch {
    return sendJson(response, 400, {
      code: "INVALID_JSON",
      error: "Invalid JSON body.",
    });
  }

  const eventType = String(body?.eventType ?? "");
  const donationKey =
    body?.donationKey == null
      ? null
      : String(body.donationKey);

  if (!VALID_EVENTS.has(eventType)) {
    return sendJson(response, 400, {
      code: "INVALID_EVENT",
      error: "Invalid analytics event.",
    });
  }

  if (
    eventType === "donation" &&
    !VALID_DONATION_KEYS.has(donationKey)
  ) {
    return sendJson(response, 400, {
      code: "INVALID_DONATION_KEY",
      error: "Invalid donation key.",
    });
  }

  const seconds = Math.min(
    MAX_PLAYTIME_SECONDS,
    Math.max(
      0,
      Math.round(Number(body?.seconds) || 0),
    ),
  );

  const playerName =
    String(body?.playerName ?? "").trim().slice(0, 20) ||
    null;

  const { error: rpcError } = await supabaseAdmin.rpc(
    "record_developer_usage_server",
    {
      p_user_id: user.id,
      p_event: eventType,
      p_donation_key: donationKey,
      p_seconds: seconds,
      p_player_name: playerName,
    },
  );

  if (rpcError) {
    console.error(
      "Developer analytics RPC failed:",
      rpcError.message,
      rpcError.code,
    );

    return sendJson(response, 500, {
      code: "ANALYTICS_RPC_FAILED",
      error:
        "Could not record analytics event. " +
        "Run supabase/developer-analytics.sql in Supabase.",
    });
  }

  return sendJson(response, 200, {
    ok: true,
  });
}
