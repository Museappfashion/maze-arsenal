import assert from "node:assert/strict";
import test from "node:test";
import { createCubeMaze, getCubeScene } from "../../src/game/cubeMaze.js";
import { createOutdoorRaster } from "../../src/game/outdoorGeometry3D.js";
import { CUBE_EYE_HEIGHT, CUBE_NEAR, cubeCameraPoint, projectCubePoint, buildCubeGeometry, renderCubeGeometry, projectCubeMapPoint, cubeMapOverviewView, cubeMapScene } from "../../src/game/cubeMazeRendering3D.js";

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} should equal ${b}`);
const node=(id,x,y,z)=>({id,x,y,z,radius:2.1});
const a=node("a",0,0,0),b=node("b",24,0,8),c=node("c",24,12,8);
const fixture={nodes:[a,b,c],edges:[{id:"a-b",a,b,kind:"ramp",riseStories:2,width:3},{id:"b-c",a:b,b:c,kind:"corridor",riseStories:0,width:3}]};

test("Cube camera uses real player altitude and pitch before near-plane projection",()=>{
 const camera={x:0,y:0,z:0,facing:0,pitch:0};
 assert.deepEqual(cubeCameraPoint(camera,[10,0,CUBE_EYE_HEIGHT]),[0,0,10]);
 const p=projectCubePoint(camera,[10,0,CUBE_EYE_HEIGHT],800,600);
 close(p.x,400);close(p.y,300);close(p.depth,10);
 const elevated=projectCubePoint({...camera,z:400},[10,0,400+CUBE_EYE_HEIGHT],800,600);
 close(elevated.x,p.x);close(elevated.y,p.y);close(elevated.depth,p.depth);
 assert.equal(projectCubePoint(camera,[-1,0,0],800,600),null);
 assert.ok(projectCubePoint({...camera,pitch:.3},[10,0,CUBE_EYE_HEIGHT],800,600).y>p.y);
});

test("Cube corridor floor, walls, ceiling and ramp stripes are world geometry on a continuous slope",()=>{
 const meshes=buildCubeGeometry(fixture);
 assert.ok(meshes.length>10);
 const vertices=meshes.flatMap(m=>m.triangles.flatMap(t=>[t.a,t.b,t.c]));
 assert.ok(vertices.some(v=>v[0]>2&&v[0]<22&&v[2]>0&&v[2]<8),"ramp has intermediate elevations rather than a floor teleport");
 assert.ok(vertices.some(v=>Math.abs(Math.abs(v[1])-1.5)<1e-6),"corridor sides have physical width");
 assert.ok(vertices.some(v=>Math.abs(v[2]-(8+2.9))<1e-6),"corridors have a solid ceiling");
 assert.ok(vertices.every(v=>v.every(Number.isFinite)));
});

test("Cube geometry stays bounded through close turns and camera motion along a ramp",()=>{
 const meshes=buildCubeGeometry(fixture),target=createOutdoorRaster(140,110);
 const frames=new Set();
 for(let i=0;i<32;i++){
  const t=i/32;
  renderCubeGeometry(target,meshes,{x:2+t*18,y:0,z:(2+t*18)/3,facing:i*Math.PI/16,pitch:Math.sin(i)*.35});
  for(const depth of target.depth)assert.ok(depth===Infinity||Number.isFinite(depth)&&depth>=CUBE_NEAR-1e-5);
  frames.add(Buffer.from(target.pixels).toString("base64"));
 }
 assert.ok(frames.size>24,"moving and orbiting reveal different 3D faces");
 const camera={x:6,y:0,z:2,facing:0,pitch:.25};
 renderCubeGeometry(target,meshes,camera);const first=Uint8ClampedArray.from(target.pixels);
 renderCubeGeometry(target,meshes,camera);assert.deepEqual(target.pixels,first,"same world and camera produce stable frames");
 assert.ok(target.depth.filter(Number.isFinite).length>target.width*target.height*.7,"a real tunnel surrounds the camera");
});

test("Cube depth renders nearer geometry in front independently of submission order",()=>{
 const target=createOutdoorRaster(64,64),mesh=(x,color)=>({x,y:0,z:1.6,radius:3,triangles:[{a:[x,-3,-1],b:[x,3,-1],c:[x,0,5],color}]});
 const near=mesh(3,[255,0,0]),far=mesh(6,[0,255,0]),camera={x:0,y:0,z:0,facing:0,pitch:0};
 renderCubeGeometry(target,[far,near],camera);const first=Uint8ClampedArray.from(target.pixels);
 renderCubeGeometry(target,[near,far],camera);assert.deepEqual(target.pixels,first);
 assert.equal(target.pixels[(32*64+32)*4],255);
 assert.equal(target.pixels[(32*64+32)*4+1],0);
});

test("3D minimap projects altitude and orbit and fits the full volume bounding box",()=>{
 const view={center:{x:500,y:50,z:500},yaw:-.65,tilt:.65,zoom:1};
 const low=projectCubeMapPoint([500,50,480],view,500,400),high=projectCubeMapPoint([500,50,520],view,500,400);
 assert.ok(high.y<low.y,"map does not flatten altitude into a 2D floor map");
 const p=projectCubeMapPoint([540,60,520],view,500,400),rotated=projectCubeMapPoint([540,60,520],{...view,yaw:view.yaw+Math.PI/2},500,400);
 assert.notEqual(p.x,rotated.x);
 const overview=cubeMapOverviewView();
 for(const x of [0,1000])for(const y of [0,100])for(const z of [0,1000]){
  const corner=projectCubeMapPoint([x,y,z],overview,500,400);
  assert.ok(corner.x>=0&&corner.x<=500&&corner.y>=0&&corner.y<=400,"whole volume fits in the overview without dropping vertical scale");
 }
});

test("real scene and overview queries remain bounded while covering visible ramp geometry",()=>{
 const world=createCubeMaze(12345),scene=getCubeScene(world,{radius:54,verticalRadius:16,maxNodes:420});
 const geometry=buildCubeGeometry(scene);
 assert.ok(scene.nodes.length>0&&scene.edges.length>0&&geometry.length>0);
 assert.ok(scene.nodes.length<=650);
 const overview=cubeMapScene(world,cubeMapOverviewView());
 assert.ok(overview.sampled,"overview says it samples passages instead of pretending all geometry is loaded");
 assert.ok(overview.nodes.length<=650&&overview.edges.length>0);
 assert.ok(Math.max(...overview.nodes.map(n=>n.z))>900&&Math.min(...overview.nodes.map(n=>n.z))<10);
});
