import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = process.env.GAME_TEST_URL || "http://127.0.0.1:5189/", origin = new URL(base).origin;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const out = process.env.GAME_SCREENSHOT_DIR || "/tmp/mist-first-identity-browser";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors=[];
async function pageFor(options={}) {
  const page=await browser.newPage({viewport:{width:1440,height:1000},...options});
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/*",route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  return page;
}
try {
  const page=await pageFor();await page.goto(base);
  const dialog=page.getByRole("dialog",{name:"Choose your player name",exact:true});await dialog.waitFor();
  assert.equal(await page.locator(".level-choice").count(),0,"first-time identity precedes gameplay");
  assert.equal(await page.getByRole("button",{name:"Start exploring",exact:true}).isDisabled(),true);
  await page.locator("#first-player-name").fill("  Cedar  Runner ");
  await page.getByRole("button",{name:"Start exploring",exact:true}).click();
  await page.getByRole("heading",{name:"Playtime unlocks",exact:true}).waitFor();
  assert.equal(await page.locator("#progress-player").inputValue(),"Cedar Runner");
  await page.screenshot({path:`${out}/named-first-page.png`});
  await page.reload();await page.getByRole("heading",{name:"Playtime unlocks",exact:true}).waitFor();
  assert.equal(await dialog.count(),0,"saved names skip the first-time prompt");
  await page.locator(".level-choice").filter({hasText:"Abandoned City"}).click();
  await page.waitForFunction(()=>Boolean(document.querySelector(".maze-game-root"))&&globalThis.__mistMazeWorld?.playerName==="Cedar Runner");
  assert.equal(await page.locator(".name-prompt-card").count(),0,"normal mazes no longer ask for a name each run");
  await page.keyboard.press("Escape");await page.locator("#progress-player").waitFor();
  await page.locator("#progress-player").fill("Changed Name");await page.getByRole("button",{name:"Use name",exact:true}).click();
  await page.reload();await page.locator("#progress-player").waitFor();
  assert.equal(await page.locator("#progress-player").inputValue(),"Changed Name");
  assert.equal(await dialog.count(),0);

  const migrated=await pageFor();
  await migrated.addInitScript(()=>localStorage.setItem("mist-maze-player-progress-v1",JSON.stringify({profiles:{"p:existing scout":{seconds:7200}},lastPlayerName:"Existing Scout"})));
  await migrated.goto(base);await migrated.locator("#progress-player").waitFor();
  assert.equal(await migrated.getByRole("dialog",{name:"Choose your player name",exact:true}).count(),0);
  assert.equal(await migrated.locator("#progress-player").inputValue(),"Existing Scout");
  assert.equal(await migrated.getByRole("button",{name:"Enter The Cube",exact:true}).isEnabled(),true,"migration preserves earned unlocks");

  const special=await pageFor();await special.goto(base);await special.locator("#first-player-name").fill("oibougvovov");
  await special.getByRole("button",{name:"Start exploring",exact:true}).click();
  await special.getByRole("button",{name:"Enter Powerup Defense",exact:true}).waitFor();
  const balances=()=>special.evaluate(async()=>({miz:(await import("/src/services/mizEconomy.js")).loadMizState().miz,hux:(await import("/src/services/huxEconomy.js")).loadHuxState().hux}));
  assert.deepEqual(await balances(),{miz:1000000,hux:10000});await special.reload();
  await special.getByRole("button",{name:"Enter Powerup Defense",exact:true}).waitFor();
  assert.deepEqual(await balances(),{miz:1000000,hux:10000},"the first-time name does not regrant the special reward on reload");

  const developer=await pageFor();await developer.goto(base+ (base.includes("?")?"&":"?")+"developer=1");
  await developer.getByRole("heading",{name:"Mist Maze Developer Analytics",exact:true}).waitFor();
  assert.equal(await developer.getByRole("dialog",{name:"Choose your player name",exact:true}).count(),0,"developer route does not require player onboarding");

  const mobile=await pageFor({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mobile.goto(base);
  const form=mobile.locator(".first-identity-card");await form.waitFor();
  const bounds=await form.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391);
  await mobile.screenshot({path:`${out}/first-name-mobile.png`});
  assert.deepEqual(errors,[]);
  console.log("PASS first-time identity: required initial name, saved/reloaded identity, direct maze entry, rename, existing-profile migration, single-credit special gift, developer route, mobile layout, no page errors.");
} finally { await browser.close(); }
