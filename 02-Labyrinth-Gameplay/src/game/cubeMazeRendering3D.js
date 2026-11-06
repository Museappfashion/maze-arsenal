import { getCubeScene, getCubeOverview, cubeMazeHint, CUBE_DIMENSIONS, CUBE_STORY_HEIGHT } from "./cubeMaze.js";
import { clipOutdoorPolygon, createOutdoorRaster, rasterOutdoorTriangle } from "./outdoorGeometry3D.js";
import { cubeMaterialColor } from "./cubeMazeMaterials3D.js";

// The Cube uses real x/y/z vertices. Eye height and camera pitch are applied
// before near-plane clipping; a pixel depth buffer resolves ramps and crossings.
export const CUBE_EYE_HEIGHT = 1.62;
export const CUBE_CEILING_HEIGHT = 2.9;
export const CUBE_NEAR = .08;
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const point = (node) => Array.isArray(node) ? node : [node.x, node.y, node.z];
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const plus = (v, x = 0, y = 0, z = 0) => [v[0] + x, v[1] + y, v[2] + z];
const surfaces = new WeakMap();
const meshCaches = new WeakMap();

export function cubeCameraPoint(camera, vertex, eyeHeight = CUBE_EYE_HEIGHT) {
  const dx = vertex[0] - camera.x, dy = vertex[1] - camera.y;
  const dz = vertex[2] - (camera.z + eyeHeight);
  const yaw = camera.facing || 0, pitch = camera.pitch || 0;
  const forward = dx * Math.cos(yaw) + dy * Math.sin(yaw);
  return [-dx * Math.sin(yaw) + dy * Math.cos(yaw), dz * Math.cos(pitch) - forward * Math.sin(pitch), forward * Math.cos(pitch) + dz * Math.sin(pitch)];
}

export function projectCubePoint(camera, vertex, width, height, eyeHeight = CUBE_EYE_HEIGHT) {
  const p = cubeCameraPoint(camera, vertex, eyeHeight);
  if (p[2] < CUBE_NEAR) return null;
  const plane = width / (2 * Math.tan(Math.PI / 5));
  return { x: width / 2 + p[0] * plane / p[2], y: height / 2 - p[1] * plane / p[2], depth: p[2], scale: plane / p[2] };
}

