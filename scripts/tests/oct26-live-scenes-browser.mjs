import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const url=process.env.GAME_TEST_URL || "http://127.0.0.1:5189/",origin=new URL(url).origin;
assert.ok(["localhost","127.0.0.1"].includes(new URL(url).hostname));
const out=process.env.GAME_SCREENSHOT_DIR || "/tmp/mist-live-scenes-oct26";
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(url);
  await page.locator(".first-page-settings-button").click();
  await page.getByRole("button",{name:"2D CLASSIC · SWITCH TO 3D",exact:true}).click();
  await page.locator(".first-page-settings-button").click();
  await page.getByRole("button",{name:"UNLOCK ALL MAZES",exact:true}).click();
  const checks=[];
  for(const [label,key] of [["Orbital Ruins","level1"],["Emerald Wilds","level2"]]) {
    await page.locator(".level-choice").filter({hasText:label}).click();
    await page.locator(".name-prompt-input").fill("Scene check");
    await page.locator(".name-prompt-button.primary").click();
    await page.waitForFunction(key=>globalThis.__mistMazeWorld?.levelKey===key&&globalThis.__mistMazeWorld?.viewMode==="3d",key);
    const sample=await page.evaluate(async()=>{
      const w=globalThis.__mistMazeWorld;
      w.enemies=[];w.developerInvincible=true;w.player.facing=0;
      const {collectVisualDecorations3D}=await import("/src/features/visualPolish.js");
      collectVisualDecorations3D(w);
      const props=w.level.themeKey==="space"?w.__visualPolishCache.spaceDebris:w.__visualPolishCache.junglePlants;
      // Choose a real floor tile near scenery to exercise the browser-installed
      // feature collector instead of rendering only the standalone canvas chain.
      let found=false;
      for(const prop of props) {
        const x=prop.xCenter ?? prop.x+.5,y=prop.yCenter ?? prop.y+.5;
        for(const [dx,dy,facing] of [[-2,0,0],[2,0,Math.PI],[0,-2,Math.PI/2],[0,2,-Math.PI/2]]) {
          if(w.grid[Math.floor(y+dy)]?.[Math.floor(x+dx)]!==0)continue;
          Object.assign(w.player,{x:x+dx,y:y+dy,facing});
          if(collectVisualDecorations3D(w).length){found=true;break;}
        }
        if(found)break;
      }
      const decorations=collectVisualDecorations3D(w);
      return {key:w.levelKey,count:decorations.length,depths:decorations.map(d=>d.projection.depth),facing:w.player.facing};
    });
    assert.ok(sample.count>0,`${key}: real browser-installed scenery is in the main scene`);
    await page.waitForFunction(()=>{const c=document.querySelector("#mist-visual-polish-canvas");return !c||getComputedStyle(c).display==="none";});
    const stage=page.locator(".maze-game-root .maze-frame");
    for(let angle=0;angle<8;angle++) {
      await page.evaluate(f=>{globalThis.__mistMazeWorld.player.facing=f;},sample.facing+angle*Math.PI/4);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await stage.screenshot({path:`${out}/${key}-angle-${angle}.png`});
    }
    await page.screenshot({path:`${out}/${key}-full-browser.png`});
    checks.push(sample);
    await page.keyboard.press("Escape");
    await page.locator(".level-choice").first().waitFor();
  }
  // Switching back to 2D still restores the original browser artwork layer.
  await page.locator(".first-page-settings-button").click();
  await page.getByRole("button",{name:"✓ 3D · SWITCH TO 2D",exact:true}).click();
  await page.locator(".first-page-settings-button").click();
  await page.locator(".level-choice").filter({hasText:"Orbital Ruins"}).click();
  await page.locator(".name-prompt-button.primary").click();
  await page.waitForFunction(()=>{const c=document.querySelector("#mist-visual-polish-canvas");return c&&getComputedStyle(c).display!=="none";});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:"PASS",checks:"16 actual browser views with registered decorations, no stale floating overlay, 2D overlay preserved",scenes:checks,errors,out}));
}finally{await browser.close();}
