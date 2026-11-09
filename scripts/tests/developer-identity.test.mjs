import assert from "node:assert/strict";
import test from "node:test";
import usageHandler from "../../api/developer-usage.js";
import dashboardHandler from "../../api/developer-analytics.js";

// Full existing HTTP boundaries: the identified visitor is written using the
// verified Supabase user, then returned by the real developer dashboard handler.
test("verified player identity and private playtime reads", async (t) => {
  const oldFetch = globalThis.fetch;
  const names = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "DEVELOPER_DASHBOARD_KEY"];
  const before = Object.fromEntries(names.map(name=>[name,process.env[name]]));
  process.env.SUPABASE_URL = "https://identity-test.invalid";
  process.env.SUPABASE_SECRET_KEY = "server-only-identity-key";
  process.env.DEVELOPER_DASHBOARD_KEY = "private-dashboard-key";
  const rows = new Map(), writes = [], playtimeReads = [];
  const json = (value, status=200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type":"application/json" } });
  globalThis.fetch = async (input, options={}) => {
    const url = new URL(typeof input === "string" ? input : input.url), headers = new Headers(options.headers);
    assert.equal(url.hostname, "identity-test.invalid");
    if (url.pathname === "/auth/v1/user") return headers.get("authorization")==="Bearer player-token" ? json({id:"verified-player",aud:"authenticated",role:"authenticated"}) : json({message:"Invalid token"},401);
    assert.equal(headers.get("authorization"),"Bearer server-only-identity-key");
    if (url.pathname === "/rest/v1/rpc/record_developer_usage_server") {
      const payload=JSON.parse(options.body);writes.push(payload);
      assert.equal(payload.p_user_id,"verified-player");
      const row=rows.get(payload.p_user_id)||{user_id:payload.p_user_id,games_started:0,games_finished:0,seconds_played:0,last_player_name:null,last_seen_at:"2026-11-02T12:00:00Z"};
      if (payload.p_player_name) row.last_player_name=payload.p_player_name;
      rows.set(row.user_id,row);return json(null);
    }
    if (url.pathname === "/rest/v1/developer_usage_stats") {
      if (url.searchParams.get("select") === "seconds_played") {
        const userId = url.searchParams.get("user_id");
        playtimeReads.push(userId);
        const row = rows.get(userId?.replace(/^eq\./, ""));
        return json(row ? [{ seconds_played: row.seconds_played }] : []);
      }
      return json([...rows.values()]);
    }
    if(url.pathname==="/rest/v1/developer_letters")return json([]);
    throw new Error(`Unexpected identity-test request: ${url.pathname}`);
  };
  const response = () => ({headers:{},setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
  try {
    const entered=response();
    await usageHandler({method:"POST",headers:{authorization:"Bearer player-token"},body:{eventType:"visitor",playerName:"  First-time Scout  ",userId:"forged-user"}},entered);
    assert.equal(entered.statusCode,200);
    assert.equal(writes[0].p_event,"visitor");assert.equal(writes[0].p_player_name,"First-time Scout");
    const dashboard=response();
    await dashboardHandler({method:"GET",headers:{authorization:"Bearer private-dashboard-key"}},dashboard);
    assert.equal(dashboard.statusCode,200);
    assert.equal(dashboard.body.users[0].playerName,"First-time Scout");
    assert.equal(dashboard.body.users[0].gamesStarted,0,"identity does not fabricate a game start");
    assert.equal(dashboard.body.users[0].userId,"verified-player");
    const renamed=response();
    await usageHandler({method:"POST",headers:{authorization:"Bearer player-token"},body:{eventType:"visitor",playerName:"New Name"}},renamed);
    const refreshed=response();await dashboardHandler({method:"GET",headers:{authorization:"Bearer private-dashboard-key"}},refreshed);
    assert.equal(refreshed.body.users[0].playerName,"New Name");
    const blocked=response();await dashboardHandler({method:"GET",headers:{authorization:"Bearer player-token"}},blocked);
    assert.equal(blocked.statusCode,401,"player identity never grants access to the private developer dashboard");

    await t.test("a player can read historical playtime only from their own row", async () => {
      rows.get("verified-player").seconds_played = 3721;
      rows.set("other-player", { user_id: "other-player", seconds_played: 9999 });
      const read = response();
      await usageHandler({
        method: "GET",
        headers: { authorization: "Bearer player-token" },
        query: { user_id: "other-player" },
        body: { userId: "other-player", seconds: 9999 },
      }, read);
      assert.equal(read.statusCode, 200);
      assert.deepEqual(read.body, { playedSeconds: 3721 });
      assert.equal(read.headers["Cache-Control"], "private, no-store");
      assert.deepEqual(playtimeReads, ["eq.verified-player"]);

      const unauthorized = response();
      await usageHandler({ method: "GET", headers: {} }, unauthorized);
      assert.equal(unauthorized.statusCode, 401);
      assert.equal(playtimeReads.length, 1);

      rows.delete("verified-player");
      const missing = response();
      await usageHandler({ method: "GET", headers: { authorization: "Bearer player-token" } }, missing);
      assert.equal(missing.statusCode, 200);
      assert.deepEqual(missing.body, { playedSeconds: 0 });

      const method = response();
      await usageHandler({ method: "PUT", headers: {} }, method);
      assert.equal(method.statusCode, 405);
      assert.equal(method.headers.Allow, "GET, POST");
    });
  } finally {
    globalThis.fetch=oldFetch;
    for(const name of names){if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];}
  }
});
