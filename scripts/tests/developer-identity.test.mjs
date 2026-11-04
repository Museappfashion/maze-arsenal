import assert from "node:assert/strict";
import test from "node:test";
import usageHandler from "../../api/developer-usage.js";
import dashboardHandler from "../../api/developer-analytics.js";

// Full existing HTTP boundaries: the identified visitor is written using the
// verified Supabase user, then returned by the real developer dashboard handler.
test("a first-time name appears in the developer dashboard before any game is played", async () => {
  const oldFetch = globalThis.fetch;
  const names = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "DEVELOPER_DASHBOARD_KEY"];
  const before = Object.fromEntries(names.map(name=>[name,process.env[name]]));
  process.env.SUPABASE_URL = "https://identity-test.invalid";
  process.env.SUPABASE_SECRET_KEY = "server-only-identity-key";
  process.env.DEVELOPER_DASHBOARD_KEY = "private-dashboard-key";
  const rows = new Map(), writes = [];
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
    if(url.pathname==="/rest/v1/developer_usage_stats")return json([...rows.values()]);
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
  } finally {
    globalThis.fetch=oldFetch;
    for(const name of names){if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];}
  }
});