function quad(mesh, a, b, c, d, color, material) {
  mesh.triangles.push({ a, b, c, color, material }, { a, b: c, c: d, color, material });
}
function meshAt(x, y, z, radius = 4) { return { x, y, z, radius, triangles: [] }; }
function edgeMeshes(edge) {
  if (edge.kind === "lift") return [];
  const a = point(edge.a), originalB = point(edge.b);
  const originalLength = Math.hypot(originalB[0]-a[0],originalB[1]-a[1]);
  const b = edge.kind === "liftApproach" ? lerp(a,originalB,Math.max(0,1-1.46/originalLength)) : originalB;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const flatLength = Math.hypot(dx, dy), width = edge.width || 3;
  if (flatLength < .001) return [];
  const nx = -dy / flatLength * width / 2, ny = dx / flatLength * width / 2;
  const surface = { dx: dx / flatLength, dy: dy / flatLength, baseU: (a[0] * dx + a[1] * dy) / flatLength, baseZ: a[2], slope: (b[2] - a[2]) / flatLength, centerAcross: (-a[0] * dy + a[1] * dx) / flatLength, width };
  const ramp = edge.kind === "ramp" || Math.abs(b[2] - a[2]) > .01;
  const count = Math.max(1, Math.ceil(flatLength / 4));
  const result = [];
  for (let i = 0; i < count; i++) {
    const t0 = i / count, t1 = (i + 1) / count;
    const start = lerp(a, b, t0), end = lerp(a, b, t1), middle = lerp(start, end, .5);
    const mesh = meshAt(...middle, Math.hypot(flatLength / count, (b[2] - a[2]) / count) / 2 + width + CUBE_CEILING_HEIGHT);
    const floor = [plus(start, nx, ny), plus(end, nx, ny), plus(end, -nx, -ny), plus(start, -nx, -ny)];
    quad(mesh, ...floor, [83, 78, 68], { ...surface, surface: "floor", light: 1.05 });
    // Thin seam markings are world geometry on the slope, not screen pictures.
    if (ramp) {
      const bandStart = lerp(start, end, .15), bandEnd = lerp(start, end, .19);
      quad(mesh, plus(bandStart, nx * .88, ny * .88, .012), plus(bandEnd, nx * .88, ny * .88, .012), plus(bandEnd, -nx * .88, -ny * .88, .012), plus(bandStart, -nx * .88, -ny * .88, .012), [161, 145, 90], { ...surface, surface: "rampMark", light: 1 });
    }
    // Stop side walls at the room portals; otherwise every junction would be
    // blocked by the side of the next corridor. Floor remains continuous.
    const margin = Math.min(1.48 / flatLength, .24);
    const wallT0 = Math.max(t0, margin), wallT1 = Math.min(t1, edge.kind === "liftApproach" ? 1 : 1 - margin);
    if (wallT1 > wallT0) {
      const s = lerp(a, b, wallT0), e = lerp(a, b, wallT1);
      for (const side of [-1, 1]) {
        const sl = plus(s, nx * side, ny * side), el = plus(e, nx * side, ny * side);
        quad(mesh, sl, el, plus(el, 0, 0, CUBE_CEILING_HEIGHT), plus(sl, 0, 0, CUBE_CEILING_HEIGHT), [109, 106, 95], { ...surface, surface: "wall", light: side === 1 ? .94 : .82 });
        quad(mesh, plus(sl, 0, 0, .14), plus(el, 0, 0, .14), plus(el, 0, 0, .19), plus(sl, 0, 0, .19), [91, 93, 78], { ...surface, surface: "trim", light: .8 });
        quad(mesh, plus(sl, 0, 0, 2.62), plus(el, 0, 0, 2.62), plus(el, 0, 0, 2.67), plus(sl, 0, 0, 2.67), [91, 93, 78], { ...surface, surface: "trim", light: .7 });
      }
      quad(mesh, plus(s, nx, ny, CUBE_CEILING_HEIGHT), plus(s, -nx, -ny, CUBE_CEILING_HEIGHT), plus(e, -nx, -ny, CUBE_CEILING_HEIGHT), plus(e, nx, ny, CUBE_CEILING_HEIGHT), [55, 53, 46], { ...surface, surface: "ceiling", light: .75 });
    }
    result.push(mesh);
  }
  return result;
}
function nodeMesh(node, incident) {
  const radius = node.radius || 2.1, mesh = meshAt(node.x, node.y, node.z, radius + CUBE_CEILING_HEIGHT);
  const center = [node.x, node.y, node.z];
  const openings = incident.filter(edge=>edge.kind!=="lift").map((edge) => {
    const other = edge.a.id === node.id ? edge.b : edge.a;
    return { angle:Math.atan2(other.y-node.y,other.x-node.x), half:Math.asin(Math.min(.99,(edge.width||3)/2/radius)) };
  });
  // Include exact portal boundaries in the room ring. Removing whole coarse
  // wall faces left triangular slits beside passages, especially on close turns.
  const angles=Array.from({length:24},(_,i)=>i*TAU/24);
  for(const opening of openings)for(const delta of [-opening.half,opening.half])angles.push(((opening.angle+delta)%TAU+TAU)%TAU);
  const sorted=[...new Set(angles.map(angle=>Math.round(angle*1e9)/1e9))].sort((a,b)=>a-b);
  for(let i=0;i<sorted.length;i++) {
    const aa=sorted[i],ab=i===sorted.length-1?sorted[0]+TAU:sorted[i+1];
    const a=plus(center,Math.cos(aa)*radius,Math.sin(aa)*radius),b=plus(center,Math.cos(ab)*radius,Math.sin(ab)*radius);
    const surface={dx:1,dy:0,baseZ:node.z,centerAcross:node.y,width:radius*2};
    mesh.triangles.push({a:center,b:a,c:b,color:[83,78,68],material:{...surface,surface:"floor",light:1.05}});
    mesh.triangles.push({a:plus(center,0,0,CUBE_CEILING_HEIGHT),b:plus(b,0,0,CUBE_CEILING_HEIGHT),c:plus(a,0,0,CUBE_CEILING_HEIGHT),color:[55,53,46],material:{...surface,surface:"ceiling",light:.75}});
    const angle=(aa+ab)/2;
    if(openings.some(opening=>Math.abs(Math.atan2(Math.sin(angle-opening.angle),Math.cos(angle-opening.angle)))<opening.half-1e-8))continue;
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),wallSurface={...surface,dx:(b[0]-a[0])/length,dy:(b[1]-a[1])/length};
    quad(mesh,a,b,plus(b,0,0,CUBE_CEILING_HEIGHT),plus(a,0,0,CUBE_CEILING_HEIGHT),[109,106,95],{...wallSurface,surface:"wall",light:.86+Math.cos(angle)*.07});
    quad(mesh,plus(a,0,0,.16),plus(b,0,0,.16),plus(b,0,0,.21),plus(a,0,0,.21),[91,93,78],{...wallSurface,surface:"trim",light:.8});
  }
  return mesh;
}
function cubeShell() {
  const L=CUBE_DIMENSIONS.length,W=CUBE_DIMENSIONS.width,H=CUBE_DIMENSIONS.height;
  const mesh=meshAt(L/2,W/2,H/2,Math.hypot(L,W,H)),floor={dx:1,dy:0,baseZ:0,surface:"floor",light:.8};
  quad(mesh,[0,0,0],[L,0,0],[L,W,0],[0,W,0],[83,78,68],floor);
  quad(mesh,[0,0,H],[0,W,H],[L,W,H],[L,0,H],[55,53,46],{...floor,surface:"ceiling",light:.6});
  for(const [a,b] of [[[0,0,0],[L,0,0]],[[L,0,0],[L,W,0]],[[L,W,0],[0,W,0]],[[0,W,0],[0,0,0]]]) {
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    quad(mesh,a,b,plus(b,0,0,H),plus(a,0,0,H),[109,106,95],{surface:"wall",dx:(b[0]-a[0])/length,dy:(b[1]-a[1])/length,baseZ:0,light:.7});
  }
  return mesh;
}
const shell=cubeShell();
function liftMeshes(lift) {
  const result=[],u=[lift.ux,lift.uy],n=[-lift.uy,lift.ux];
  const v=(along,across,z)=>[lift.x+u[0]*along+n[0]*across,lift.y+u[1]*along+n[1]*across,z];
  const material={dx:u[0],dy:u[1],baseZ:0,surface:"wall",light:.8};
  const platform=meshAt(lift.x,lift.y,lift.platformZ,5);
  const floor=[v(-1.6,-1.6,lift.platformZ),v(1.6,-1.6,lift.platformZ),v(1.6,1.6,lift.platformZ),v(-1.6,1.6,lift.platformZ)];
  quad(platform,...floor,[89,91,82],{...material,baseZ:lift.platformZ,surface:"floor",light:1.1});
  quad(platform,...floor.map(p=>plus(p,0,0,2.7)),[55,53,46],{...material,baseZ:lift.platformZ,surface:"ceiling",light:.75});
  for(const [a,b] of [[v(-1.6,-1.6,lift.platformZ),v(-1.6,1.6,lift.platformZ)],[v(-1.6,-1.6,lift.platformZ),v(1.6,-1.6,lift.platformZ)],[v(-1.6,1.6,lift.platformZ),v(1.6,1.6,lift.platformZ)]])quad(platform,a,b,plus(b,0,0,2.7),plus(a,0,0,2.7),[105,101,89],{...material,baseZ:lift.platformZ});
  if(lift.phase==="moving")quad(platform,v(1.6,-1.6,lift.platformZ),v(1.6,1.6,lift.platformZ),v(1.6,1.6,lift.platformZ+2.7),v(1.6,-1.6,lift.platformZ+2.7),[117,108,82],{...material,surface:"trim",light:1});
  result.push(platform);
  for(let story=lift.lowStory;story<=lift.highStory;story++) {
    const z=story*4,mesh=meshAt(lift.x,lift.y,z,6);
    for(const [a,b] of [[v(-1.7,-1.7,z),v(-1.7,1.7,z)],[v(-1.7,-1.7,z),v(1.7,-1.7,z)],[v(-1.7,1.7,z),v(1.7,1.7,z)]])quad(mesh,a,b,plus(b,0,0,4),plus(a,0,0,4),[101,99,88],material);
    // Closed landing gates cover every shaft opening while the cabin is away.
    // The platform overlaps the corridor threshold when its door is open.
    const open=Math.abs(lift.platformZ-z)<.08&&["idle","boarding"].includes(lift.phase);
    if(!open)quad(mesh,v(1.65,-1.7,z),v(1.65,1.7,z),v(1.65,1.7,z+2.9),v(1.65,-1.7,z+2.9),[100,99,84],{...material,surface:"trim",light:.95});
    quad(mesh,v(1.65,-1.7,z+2.9),v(1.65,1.7,z+2.9),v(1.65,1.7,z+4),v(1.65,-1.7,z+4),[109,106,95],material);
    const lamp=open?[85,173,105]:[176,144,76];
    quad(mesh,v(1.67,-.28,z+3.1),v(1.67,.28,z+3.1),v(1.67,.28,z+3.28),v(1.67,-.28,z+3.28),lamp);
    result.push(mesh);
  }
  return result;
}

