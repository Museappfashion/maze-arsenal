// Optional pixel verification using a native Canvas2D implementation. It
// exercises the exact Vite renderer aliases without browser automation.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
const { createCanvas } = await import(process.env.GAME_CANVAS_MODULE_PATH || "@napi-rs/canvas");
const out = process.env.GAME_SCREENSHOT_DIR || "/tmp/mist-style-and-perspective-qa";
await mkdir(out,{recursive:true});
globalThis.OffscreenCanvas = class { constructor(width,height) { return createCanvas(width,height); } };
globalThis.document = { createElement: (tag) => { assert.equal(tag,"canvas"); return createCanvas(1,1); } };
const server = await createServer({ root:fileURLToPath(new URL("../../",import.meta.url)), cacheDir:"/tmp/mist-native-render-vite-cache", server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:"custom",optimizeDeps:{noDiscovery:true,include:[]} });
try {
  const {createWorld} = await server.ssrLoadModule("/src/game/world-enhanced.js");
  const {drawWorld} = await server.ssrLoadModule("/src/game/rendering-2.0.js");
  const core = await server.ssrLoadModule("/src/game/rendering.js?core");
  const {projectScenePoint,scenePickupShape} = await server.ssrLoadModule("/src/game/sceneProjection3D.js");
  const results=[];
  for (const key of ["level1","level2"]) {
    const world=createWorld(key,"3d");
    world.width=19; world.height=19;
    world.grid=Array.from({length:19},(_,y)=>Array.from({length:19},(_,x)=>!x||!y||x===18||y===18||(x===12&&y>2&&y<15)?1:0));
    world.floorTiles=[];
    for(let y=0;y<19;y++)for(let x=0;x<19;x++)if(!world.grid[y][x])world.floorTiles.push({x,y});
    world.floorCount=world.floorTiles.length;
    world.discovered=new Uint8Array(19*19).fill(1);
    world.exit={x:15,y:16}; world.start={x:3,y:3};
    world.enemies=[];world.effects=[];world.projectiles=[];world.labelsOn=false;world.message="";world.time=2;
    world.pickups=[{id:9001,x:9.5,y:7.5,type:"powerup",powerUp:"haste",color:"#facc15"},{id:9002,x:9.5,y:9.5,type:"weapon",weapon:"pistol"},{id:9003,x:10.5,y:8.5,type:"ammo",amount:20},{id:9004,x:9.5,y:11.5,type:"medkit",amount:20}];
    Object.assign(world.player,{x:7.5,y:9.5,facing:0});
    const canvas=createCanvas(840,720),ctx=canvas.getContext("2d");
    const sheet=createCanvas(1680,1120),sc=sheet.getContext("2d");
    const ms=[];
    for(let i=0;i<12;i++) {
      const corner=i>=8;
      Object.assign(world.player,corner?{x:11.72,y:8.5}:{x:7.5,y:9.5});
      world.player.facing=(corner?i-8:i)*Math.PI/4;
      const before=performance.now();drawWorld(ctx,world);ms.push(performance.now()-before);
      const fixed=canvas.toBuffer("image/png");drawWorld(ctx,world);
      assert.ok(fixed.equals(canvas.toBuffer("image/png")),`${key} ${i}: stable scene`);
      sc.drawImage(canvas,(i%4)*420,Math.floor(i/4)*374,420,360);
      sc.fillStyle="#07111f";sc.fillRect((i%4)*420,Math.floor(i/4)*374+360,420,14);
      sc.fillStyle="#cbd5e1";sc.font="11px sans-serif";sc.fillText(`${key} ${corner?"corner":"open"} ${Math.round(world.player.facing*180/Math.PI)}°`,(i%4)*420+7,Math.floor(i/4)*374+371);
      if(i===0||i===8)await writeFile(`${out}/${key}-${corner?"corner":"scene"}.png`,fixed);
    }
    await writeFile(`${out}/${key}-angles.png`,sheet.toBuffer("image/png"));
    results.push({key,angles:12,warmMs:ms.slice(1).reduce((a,b)=>a+b,0)/11});
    // A cube behind the real asteroid/tree wall contributes zero pixels.
    Object.assign(world.player,{x:10.5,y:8.5,facing:0});
    const z=new Float32Array(280), plane=core.draw3DEnvironment(ctx,world,z);
    const hidden=createCanvas(840,720),hc=hidden.getContext("2d");
    const pickup={x:13.5,y:8.5,type:"powerup",powerUp:"haste",color:"#facc15"};
    core.draw3DPickup(hc,world,pickup,core.project3DSprite(world,pickup.x,pickup.y,plane),z);
    assert.equal(hc.getImageData(0,0,840,720).data.some((v,i)=>i%4===3&&v>0),false,`${key}: cube cannot leak through solid wall`);
    // A later decorative pass must also respect a nearer cube's surface.
    const front={...pickup,x:11.3};
    const frontProjection=core.project3DSprite(world,front.x,front.y,plane);
    core.draw3DPickup(ctx,world,front,frontProjection,z);
    const shape=scenePickupShape(world,front);
    const middle=projectScenePoint(world.player,[front.x,front.y,shape.heightAboveGround]);
    const px=Math.floor(middle.screenX),py=Math.floor(middle.screenY);
    const before=ctx.getImageData(px,py,1,1).data;
    const behind=core.project3DSprite(world,11.7,front.y,plane);
    ctx.save();core.clip3DSceneSprite(ctx,world,behind);ctx.fillStyle="#ff00ff";ctx.fillRect(0,0,840,720);ctx.restore();
    assert.deepEqual(ctx.getImageData(px,py,1,1).data,before,`${key}: background decorations do not paint over a closer cube`);
  }
  // Orbit one cube: the shape and shaded faces change naturally as it is viewed
  // from different world directions, while the projected position stays anchored.
  const cubeSheet=createCanvas(1200,300),cc=cubeSheet.getContext("2d");
  cc.fillStyle="#07111f";cc.fillRect(0,0,1200,300);
  const fixture={time:1,level:{themeKey:"city"},labelsOn:false,player:{x:0,y:0,facing:0}};
  const pickup={x:4,y:4,type:"powerup",color:"#facc15"};
  const silhouettes=new Set();
  for(let i=0;i<4;i++) {
    const angle=(i*.5+.15)*Math.PI;
    fixture.player={x:4-Math.cos(angle)*2,y:4-Math.sin(angle)*2,facing:angle};
    const c=createCanvas(840,720),cx=c.getContext("2d");
    const projection=core.project3DSprite(fixture,4,4,600);
    core.draw3DPickup(cx,fixture,pickup,projection);
    silhouettes.add(c.toBuffer("image/png").toString("base64"));
    const p=projectScenePoint(fixture.player,[4,4,scenePickupShape(fixture,pickup).heightAboveGround]);
    cc.drawImage(c,p.screenX-90,p.screenY-100,180,180,i*300+60,35,180,180);
  }
  assert.equal(silhouettes.size,4);
  await writeFile(`${out}/cube-orbit.png`,cubeSheet.toBuffer("image/png"));
  // Reproduce the City/Keep corner case where center rays are blocked while
  // the edges of a cube are visible. The old broad cull hid the whole pickup.
  for (const key of ["level0","level3"]) {
    const w=createWorld(key,"3d");w.labelsOn=false;w.enemies=[];w.projectiles=[];w.effects=[];
    Object.assign(w.player,{x:2.5,y:2.5,facing:0});w.exit={x:-20,y:2};
    w.pickups=[{x:4.5,y:2.5,type:"powerup",color:"#facc15"}];
    const c=createCanvas(840,720),cx=c.getContext("2d"),z=new Float32Array(280);
    const plane=core.draw3DEnvironment(cx,w,z);cx.clearRect(0,0,840,720);
    z.fill(Infinity);for(let i=138;i<=142;i++)z[i]=.5;
    core.draw3DSprites(cx,w,z,plane);
    assert.ok(cx.getImageData(0,0,840,720).data.some((v,i)=>i%4===3&&v>0),`${key}: partially visible cube survives blocked center rays`);
  }
  const td=await server.ssrLoadModule("/src/game/towerDefense.js");
  const {drawDefenseGame}=await server.ssrLoadModule("/src/game/towerDefenseRenderer.js");
  const game=td.createDefenseGame();for(const [x,y] of [[3,4],[5,6],[11,5]])td.placeDefense(game,"rapidFire",x,y);
  td.startDefenseWave(game);for(let i=0;i<70;i++)td.stepDefense(game,.1);
  const board=createCanvas(900,600);drawDefenseGame(board.getContext("2d"),game,null,"rapidFire");
  await writeFile(`${out}/tower-defense.png`,board.toBuffer("image/png"));
  const {createHundredFloorRun,createHundredFloor}=await server.ssrLoadModule("/src/game/hundredFloorMaze.js");
  const {drawHundredFloorMaze}=await server.ssrLoadModule("/src/game/hundredFloorRendering.js");
  for(let floor=1;floor<=4;floor++) {
    const w=createHundredFloorRun(2026);Object.assign(w,createHundredFloor(2026,floor));w.player={...w.start};w.explored.fill(1);
    const c=createCanvas(840,720);drawHundredFloorMaze(c.getContext("2d"),w,840,720,false);
    await writeFile(`${out}/hundred-floor-${floor}.png`,c.toBuffer("image/png"));
  }
  console.log(JSON.stringify({status:"PASS",checks:"24 full renderer camera views, stable frames, outdoor cube occlusion, four cube sides, original-style TD/four floor themes",results,out}));
} finally {await server.close();delete globalThis.OffscreenCanvas;delete globalThis.document;}
