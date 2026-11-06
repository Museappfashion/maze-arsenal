import assert from "node:assert/strict";
import test from "node:test";
import { createCubeMaze, getCubeScene, getCubeNode, activateCubeLift, updateCubeMaze } from "../../src/game/cubeMaze.js";
import { createOutdoorRaster } from "../../src/game/outdoorGeometry3D.js";
import { CUBE_EYE_HEIGHT, CUBE_NEAR, cubeCameraPoint, projectCubePoint, buildCubeGeometry, renderCubeGeometry, projectCubeMapPoint, cubeMapOverviewView, cubeMapScene, clipCubeMaterialPolygon, rasterCubeMaterialTriangle } from "../../src/game/cubeMazeRendering3D.js";
import { cubeMaterialColor } from "../../src/game/cubeMazeMaterials3D.js";

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
 const view={center:{x:50,y:50,z:50},yaw:-.65,tilt:.65,zoom:1};
 const low=projectCubeMapPoint([50,50,30],view,500,400),high=projectCubeMapPoint([50,50,70],view,500,400);
 assert.ok(high.y<low.y,"map does not flatten altitude into a 2D floor map");
 const p=projectCubeMapPoint([90,60,70],view,500,400),rotated=projectCubeMapPoint([90,60,70],{...view,yaw:view.yaw+Math.PI/2},500,400);
 assert.notEqual(p.x,rotated.x);
 const overview=cubeMapOverviewView();
 for(const x of [0,100])for(const y of [0,100])for(const z of [0,100]){
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
 assert.ok(Math.max(...overview.nodes.map(n=>n.z))>90&&Math.min(...overview.nodes.map(n=>n.z))<10);
});

test("Cube materials show stone courses, flagstones and green weathering rather than blue tunnel faces",()=>{
 const meshes=buildCubeGeometry(fixture),surfaces=new Set(meshes.flatMap(mesh=>mesh.triangles.map(face=>face.material?.surface).filter(Boolean)));
 for(const surface of ["floor","wall","ceiling","trim","rampMark"])assert.ok(surfaces.has(surface));
 const material={surface:"floor",dx:1,dy:0,centerAcross:0,width:3};
 const colors=new Set();
 for(let x=.15;x<8;x+=.13)for(let y=-1;y<=1;y+=.17){
  const color=cubeMaterialColor(material,x,y,0);colors.add(color);
  assert.ok((color>>>16)>=(color&255),"main stone and concrete stay neutral/warm rather than Orbital blue");
 }
 assert.ok(colors.size>15,"floor has actual texel variation rather than a single recolored face");
 const edgeColors=Array.from({length:80},(_,i)=>cubeMaterialColor(material,i*.13,1.4,0));
 assert.ok(edgeColors.filter(color=>((color>>>8)&255)>(color>>>16)).length>40,"subdued Wilds greens weather the floor edges without becoming a uniform painted stripe");
 const rampColor=cubeMaterialColor({surface:"rampMark"},4,.3,0);
 assert.ok((rampColor>>>16)>(rampColor&255),"ramp paint uses warm stone-game markings, not luminous blue strips");
});

test("wall texels remain fixed in world space as the camera moves and pitches",()=>{
 const material={surface:"wall",dx:0,dy:1,baseZ:0,light:1};
 const face=(a,b,c)=>({a,b,c,color:[109,106,95],material});
 const meshes=[{x:4,y:0,z:1.5,radius:4,triangles:[face([4,-2,0],[4,2,0],[4,2,3]),face([4,-2,0],[4,2,3],[4,-2,3])]}];
 const colors=[];
 for(const camera of [{x:0,y:.123,z:0,facing:0,pitch:0},{x:1,y:.123,z:0,facing:0,pitch:0},{x:0,y:.123,z:.4,facing:0,pitch:Math.atan2(-.4,4)}]){
  const raster=createOutdoorRaster(201,151);renderCubeGeometry(raster,meshes,camera);
  const center=(75*201+100)*4;colors.push([...raster.pixels.slice(center,center+3)]);
 }
 assert.deepEqual(colors[1],colors[0],"walking toward the same physical wall point does not slide its texture");
 assert.deepEqual(colors[2],colors[0],"eye altitude and camera pitch preserve the same physical texel");
 const expected=cubeMaterialColor(material,4,.123,CUBE_EYE_HEIGHT);
 assert.deepEqual(colors[0],[expected>>>16,(expected>>>8)&255,expected&255]);
});

test("near clipping interpolates world texture attributes before perspective division",()=>{
 const vertices=[[-1,0,-1,-2,-3,-4],[1,0,1,2,3,4],[0,1,2,4,6,8]];
 const clipped=clipCubeMaterialPolygon(vertices);
 assert.equal(clipped.length,4);
 for(const vertex of clipped){
  assert.equal(vertex.length,6);assert.ok(vertex.every(Number.isFinite));assert.ok(vertex[2]>=CUBE_NEAR);
  close(vertex[3],vertex[2]*2);close(vertex[4],vertex[2]*3);close(vertex[5],vertex[2]*4);
 }
 assert.equal(clipped.filter(vertex=>vertex[2]===CUBE_NEAR).length,2);
});