export function buildCubeGeometry(scene) {
  const edges = scene.edges || [];
  return [...(scene.lifts||[]).flatMap(liftMeshes), ...edges.flatMap(edgeMeshes), ...(scene.nodes || []).filter(node=>node.kind!=="liftStation").map((node) => nodeMesh(node, edges.filter((edge) => edge.a.id === node.id || edge.b.id === node.id))), shell];
}
function geometryFor(world, scene) {
  let cache = meshCaches.get(world);
  if (!cache) { cache = new Map(); meshCaches.set(world, cache); }
  const result = (scene.lifts||[]).flatMap(liftMeshes);
  for (const edge of scene.edges) {
    const id = `edge:${edge.id}`;
    if (!cache.has(id)) cache.set(id, edgeMeshes(edge));
    result.push(...cache.get(id));
  }
  for (const node of scene.nodes) {
    if(node.kind==="liftStation")continue;
    const incident = scene.edges.filter((edge) => edge.a.id === node.id || edge.b.id === node.id);
    const id = `node:${node.id}:${incident.map((edge) => edge.id).sort().join(",")}`;
    if (!cache.has(id)) cache.set(id, [nodeMesh(node, incident)]);
    result.push(...cache.get(id));
  }
  result.push(shell);
  while (cache.size > 1400) cache.delete(cache.keys().next().value);
  return result;
}

