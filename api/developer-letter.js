import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

const MAX_MESSAGE_LENGTH = 2000;
const SEND_COOLDOWN_MS = 15_000;

function getServerConfig() {
  return {
    dashboardKey: process.env.DEVELOPER_DASHBOARD_KEY?.trim() || "",
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

async function replyToLetter(request, response, supabaseAdmin, dashboardKey) {
  if (!dashboardKey) {
    return sendJson(response, 503, {
      error: "Developer dashboard key is not configured.",
    });
  }

  const suppliedKey = Buffer.from(getBearerToken(request));
  const expectedKey = Buffer.from(dashboardKey);
  if (suppliedKey.length !== expectedKey.length || !timingSafeEqual(suppliedKey, expectedKey)) {
    return sendJson(response, 401, {
      error: "Developer dashboard key is incorrect.",
    });
  }

  let body;
  try {
    body = parseBody(request.body);
  } catch {
    return sendJson(response, 400, { error: "Invalid reply data." });
  }

  const letterId = String(body?.letterId ?? "");
  const message = String(body?.message ?? "").trim();
  if (!/^[1-9]\d{0,18}$/.test(letterId) || !message || message.length > MAX_MESSAGE_LENGTH) {
    return sendJson(response, 400, {
      error: `Choose a letter and write a reply of 1–${MAX_MESSAGE_LENGTH} characters.`,
    });
  }

  const { data: letter, error: letterError } = await supabaseAdmin
    .from("developer_letters")
    .select("id")
    .eq("id", letterId)
    .maybeSingle();

  if (letterError) {
    return sendJson(response, 500, { error: "Could not find the original letter. Please try again." });
  }
  if (!letter) {
    return sendJson(response, 404, { error: "This letter no longer exists." });
  }

  // The foreign key fixes the recipient to the original letter's owner.
  // Never accept a recipient/user ID from the dashboard request.
  const { data: reply, error } = await supabaseAdmin
    .from("developer_letter_replies")
    .insert({ letter_id: letter.id, message })
    .select("id,message,created_at")
    .single();

  if (error) {
    return sendJson(response, 500, {
      error: "Could not save the reply. Make sure the updated supabase/developer-letters.sql has been run.",
    });
  }

  return sendJson(response, 200, {
    ok: true,
    reply: { id: reply.id, message: reply.message, createdAt: reply.created_at },
  });
}

export default async function handler(request, response) {
  if (!["GET", "POST", "PATCH"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST, PATCH");
    return sendJson(response, 405, {
      code: "METHOD_NOT_ALLOWED",
      error: "Method not allowed.",
    });
  }

  const { supabaseUrl, supabaseSecret, dashboardKey } = getServerConfig();

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
      error: "Sign-in is required to use your inbox.",
    });
  }

  const supabaseAdmin = createAdminClient(
    supabaseUrl,
    supabaseSecret,
  );

  if (request.method === "PATCH") {
    return replyToLetter(request, response, supabaseAdmin, dashboardKey);
  }

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

  if (request.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("developer_letters")
      .select("id,message,created_at,developer_letter_replies(id,message,created_at)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return sendJson(response, 500, {
        error: "Your inbox could not be loaded. The developer may need to run the updated supabase/developer-letters.sql.",
      });
    }

    return sendJson(response, 200, {
      letters: (data ?? []).map(letter => ({
        id: letter.id,
        message: letter.message,
        createdAt: letter.created_at,
        replies: (letter.developer_letter_replies ?? [])
          .map(reply => ({ id: reply.id, message: reply.message, createdAt: reply.created_at }))
          .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
      })),
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
