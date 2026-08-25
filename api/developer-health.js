// api/developer-health.js
import { createClient } from "@supabase/supabase-js";

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

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, {
      error: "Method not allowed.",
    });
  }

  const dashboardKey =
    process.env.DEVELOPER_DASHBOARD_KEY?.trim() || "";
  const suppliedKey = getBearerToken(request);

  if (!dashboardKey || suppliedKey !== dashboardKey) {
    return sendJson(response, 401, {
      error: "Unauthorized.",
    });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim() ||
    "";

  const supabaseSecret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";

  const result = {
    dashboardKey: "ok",
    supabaseUrl: supabaseUrl ? "ok" : "missing",
    supabaseSecret: supabaseSecret ? "ok" : "missing",
    database: "not_checked",
  };

  if (!supabaseUrl || !supabaseSecret) {
    return sendJson(response, 503, result);
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseSecret,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { count, error } = await supabase
    .from("developer_usage_stats")
    .select("user_id", {
      count: "exact",
      head: true,
    });

  if (error) {
    return sendJson(response, 500, {
      ...result,
      database: "error",
      databaseError: error.message,
    });
  }

  return sendJson(response, 200, {
    ...result,
    database: "ok",
    trackedRows: Number(count ?? 0),
  });
}