// Near clipping carries world attributes with each new camera-plane vertex.
// Otherwise close wall turns would smear a texture across the whole screen.
export function clipCubeMaterialPolygon(vertices, near = CUBE_NEAR) {
  const result = [];
  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i], previous = vertices[(i + vertices.length - 1) % vertices.length];
    const inside = current[2] >= near, wasInside = previous[2] >= near;
    if (inside !== wasInside) {
      const t = (near - previous[2]) / (current[2] - previous[2]);
      result.push(current.map((value, axis) => axis === 2 ? near : previous[axis] + (value - previous[axis]) * t));
    }
    if (inside) result.push(current);
  }
  return result;
}

export function rasterCubeMaterialTriangle(target, a, b, c, material, maxDistance = 52) {
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (!Number.isFinite(area) || Math.abs(area) < .00001) return;
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), maxX = Math.min(target.width - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), maxY = Math.min(target.height - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const invArea = 1 / area;
  const waX = (b[1] - c[1]) * invArea, waY = (c[0] - b[0]) * invArea;
  const wbX = (c[1] - a[1]) * invArea, wbY = (a[0] - c[0]) * invArea;
  const wa0 = ((b[0] - minX - .5) * (c[1] - minY - .5) - (b[1] - minY - .5) * (c[0] - minX - .5)) * invArea;
  const wb0 = ((c[0] - minX - .5) * (a[1] - minY - .5) - (c[1] - minY - .5) * (a[0] - minX - .5)) * invArea;
  const ia = 1 / a[2], ib = 1 / b[2], ic = 1 / c[2], light = material.light ?? 1;
  const ax = a[3] * ia, ay = a[4] * ia, az = a[5] * ia;
  const bx = b[3] * ib, by = b[4] * ib, bz = b[5] * ib;
  const cx = c[3] * ic, cy = c[4] * ic, cz = c[5] * ic;
  for (let y = minY; y <= maxY; y++) {
    let wa = wa0 + (y - minY) * waY, wb = wb0 + (y - minY) * wbY;
    for (let x = minX; x <= maxX; x++, wa += waX, wb += wbX) {
      const wc = 1 - wa - wb;
      if (wa < -.000001 || wb < -.000001 || wc < -.000001) continue;
      const depth = 1 / (wa * ia + wb * ib + wc * ic), index = y * target.width + x;
      // Coplanar room/corridor/shell floors must keep the first surface.
      // Float32 depth rounding otherwise exposes alternating backing texels.
      if (depth >= target.depth[index] - Math.max(.00001, depth * .000001)) continue;
      target.depth[index] = depth;
      const wx = (wa * ax + wb * bx + wc * cx) * depth;
      const wy = (wa * ay + wb * by + wc * cy) * depth;
      const wz = (wa * az + wb * bz + wc * cz) * depth;
      const color = cubeMaterialColor(material, wx, wy, wz);
      const fog = Math.min(.92, Math.max(0, (depth - 6) / maxDistance)), brightness = (1 - fog) * light;
      const pixel = index * 4;
      target.pixels[pixel] = (color >>> 16) * brightness + 20 * fog;
      target.pixels[pixel + 1] = ((color >>> 8) & 255) * brightness + 22 * fog;
      target.pixels[pixel + 2] = (color & 255) * brightness + 17 * fog;
      target.pixels[pixel + 3] = 255;
    }
  }
}

