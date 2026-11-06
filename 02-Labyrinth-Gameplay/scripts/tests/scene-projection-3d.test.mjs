import assert from "node:assert/strict";
import test from "node:test";
import { CANVAS_WIDTH } from "../../src/config/constants.js";
import { projectScenePoint, projectSceneBox, sceneScreenY, scenePickupShape, sceneFaceDepthAt, SCENE_HORIZON, SCENE_NEAR_PLANE } from "../../src/game/sceneProjection3D.js";

const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-8, `${a} != ${b}`);
test("floor, feet, and pickup coordinates use the same perspective at all view directions", () => {
  for (let turn=0; turn<32; turn++) {
    const facing = turn * Math.PI / 16;
    const camera = { x:10,y:10,facing };
    for (const distance of [.3,1,4,16]) {
      const x = camera.x + Math.cos(facing)*distance, y = camera.y + Math.sin(facing)*distance;
      const floor = projectScenePoint(camera,[x,y,0]);
      const center = projectScenePoint(camera,[x,y,.25]);
      near(floor.screenX,CANVAS_WIDTH/2);
      near(floor.screenY,sceneScreenY(floor.scale));
      near(floor.screenY-SCENE_HORIZON,(center.screenY-SCENE_HORIZON)*2);
    }
  }
});

test("moving twice as far halves projected size and ground displacement, without screen clamps", () => {
  const camera={x:0,y:0,facing:0};
  const a=projectScenePoint(camera,[3,0,.1]), b=projectScenePoint(camera,[6,0,.1]);
  near(a.scale,b.scale*2);
  near(a.screenY-SCENE_HORIZON,(b.screenY-SCENE_HORIZON)*2);
  assert.equal(projectScenePoint(camera,[-1,0,.1]),null);
  assert.equal(projectScenePoint(camera,[SCENE_NEAR_PLANE/2,0,.1]),null);
});

test("powerups are actual cubes with distinct visible faces while the camera orbits", () => {
  const world={time:1}, pickup={x:4,y:4,type:"powerup"};
  const shape=scenePickupShape(world,pickup);
  assert.equal(shape.width,shape.height); assert.equal(shape.height,shape.depth);
  const signatures=new Set();
  for(let i=0;i<32;i++) {
    const angle=i*Math.PI/16;
    const camera={x:4-Math.cos(angle)*3,y:4-Math.sin(angle)*3,facing:angle};
    const faces=projectSceneBox(camera,[4,4,shape.heightAboveGround],shape);
    assert.ok(faces.length>=2 && faces.length<=3);
    assert.ok(new Set(faces.map((f)=>f.shade)).size>=2);
    signatures.add(faces.map((f)=>f.indices.join(",")).join("/"));
    for(const face of faces) {
      for(const p of face.points) { assert.ok(p.every(Number.isFinite)); assert.ok(p[2]>=SCENE_NEAR_PLANE); }
      const x=face.points.reduce((s,p)=>s+p[0],0)/face.points.length, y=face.points.reduce((s,p)=>s+p[1],0)/face.points.length;
      const depth=sceneFaceDepthAt(face,x,y);
      assert.ok(depth>=Math.min(...face.points.map((p)=>p[2]))-1e-8 && depth<=Math.max(...face.points.map((p)=>p[2]))+1e-8);
    }
  }
  assert.ok(signatures.size>=8,"orbiting reveals different world-space sides");
});

test("close cube faces clip against the camera plane without reflecting behind it", () => {
  for(let i=0;i<16;i++) {
    const angle=i*Math.PI/8;
    const camera={x:-Math.cos(angle)*.2,y:-Math.sin(angle)*.2,facing:angle};
    const faces=projectSceneBox(camera,[0,0,.3],{width:.4,height:.4,depth:.4,rotation:.3});
    for(const face of faces) for(const p of face.points) { assert.ok(p.every(Number.isFinite)); assert.ok(p[2]>=SCENE_NEAR_PLANE); }
  }
  assert.equal(projectSceneBox({x:4,y:0,facing:0},[0,0,.2]).length,0);
});

test("pickup bobbing happens in world units and never pushes a box below its support", () => {
  for(const type of ["powerup","weapon","ammo","medkit","labyrinthBreaker"]) {
    for(let time=0;time<10;time+=.1) {
      const shape=scenePickupShape({time},{type,x:3,y:4});
      assert.ok(shape.heightAboveGround-shape.height/2>0);
    }
  }
});
