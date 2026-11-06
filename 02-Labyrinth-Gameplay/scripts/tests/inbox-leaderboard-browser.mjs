// Isolated browser integration: fake Supabase/API responses, real UI/services.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const server = await createServer({
  server: { host: "127.0.0.1", port: 5191, strictPort: true },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://inbox-test.invalid"),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("test-publishable-key"),
  },
});
await server.listen();
const origin = "http://127.0.0.1:5191";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const screenshotDir = process.env.GAME_SCREENSHOT_DIR;
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const letters = [{ id: 1, message: "Please fix the city.", createdAt: "2026-10-01T12:00:00Z", replies: [] }];
  const userId = "11111111-1111-4111-8111-111111111111";
  const user = { id: userId, aud: "authenticated", role: "authenticated", is_anonymous: true };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: userId, exp })).toString("base64url")}.test`;
  let signups = 0;
  let inboxReads = 0;
  const rows = ["level0", "level1", "level2", "level3"].flatMap(level => ["2d", "3d"].flatMap(mode =>
    Array.from({ length: 12 }, (_, index) => ({
      level_key: level, mode, player_name: `${level}-${mode}-P${index + 1}`, country_code: "US",
      time_seconds: 100 + index, created_at: "2026-10-01T12:00:00Z", global_rank: index + 1, is_current_user: index === 11,
    })),
  ));
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.hostname === "inbox-test.invalid") {
      if (url.pathname === "/auth/v1/signup") {
        signups += 1;
        return json({ access_token: token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "test-refresh", user });
      }
      if (url.pathname === "/auth/v1/user") return json(user);
      if (url.pathname === "/rest/v1/rpc/get_global_leaderboard") return json(rows);
      throw new Error(`Unexpected fake Supabase request: ${url.pathname}`);
    }
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/api/country") return json({ countryCode: "US" });
    if (url.pathname === "/api/developer-usage") return json({ ok: true });
    if (url.pathname === "/api/developer-analytics") return json({
      totals: { users: 1, gamesStarted: 1, gamesFinished: 0, secondsPlayed: 60, donationAttempts: 0, letters: 1 },
      users: [], letters: letters.map(letter => ({ ...letter, userId, playerName: "Test player" })), diagnostics: {},
    });
    if (url.pathname === "/api/developer-letter") {
      if (request.method() === "PATCH") {
        assert.equal(request.headers().authorization, "Bearer test-dev-key");
        const payload = request.postDataJSON();
        const letter = letters.find(item => String(item.id) === String(payload.letterId));
        const reply = { id: letter.replies.length + 1, message: payload.message, createdAt: new Date().toISOString() };
        letter.replies.push(reply);
        return json({ ok: true, reply });
      }
      assert.equal(request.headers().authorization, `Bearer ${token}`);
      inboxReads += 1;
      return json({ letters });
    }
    return route.continue();
  });
  const errors = [];
  const player = await context.newPage();
  await player.clock.install();
  player.on("pageerror", error => errors.push(error.message));
  await player.goto(origin);
  await player.waitForFunction(() => document.querySelectorAll(".leaderboard-player-name").length === 80);
  assert.equal(signups, 1, "inbox, analytics and leaderboard share one anonymous identity");
  for (const column of await player.locator(".leaderboard-mode-column").all()) {
    assert.equal(await column.locator(".leaderboard-player-name").count(), 10);
    assert.ok((await column.locator(".leaderboard-player-name").last().textContent()).endsWith("P10"));
    assert.ok((await column.locator(".leaderboard-your-rank").innerText()).includes("#12"));
  }
  const developer = await context.newPage();
  developer.on("pageerror", error => errors.push(error.message));
  await developer.goto(`${origin}/?developer=1`);
  await developer.getByPlaceholder("Developer dashboard key").fill("test-dev-key");
  await developer.getByRole("button", { name: "OPEN DASHBOARD" }).click();
  const replyBox = developer.getByRole("textbox", { name: /Reply to Test player/ });
  await replyBox.fill("The city rendering is fixed. Thank you for reporting it!");
  await developer.getByRole("button", { name: "SEND REPLY" }).click();
  await developer.getByText("Reply delivered to the player’s inbox.").waitFor();
  await player.bringToFront();
  await player.evaluate(() => window.dispatchEvent(new Event("focus")));
  await player.locator(".letter-reply-count").waitFor();
  assert.equal(await player.locator(".letter-reply-count").innerText(), "1");
  await player.getByRole("button", { name: "Inbox, 1 developer reply", exact: true }).click();
  await player.getByText("The city rendering is fixed. Thank you for reporting it!", { exact: true }).waitFor();
  const replyRect = await player.locator(".letter-reply").boundingBox();
  const composeRect = await player.locator(".developer-letter-form").boundingBox();
  assert.ok(replyRect.y < composeRect.y, "reply appears before the composer");
  await player.getByRole("textbox", { name: "Letter to the developer", exact: true }).fill("Draft to preserve");
  await player.getByRole("button", { name: "Inbox, 1 developer reply", exact: true }).click();
  await player.getByRole("button", { name: "Inbox, 1 developer reply", exact: true }).click();
  assert.equal(await player.getByRole("textbox", { name: "Letter to the developer", exact: true }).inputValue(), "Draft to preserve");
  if (screenshotDir) await player.screenshot({ path: `${screenshotDir}/player-inbox.png` });
  // A new developer reply arrives while the player leaves the inbox open.
  await replyBox.fill("A second update has arrived.");
  await developer.getByRole("button", { name: "SEND REPLY" }).click();
  await developer.getByText("A second update has arrived.", { exact: true }).waitFor();
  await player.bringToFront();
  await player.clock.runFor(30_100);
  await player.getByText("A second update has arrived.", { exact: true }).waitFor();
  assert.equal(await player.locator(".letter-reply-count").innerText(), "2");
  await player.reload();
  await player.getByRole("button", { name: "Inbox, 2 developer replies", exact: true }).click();
  await player.getByText("A second update has arrived.", { exact: true }).waitFor();
  assert.equal(signups, 1, "reload retains the same identity/inbox");
  assert.ok(inboxReads >= 4);
  assert.deepEqual(errors, []);
  console.log("PASS: 10 names in each of eight boards, separate personal rank, developer sends reply, player sees badge and reply above composer, refresh/reload preserve inbox and session, no browser errors.");
} finally {
  await browser.close();
  await server.close();
}