export function renderCubeGeometry(target, meshes, camera, options = {}) {
  target.pixels.fill(0); target.depth.fill(Infinity);
  const plane = options.plane || target.width / (2 * Math.tan(Math.PI / 5));
  const maxDistance = options.maxDistance || 52;
  for (const mesh of meshes) {
    const dx = mesh.x - camera.x, dy = mesh.y - camera.y, dz = mesh.z - camera.z;
    const cameraCenter = cubeCameraPoint(camera, [mesh.x, mesh.y, mesh.z + CUBE_CEILING_HEIGHT / 2]);
    const [side, up, forward] = cameraCenter;
    if (Math.hypot(dx, dy, dz) > maxDistance + mesh.radius || forward < -mesh.radius || Math.abs(side) > forward * Math.tan(Math.PI / 5) + mesh.radius * 2 || Math.abs(up) > forward * target.height / (2 * plane) + mesh.radius * 2) continue;
    const fog = clamp((Math.hypot(dx, dy, dz) - 6) / maxDistance, 0, .92);
    for (const face of mesh.triangles) {
      const vertices = [face.a, face.b, face.c];
      const polygon = face.material
        ? clipCubeMaterialPolygon(vertices.map((vertex) => [...cubeCameraPoint(camera, vertex), ...vertex]))
        : clipOutdoorPolygon(vertices.map((vertex) => cubeCameraPoint(camera, vertex)), CUBE_NEAR);
      if (polygon.length < 3) continue;
      const projected = polygon.map((v) => [target.width / 2 + v[0] * plane / v[2], target.height / 2 - v[1] * plane / v[2], v[2], ...v.slice(3)]);
      const color = face.color.map((channel, i) => channel * (1 - fog) + [20, 22, 17][i] * fog);
      for (let i = 1; i < projected.length - 1; i++) {
        if (face.material) rasterCubeMaterialTriangle(target, projected[0], projected[i], projected[i + 1], face.material, maxDistance);
        else rasterOutdoorTriangle(target, projected[0], projected[i], projected[i + 1], color);
      }
    }
  }
  return target;
}
function surfaceFor(ctx, width, height) {
  const scale = Math.max(2, width / 400), w = Math.max(1, Math.ceil(width / scale)), h = Math.max(1, Math.ceil(height / scale));
  let surface = surfaces.get(ctx);
  if (!surface || surface.width !== w || surface.height !== h) {
    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const context = canvas.getContext("2d");
    surface = { ...createOutdoorRaster(w, h), canvas, context, image: context.createImageData(w, h) };
    surfaces.set(ctx, surface);
  }
  return surface;
}

