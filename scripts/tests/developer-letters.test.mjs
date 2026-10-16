// Isolated HTTP-boundary checks; no live Supabase project is contacted.
import assert from "node:assert/strict";
import test from "node:test";
import handler from "../../api/developer-letter.js";

test("developer replies require the dashboard key and remain private to the letter owner", async () => {
  const oldFetch = globalThis.fetch;
  const envNames = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "DEVELOPER_DASHBOARD_KEY"];
  const previousEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  process.env.SUPABASE_URL = "https://inbox-test.invalid";
  process.env.SUPABASE_SECRET_KEY = "server-only-test-key";
  process.env.DEVELOPER_DASHBOARD_KEY = "developer-only-test-key";
  const letters = [
    { id: 1, user_id: "player-a", message: "My first letter", created_at: "2026-01-01T00:00:00Z" },
    { id: 2, user_id: "player-b", message: "Private B letter", created_at: "2026-01-02T00:00:00Z" },
  ];
  const replies = [];
  let requests = 0;
  const json = (value, status = 200) => new Response(JSON.stringify(value), {
    status, headers: { "Content-Type": "application/json" },
  });
  globalThis.fetch = async (input, options = {}) => {
    requests += 1;
    const url = new URL(typeof input === "string" ? input : input.url);
    assert.equal(url.hostname, "inbox-test.invalid");
    const headers = new Headers(options.headers);
    if (url.pathname === "/auth/v1/user") {
      const token = headers.get("authorization")?.replace("Bearer ", "");
      return ["player-a", "player-b"].includes(token)
        ? json({ id: token, aud: "authenticated", role: "authenticated" })
        : json({ message: "Invalid token" }, 401);
    }
    assert.equal(headers.get("authorization"), "Bearer server-only-test-key");
    if (url.pathname === "/rest/v1/developer_letters") {
      const userFilter = url.searchParams.get("user_id")?.replace("eq.", "");
      const idFilter = url.searchParams.get("id")?.replace("eq.", "");
      let found = letters.filter(letter => (!userFilter || letter.user_id === userFilter) && (!idFilter || String(letter.id) === idFilter));
      if (idFilter) return json(found);
      assert.ok(userFilter, "player reads must filter by authenticated identity");
      found = found.map(letter => ({ ...letter, developer_letter_replies: replies.filter(reply => reply.letter_id === letter.id) }));
      return json(found);
    }
    if (url.pathname === "/rest/v1/developer_letter_replies" && options.method === "POST") {
      const body = JSON.parse(options.body);
      assert.deepEqual(Object.keys(body).sort(), ["letter_id", "message"]);
      const reply = { id: replies.length + 1, ...body, created_at: new Date().toISOString() };
      replies.push(reply);
      return json(reply, 201);
    }
    throw new Error(`Unexpected request: ${options.method} ${url.pathname}`);
  };
  async function request(method, token, body, query = {}) {
    const response = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      status(value) { this.statusCode = value; return this; },
      json(value) { this.body = value; return this; },
    };
    await handler({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, body, query }, response);
    assert.equal(response.headers["Cache-Control"], "private, no-store");
    return response;
  }
  try {
    assert.equal((await request("GET")).statusCode, 401);
    assert.equal((await request("GET", "invalid")).statusCode, 401);
    const before = requests;
    assert.equal((await request("PATCH", "player-a", { letterId: 1, message: "Forged reply" })).statusCode, 401);
    assert.equal(requests, before, "non-developers must be rejected before storage reads or writes");
    const owner = await request("GET", "player-a", null, { user_id: "player-b" });
    assert.equal(owner.statusCode, 200);
    assert.deepEqual(owner.body.letters.map(letter => letter.id), [1]);
    assert.equal((await request("PATCH", "developer-only-test-key", { letterId: 1, message: " " })).statusCode, 400);
    assert.equal((await request("PATCH", "developer-only-test-key", { letterId: 1, message: "x".repeat(2001) })).statusCode, 400);
    assert.equal((await request("PATCH", "developer-only-test-key", { letterId: 999, message: "Missing" })).statusCode, 404);
    assert.equal((await request("PATCH", "developer-only-test-key", "{")).statusCode, 400);
    const sent = await request("PATCH", "developer-only-test-key", { letterId: 1, message: "  Thank you!  ", userId: "player-b" });
    assert.equal(sent.statusCode, 200);
    assert.equal(sent.body.reply.message, "Thank you!");
    assert.equal(replies[0].letter_id, 1, "recipient comes only from the stored parent letter");
    const reloaded = await request("GET", "player-a");
    assert.equal(reloaded.body.letters[0].replies[0].message, "Thank you!");
    const otherInbox = await request("GET", "player-b");
    assert.deepEqual(otherInbox.body.letters.map(letter => letter.id), [2]);
    assert.deepEqual(otherInbox.body.letters[0].replies, []);
    assert.equal((await request("DELETE", "developer-only-test-key")).statusCode, 405);
  } finally {
    globalThis.fetch = oldFetch;
    for (const name of envNames) {
      if (previousEnv[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[name];
    }
  }
});