function pointOnTriangle(point,face,epsilon=.0001){
 const [a,b,c]=[face.a,face.b,face.c],u=b.map((v,i)=>v-a[i]),v=c.map((q,i)=>q-a[i]),p=point.map((q,i)=>q-a[i]);
 const dot=(x,y)=>x.reduce((n,q,i)=>n+q*y[i],0),uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),pu=dot(p,u),pv=dot(p,v),den=uu*vv-uv*uv;
 if(Math.abs(den)<1e-10)return false;
 const x=(pu*vv-pv*uv)/den,y=(pv*uu-pu*uv)/den;
 const projected=a.map((q,i)=>q+x*u[i]+y*v[i]);
 return x>=-epsilon&&y>=-epsilon&&x+y<=1+epsilon&&Math.hypot(...point.map((q,i)=>q-projected[i]))<epsilon;
}

test("junction floors and ceilings cover the whole walkable room and every ramp/corridor join",()=>{
 const world=createCubeMaze(42),center=getCubeNode(world,"s8:r4:c4"),scene=getCubeScene(world,{center,radius:24,verticalRadius:2,maxNodes:650});
 const faces=buildCubeGeometry(scene).flatMap(mesh=>mesh.triangles),floors=faces.filter(face=>face.material?.surface==="floor"),ceilings=faces.filter(face=>face.material?.surface==="ceiling");
 for(const node of scene.nodes.filter(node=>node.kind!=="liftStation"&&Math.hypot(node.x-center.x,node.y-center.y)<15&&node.z===center.z)){
  for(let i=0;i<16;i++){
   const point=[node.x+Math.cos(i*Math.PI/8)*1.8,node.y+Math.sin(i*Math.PI/8)*1.8,node.z];
   assert.ok(floors.some(face=>pointOnTriangle(point,face)),`room ${node.id} floor has no radial gap`);
   assert.ok(ceilings.some(face=>pointOnTriangle([point[0],point[1],point[2]+2.9],face)),`room ${node.id} has a solid ceiling`);
  }
 }
 for(const edge of scene.edges.filter(edge=>["corridor","ramp"].includes(edge.kind))){
  const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,length=Math.hypot(dx,dy);
  for(const t of [.01,.05,.5,.95,.99])for(const side of [-1,0,1]){
   const point=[edge.a.x+dx*t-dy/length*side,edge.a.y+dy*t+dx/length*side,edge.a.z+(edge.b.z-edge.a.z)*t];
   assert.ok(floors.some(face=>pointOnTriangle(point,face)),`continuous floor at ${edge.kind} ${edge.id} ${t}`);
  }
 }
});

test("actual compact Cube views have no holes at junctions, ramp ends, lift stations or steep looks",()=>{
 const world=createCubeMaze(42),target=createOutdoorRaster(112,88);
 for(const id of ["s0:r0:c0","s8:r4:c4","r4:10:a","r4:10:b","l0:4:s0"]){
  const node=getCubeNode(world,id),scene=getCubeScene(world,{center:node,radius:54,verticalRadius:16,maxNodes:650}),meshes=buildCubeGeometry(scene);
  for(let angle=0;angle<16;angle++){
   renderCubeGeometry(target,meshes,{...node,facing:angle*Math.PI/8,pitch:(angle%3-1)*.65});
   assert.equal(target.depth.filter(Number.isFinite).length,target.depth.length,`${id} ${angle}: closed floors, rooms and cube shell leave no missing pixels`);
  }
 }
});

test("lift geometry renders the carried cabin floor at its real intermediate elevation with closed landing gates",()=>{
 const world=createCubeMaze(12),station=getCubeNode(world,"l0:10:s0");Object.assign(world.player,station);
 assert.equal(activateCubeLift(world),true);for(let i=0;i<30;i++)updateCubeMaze(world,.05);
 assert.ok(world.player.z>0&&world.player.z<40);
 const scene=getCubeScene(world,{center:world.player}),lift=scene.lifts.find(item=>item.id===station.shaftId);
 assert.equal(lift.platformZ,world.player.z);assert.equal(lift.phase,"moving");
 const faces=buildCubeGeometry(scene).flatMap(mesh=>mesh.triangles);
 assert.ok(faces.some(face=>face.material?.surface==="floor"&&pointOnTriangle([station.x,station.y,world.player.z],face)),"real platform floor supports the rider at intermediate Z");
 const target=createOutdoorRaster(112,88);
 renderCubeGeometry(target,buildCubeGeometry(scene),world.player);
 assert.equal(target.depth.filter(Number.isFinite).length,target.depth.length,"moving cabin is closed around the rider");
});


test("coplanar backing floors never punch noisy stripes through the visible corridor floor",()=>{
 const target=createOutdoorRaster(90,70);
 const a=[0,0,3.1,0,0,0],b=[90,0,7.3,5,0,0],c=[45,70,10.9,4,8,0];
 const floor={surface:"floor",dx:1,dy:0,centerAcross:4,width:100,light:1};
 rasterCubeMaterialTriangle(target,a,b,c,floor);const original=Uint8ClampedArray.from(target.pixels);
 rasterCubeMaterialTriangle(target,a,b,c,{surface:"rampMark",light:1});
 assert.deepEqual(target.pixels,original,"Float32 rounding cannot let coplanar shell textures flicker through the main floor");
});