function boxMesh(center, half, height, color) {
  const [x, y, z] = center;
  const mesh = meshAt(x, y, z, Math.hypot(half, height));
  const lower = [[x-half,y-half,z],[x+half,y-half,z],[x+half,y+half,z],[x-half,y+half,z]];
  const upper = lower.map((v) => plus(v,0,0,height));
  for (let i=0;i<4;i++) quad(mesh,lower[i],lower[(i+1)%4],upper[(i+1)%4],upper[i],color.map((v)=>Math.round(v*(.72+i*.07))));
  quad(mesh,...upper,color);
  return mesh;
}
function routeNodes() { return []; }

function sceneDetails(world,scene) {
  const result=[];
  for (const pickup of scene.pickups || world.pickups || []) {
    if (pickup.collected || world.collected?.has(pickup.id)) continue;
    result.push(boxMesh([pickup.x,pickup.y,(pickup.z || 0)+.38],.3,.6,pickup.type === "haste" ? [74,222,128] : [45,212,191]));
  }
  const goal=world.goal || scene.goal;
  if (goal) {
    result.push(boxMesh([goal.x,goal.y,goal.z+.02],.8,.12,[44,143,91]));
    result.push(boxMesh([goal.x,goal.y,goal.z+.14],.33,2,[74,222,128]));
  }
  const route=routeNodes(world);
  for(let i=0;i<route.length-1;i++) {
    const a=point(route[i]),b=point(route[i+1]);
    const distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const count=Math.ceil(distance/3);
    for(let step=0;step<count;step++) result.push(boxMesh(plus(lerp(a,b,(step+.5)/count),0,0,.045),.1,.035,[92,214,237]));
  }
  return result;
}

