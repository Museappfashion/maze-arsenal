import { createClient } from "@supabase/supabase-js";

const MAX_MESSAGE_LENGTH = 2000;
const SEND_COOLDOWN_MS = 15_000;

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
  if (!body) return {};
  return typeof body === "string" ? JSON.parse(body) : body;
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
      code: "LETTER_SERVER_NOT_CONFIGURED",
      error: "Developer letters are not configured on the server.",
    });
  }

  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return sendJson(response, 401, {
      code: "MISSING_ACCESS_TOKEN",
      error: "Sign-in is required to send a letter.",
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
    return sendJson(response, 401, {
      code: "INVALID_ACCESS_TOKEN",
      error: "Your session expired. Reload the game and try again.",
    });
  }

  let body;

  try {
    body = parseBody(request.body);
  } catch {
    return sendJson(response, 400, {
      code: "INVALID_JSON",
      error: "Invalid letter data.",
    });
  }

  const message = String(body?.message ?? "").trim();
  const playerName =
    String(body?.playerName ?? "").trim().slice(0, 20) || null;

  if (!message) {
    return sendJson(response, 400, {
      code: "EMPTY_LETTER",
      error: "Write a message before sending.",
    });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return sendJson(response, 400, {
      code: "LETTER_TOO_LONG",
      error: `Letters can be at most ${MAX_MESSAGE_LENGTH} characters.`,
    });
  }

  const { data: recentLetter, error: recentError } =
    await supabaseAdmin
      .from("developer_letters")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (recentError) {
    return sendJson(response, 500, {
      code: "LETTER_TABLE_UNAVAILABLE",
      error:
        "Developer letter storage is not ready. " +
        "Run supabase/developer-letters.sql in Supabase.",
    });
  }

  const lastSentAt = Date.parse(recentLetter?.created_at ?? "");

  if (
    Number.isFinite(lastSentAt) &&
    Date.now() - lastSentAt < SEND_COOLDOWN_MS
  ) {
    return sendJson(response, 429, {
      code: "LETTER_RATE_LIMITED",
      error: "Please wait a few seconds before sending another letter.",
    });
  }

  const { data, error } = await supabaseAdmin
    .from("developer_letters")
    .insert({
      user_id: user.id,
      player_name: playerName,
      message,
    })
    .select("id,created_at")
    .single();

  if (error) {
    console.error("Developer letter insert failed:", error.message);
    return sendJson(response, 500, {
      code: "LETTER_SEND_FAILED",
      error: "Your letter could not be delivered. Please try again.",
    });
  }

  return sendJson(response, 200, {
    ok: true,
    id: data.id,
    createdAt: data.created_at,
  });
}
