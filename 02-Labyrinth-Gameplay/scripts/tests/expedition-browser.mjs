import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||"playwright");
const url=process.env.GAME_TEST_URL||"http://127.0.0.1:5189/",origin=new URL(url).origin;
assert.ok(["localhost","127.0.0.1"].includes(new URL(url).hostname));
const out=process.env.GAME_SCREENSHOT_DIR||"/tmp/mist-nov02-browser";await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true}),errors=[];
async function setup(options={}){
 const page=await browser.newPage({viewport:{width:1440,height:1000},...options});page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await page.goto(url);
 await page.locator("#first-player-name").fill("Explorer");await page.getByRole("button",{name:"Start exploring",exact:true}).click();return page;
}
async function chooseSpecial(page){await page.locator("#progress-player").fill("oibougvovov");await page.getByRole("button",{name:"Use name",exact:true}).click();}
async function enterCube(page){await page.getByRole("button",{name:"Enter The Cube",exact:true}).click();await page.waitForFunction(()=>Boolean(globalThis.__mistCubeMazeWorld));}
async function capture(page){if(!await page.evaluate(()=>Boolean(document.pointerLockElement)))await page.getByRole("button",{name:"Capture mouse",exact:true}).click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector(".cube-canvas"));}
const state=page=>page.evaluate(()=>{const w=globalThis.__mistCubeMazeWorld;return{seed:w.seed,x:w.player.x,y:w.player.y,z:w.player.z,elapsed:w.elapsed,lift:w.activeLift?{phase:w.activeLift.phase,targetZ:w.activeLift.targetZ}:null};});
async function exitCube(page){await page.keyboard.press("Escape");await page.waitForFunction(()=>document.pointerLockElement===null);assert.equal(await page.locator(".cube-page").count(),1,"first Escape only frees cursor");assert.equal(await page.getByRole("heading",{name:"Maze paused",exact:true}).count(),0,"no pause dock/dialog on first Escape");await page.keyboard.press("Escape");await page.locator("#progress-player").waitFor();}
try{
 const page=await setup();
 assert.equal(await page.getByRole("button",{name:"60 min of play remaining",exact:true}).isDisabled(),true);
 assert.equal(await page.getByRole("button",{name:"120 min of play remaining",exact:true}).isDisabled(),true);
 await chooseSpecial(page);
 const balances=()=>page.evaluate(async()=>({miz:(await import("/src/services/mizEconomy.js")).loadMizState().miz,hux:(await import("/src/services/huxEconomy.js")).loadHuxState().hux}));
 assert.deepEqual(await balances(),{miz:1000000,hux:10000});await page.reload();await page.locator("#progress-player").waitFor();assert.deepEqual(await balances(),{miz:1000000,hux:10000});assert.equal(await page.locator("#first-player-name").count(),0);
 await page.getByRole("button",{name:"Enter Powerup Defense",exact:true}).click();await page.locator(".td-canvas").waitFor();
 assert.equal(await page.locator(".td-power").count(),20,"all twenty original powerups are selectable");
 const images=new Set();
 for(const label of ["Abandoned City","Emerald Wilds","Fallen Keep","Orbital Ruins"]){
  const button=page.locator(".td-level-select").getByRole("button",{name:label,exact:true});await button.click();assert.equal(await button.getAttribute("aria-pressed"),"true");
  await page.waitForFunction(label=>document.querySelector(".td-arena-label").textContent.includes(label),label);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  images.add(await page.locator(".td-canvas").evaluate(c=>c.toDataURL()));
 }
 assert.equal(images.size,4,"all four levels have distinct actual boards");
 const board=page.locator(".td-canvas");const cell=async(x,y)=>{const b=await board.boundingBox();await page.mouse.click(b.x+(x+.5)/18*b.width,b.y+(y+.5)/12*b.height);};
 for(const[x,y]of[[3,4],[5,6],[11,5]])await cell(x,y);
 assert.equal(await page.locator(".td-energy").innerText(),"0");assert.equal(await page.locator(".td-current-stats + .td-next-stats").count(),1);
 await page.clock.install();await page.getByRole("button",{name:"Start wave 1",exact:true}).click();await page.clock.runFor(4000);
 const progress=()=>page.evaluate(async()=>(await import("/src/services/playerProgress.js")).getPlayerProgress("oibougvovov").playedSeconds);
 const active=await progress();assert.ok(active>3&&active<5);
 await page.getByRole("button",{name:"Pause",exact:true}).click();const paused=await progress();await page.clock.runFor(1000);assert.equal(await progress(),paused);
 await page.getByRole("button",{name:"Resume battle",exact:true}).click();await page.getByRole("button",{name:"3×",exact:true}).click();await page.clock.runFor(10000);
 await page.getByRole("button",{name:"Start wave 2",exact:true}).waitFor();await page.screenshot({path:`${out}/td-twenty-powers.png`});
 const keptEnergy=await page.locator(".td-energy").innerText();await page.locator(".td-level-select").getByRole("button",{name:"Abandoned City",exact:true}).click();await page.getByRole("alertdialog").waitFor();await page.getByRole("button",{name:"Keep this battle",exact:true}).click();assert.equal(await page.locator(".td-energy").innerText(),keptEnergy);
 await page.locator(".td-level-select").getByRole("button",{name:"Abandoned City",exact:true}).click();await page.getByRole("button",{name:"Start selected level",exact:true}).click();assert.equal(await page.locator(".td-energy").innerText(),"270");assert.deepEqual(await balances(),{miz:1000000,hux:10000});
 await page.getByRole("button",{name:"Back to first page",exact:true}).click();await enterCube(page);
 assert.deepEqual(await page.evaluate(()=>globalThis.__mistCubeMazeWorld.dimensions),{length:100,width:100,height:100});
 assert.equal(await page.locator(".cube-page .maze-sidebar").count(),0);assert.equal(await page.locator(".hundred-status-grid").count(),0);assert.equal(await page.getByRole("button",{name:/Compass/}).count(),0);
 const bounds=await page.locator(".cube-canvas").boundingBox();assert.ok(bounds.width>1400&&bounds.height>950,"Cube fills viewport without status dock");
 assert.equal(await page.evaluate(()=>document.pointerLockElement),null,"one click is required to start mouse look");
 await capture(page);const spawn=await state(page);await page.keyboard.down("w");await page.clock.runFor(500);await page.keyboard.up("w");const moved=await state(page);assert.ok(Math.hypot(moved.x-spawn.x,moved.y-spawn.y)>.2);
 await page.keyboard.press("q");assert.equal(await page.evaluate(()=>globalThis.__mistCubeMazeWorld.compass),0,"compass shortcut is removed");
 await page.keyboard.press("m");const map=page.locator(".cube-minimap-expanded");await map.waitFor();await page.waitForFunction(()=>document.pointerLockElement===null);
 const frozen=await state(page);const before=await map.locator("canvas").evaluate(c=>c.toDataURL());await map.getByRole("button",{name:"Rotate map right",exact:true}).click();await map.getByRole("button",{name:"Zoom map in",exact:true}).click();await page.clock.runFor(250);assert.notEqual(await map.locator("canvas").evaluate(c=>c.toDataURL()),before);
 await map.getByRole("button",{name:/Whole cube/}).click();await page.clock.runFor(200);assert.match(await map.innerText(),/100 × 100 × 100/);await page.screenshot({path:`${out}/cube-100-overview.png`});
 assert.deepEqual(await state(page),frozen,"map cannot move the player or earn playtime");await map.getByRole("button",{name:/Close map/}).click();await capture(page);
 // Put the player on a legal three-story platform, then use actual E movement.
 await page.evaluate(async()=>{const m=await import("/src/game/cubeMaze.js"),w=globalThis.__mistCubeMazeWorld,n=m.getCubeNode(w,"l0:3:s0");w.activeLift=null;w.activeRamp=null;Object.assign(w.player,{x:n.x,y:n.y,z:0,facing:Math.PI/4,pitch:-.25});w.currentNode=n.id;w.lifts[n.shaftId]={z:0,targetZ:0,phase:"idle"};});
 await page.clock.runFor(150);await page.keyboard.press("e");await page.clock.runFor(1200);const riding=await state(page);assert.ok(riding.z>.2&&riding.z<12,"lifter carries continuously, without a floor jump");assert.ok(riding.lift);await page.screenshot({path:`${out}/cube-moving-lift.png`});
 await page.keyboard.press("Escape");await page.waitForFunction(()=>document.pointerLockElement===null);const held=await state(page);await page.clock.runFor(300);assert.deepEqual(await state(page),held,"mouse release freezes an in-flight lift");assert.equal(await page.locator(".cube-page").count(),1);await page.keyboard.press("Escape");await page.locator("#progress-player").waitFor();
 await enterCube(page);const restored=await state(page);for(const key of["seed","x","y","z"])assert.equal(restored[key],held[key],`mid-lift save restores ${key}`);assert.ok(restored.lift);
 await capture(page);await page.clock.runFor(4000);assert.ok(Math.abs((await state(page)).z-12)<.01);assert.equal((await state(page)).lift,null);
 await page.keyboard.down("Shift");await page.keyboard.press("e");await page.keyboard.up("Shift");await page.clock.runFor(4000);assert.ok(Math.abs((await state(page)).z)<.01,"Shift E descends the same lifter");
 await page.evaluate(async()=>{const m=await import("/src/game/cubeMaze.js"),w=globalThis.__mistCubeMazeWorld,a=m.getCubeNode(w,"r0:10:a"),r=m.getCubeNodeEdges(w,a.id).find(e=>e.kind==="ramp"),b=r.b;Object.assign(w.player,{x:a.x+(b.x-a.x)*.3,y:a.y,z:(b.z-a.z)*.3,facing:0,pitch:Math.atan2(b.z-a.z,b.x-a.x)});w.activeRamp=r;w.activeLift=null;});
 const ramp=await state(page);await page.keyboard.down("w");await page.clock.runFor(1000);await page.keyboard.up("w");const up=await state(page);assert.ok(up.z>ramp.z+1&&up.z<ramp.z+8);await page.keyboard.down("s");await page.clock.runFor(1000);await page.keyboard.up("s");assert.ok((await state(page)).z<up.z-1);await page.screenshot({path:`${out}/cube-fullscreen-ramp.png`});
 await exitCube(page);
 const mobile=await setup({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await chooseSpecial(mobile);await enterCube(mobile);
 assert.equal(await mobile.locator(".maze-sidebar").count(),0);assert.equal(await mobile.getByRole("group",{name:"Movement joystick",exact:true}).isVisible(),true);assert.equal(await mobile.getByRole("group",{name:"Look joystick",exact:true}).isVisible(),true);assert.equal(await mobile.evaluate(()=>document.pointerLockElement),null);
 const touch=await mobile.context().newCDPSession(mobile);const stick=await mobile.getByRole("group",{name:"Movement joystick",exact:true}).boundingBox();const tx=stick.x+stick.width/2,ty=stick.y+stick.height/2;const beforeTouch=await state(mobile);await touch.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:tx,y:ty}]});await touch.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:tx,y:ty-25}]});await mobile.waitForTimeout(300);await touch.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});const afterTouch=await state(mobile);assert.ok(Math.hypot(afterTouch.x-beforeTouch.x,afterTouch.y-beforeTouch.y)>.2);
 await mobile.screenshot({path:`${out}/cube-mobile-fullscreen.png`});await mobile.getByRole("button",{name:/Expand map/}).click();const mm=mobile.locator(".cube-minimap-expanded");await mm.waitFor();const mb=await mm.boundingBox();assert.ok(mb.x>=0&&mb.x+mb.width<=391&&mb.y>=0&&mb.y+mb.height<=845);await mobile.waitForFunction(()=>{const c=document.querySelector(".cube-minimap-expanded canvas"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>170&&d[i+1]>210&&d[i+2]>230&&d[i+3]>200)n++;return n>10;});await mobile.screenshot({path:`${out}/cube-mobile-map.png`});
 assert.deepEqual(errors,[]);console.log("PASS Nov2 browser: first-time name, gift once, all20TDpowers/fourdistinctboards, wave/speed/previews/levelchange guards,100cubed/no dock or compass,clickcapture/twoEscapeexit,3Dmap,continuousramps andlifts,midridesave/resume,descent,mobilecontrols/map,no pageerrors.");
}finally{await browser.close();}