export function drawCubeMaze(ctx, world, width, height, options = {}) {
  if (!(width > 0 && height > 0)) return;
  const surface = surfaceFor(ctx, width, height);
  const scene = options.scene || getCubeScene(world, { radius: 54, verticalRadius: 16, maxNodes: 420 });
  renderCubeGeometry(surface, [...geometryFor(world, scene),...sceneDetails(world,scene)], world.player);
  surface.image.data.set(surface.pixels); surface.context.putImageData(surface.image, 0, 0);
  ctx.save(); ctx.fillStyle = "#161a15"; ctx.fillRect(0, 0, width, height); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(surface.canvas, 0, 0, width, height);
  const vignette = ctx.createRadialGradient(width * .5, height * .48, width * .12, width * .5, height * .48, width * .72);
  vignette.addColorStop(0, "#11140f00"); vignette.addColorStop(1, "#11140f90"); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
  const centerX = width / 2, centerY = height / 2;
  ctx.strokeStyle = "#a5e5f5cc"; ctx.lineWidth = 1.5; ctx.beginPath();
  for (const [x1, y1, x2, y2] of [[-9, 0, -4, 0], [4, 0, 9, 0], [0, -9, 0, -4], [0, 4, 0, 9]]) { ctx.moveTo(centerX + x1, centerY + y1); ctx.lineTo(centerX + x2, centerY + y2); }
  ctx.stroke();
  if (options.showStatus !== false) {
  const ramp = world.activeRamp;
  ctx.font = "700 12px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#b9d1e5";
  ctx.fillText(`THE CUBE · ALT ${world.player.z.toFixed(1)} / ${CUBE_DIMENSIONS.height}`, 16, height - 20);
  if (ramp) { ctx.fillStyle = "#67e8f9"; ctx.fillText(`RAMP · ${Math.abs(ramp.riseStories || 1)} ${Math.abs(ramp.riseStories || 1) === 1 ? "STORY" : "STORIES"}`, 16, height - 40); }
  }
  ctx.restore();
}

// Orthographic map projection preserves altitude. Orbiting changes the visible
// side of every sloped edge; navigation never teleports the game player.
export function projectCubeMapPoint(vertex, view, width, height) {
  const center = view.center || { x: 0, y: 0, z: 0 };
  const dx = vertex[0] - center.x, dy = vertex[1] - center.y, dz = vertex[2] - center.z;
  const yaw = view.yaw ?? -.65, tilt = view.tilt ?? .65;
  const side = dx * Math.cos(yaw) - dy * Math.sin(yaw);
  const forward = dx * Math.sin(yaw) + dy * Math.cos(yaw);
  const scale = Math.min(width, height) / 100 * (view.zoom || 1);
  return { x: width / 2 + side * scale, y: height / 2 + (forward * Math.sin(tilt) - dz * Math.cos(tilt)) * scale, depth: forward * Math.cos(tilt) + dz * Math.sin(tilt) };
}

export function cubeMapOverviewView() {
  return { center:{x:CUBE_DIMENSIONS.length/2,y:CUBE_DIMENSIONS.width/2,z:CUBE_DIMENSIONS.height/2},yaw:-.65,tilt:.65,zoom:.32,band:CUBE_DIMENSIONS.height,follow:false,overview:true };
}
export function cubeMapScene(world, view) {
  if (view.overview) return getCubeOverview(world);
  return getCubeScene(world, { center: view.center || world.player, radius: clamp(75 / (view.zoom || 1), 24, 200), verticalRadius: view.band ?? 20, maxNodes: 650 });
}
export function drawCubeMinimap(ctx, world, width, height, view = {}, scene = cubeMapScene(world, view)) {
  ctx.save(); ctx.clearRect(0, 0, width, height); ctx.fillStyle = "#07101f"; ctx.fillRect(0, 0, width, height);
  const p = (node) => projectCubeMapPoint(point(node), view, width, height);
  const projectLine = (a, b, color, lineWidth = 1) => { const pa = p(a), pb = p(b); ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke(); };
  const corners=[];
  for(const z of [0,CUBE_DIMENSIONS.height])for(const [x,y] of [[0,0],[CUBE_DIMENSIONS.length,0],[CUBE_DIMENSIONS.length,CUBE_DIMENSIONS.width],[0,CUBE_DIMENSIONS.width]])corners.push({x,y,z});
  for(let layer=0;layer<2;layer++)for(let side=0;side<4;side++)projectLine(corners[layer*4+side],corners[layer*4+(side+1)%4],"#35567488",1);
  for(let side=0;side<4;side++)projectLine(corners[side],corners[side+4],"#43678399",1);
  const center = view.center || world.player;
  const z = Math.round(center.z / CUBE_STORY_HEIGHT) * CUBE_STORY_HEIGHT;
  for (let x = Math.floor((center.x - 100) / 20) * 20; x <= center.x + 100; x += 20) projectLine({ x, y: 0, z }, { x, y: CUBE_DIMENSIONS.width, z }, "#1d304766", .7);
  for (let y = 0; y <= CUBE_DIMENSIONS.width; y += 20) projectLine({ x: center.x - 100, y, z }, { x: center.x + 100, y, z }, "#1d304766", .7);
  const sorted = [...scene.edges].sort((a, b) => (p(a.a).depth + p(a.b).depth) - (p(b.a).depth + p(b.b).depth));
  for (const edge of sorted) {
    const explored = world.visited?.has(edge.a.id) || world.visited?.has(edge.b.id) || world.sonar > 0;
    const lift = edge.kind === "lift", ramp = edge.kind === "ramp";
    const distance = Math.abs((edge.a.z + edge.b.z) / 2 - center.z);
    const alpha = clamp(1 - distance / Math.max(8, view.band || 20), .18, 1);
    ctx.globalAlpha = alpha;
    projectLine(edge.a, edge.b, lift ? "#fbbf24" : ramp ? "#67dcef" : explored ? "#8ca7c3" : "#405570", lift || ramp ? 2.3 : 1.6);
    if ((lift || ramp) && width > 350 && Math.hypot(p(edge.a).x - p(edge.b).x, p(edge.a).y - p(edge.b).y) > 35) {
      const middle = p({ x: (edge.a.x + edge.b.x) / 2, y: (edge.a.y + edge.b.y) / 2, z: (edge.a.z + edge.b.z) / 2 });
      ctx.fillStyle = "#a5f3fc"; ctx.font = "700 9px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(`${lift ? "L" : ""}${Math.abs(edge.riseStories || 1)}s`, middle.x, middle.y - 4);
    }
  }
  ctx.globalAlpha = 1;
  const route=routeNodes(world);
  for(let i=0;i<route.length-1;i++)projectLine(route[i],route[i+1],"#e0f2fe",3);
  for (const node of scene.nodes) { const at = p(node); ctx.fillStyle = world.visited?.has(node.id) ? "#b8cbe0" : "#59718c"; ctx.beginPath(); ctx.arc(at.x, at.y, 1.6, 0, TAU); ctx.fill(); }
  const goal = world.goal || scene.goal;
  if (goal && Math.abs(goal.z - center.z) < (view.band || 20)) { const at = p(goal); ctx.fillStyle = "#4ade80"; ctx.fillRect(at.x - 4, at.y - 4, 8, 8); }
  const player = p(world.player), direction = p({ ...world.player, x: world.player.x + Math.cos(world.player.facing) * 4, y: world.player.y + Math.sin(world.player.facing) * 4 });
  ctx.strokeStyle = "#7dd3fc"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(direction.x, direction.y); ctx.stroke();
  ctx.fillStyle = "#e0f2fe"; ctx.shadowColor = "#38bdf8"; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(player.x, player.y, 4, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
  if(view.overview) { ctx.fillStyle="#a5d4e7";ctx.font="700 10px system-ui,sans-serif";ctx.textAlign="left";ctx.fillText("WHOLE CUBE · 100 × 100 × 100",10,18);ctx.fillStyle="#7b98b5";ctx.font="9px system-ui,sans-serif";ctx.fillText("Sampled passages · use altitude slices for detail",10,33); }
  ctx.fillStyle = "#87a6c5"; ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.fillText(`X ${center.x.toFixed(0)} · Y ${center.y.toFixed(0)} · Z ${center.z.toFixed(0)}`, 10, height - 11);
  ctx.restore();
}
