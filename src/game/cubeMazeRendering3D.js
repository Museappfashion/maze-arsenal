import { getCubeScene, getCubeOverview, cubeMazeHint, CUBE_DIMENSIONS, CUBE_STORY_HEIGHT } from "./cubeMaze.js";
import { clipOutdoorPolygon, createOutdoorRaster, rasterOutdoorTriangle } from "./outdoorGeometry3D.js";

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

function quad(mesh, a, b, c, d, color) {
  mesh.triangles.push({ a, b, c, color }, { a, b: c, c: d, color });
}
function meshAt(x, y, z, radius = 4) { return { x, y, z, radius, triangles: [] }; }
function edgeMeshes(edge) {
  const a = point(edge.a), b = point(edge.b), dx = b[0] - a[0], dy = b[1] - a[1];
  const flatLength = Math.hypot(dx, dy), width = edge.width || 3;
  if (flatLength < .001) return [];
  const nx = -dy / flatLength * width / 2, ny = dx / flatLength * width / 2;
  const ramp = edge.kind === "ramp" || Math.abs(b[2] - a[2]) > .01;
  const count = Math.max(1, Math.ceil(flatLength / 4));
  const result = [];
  for (let i = 0; i < count; i++) {
    const t0 = i / count, t1 = (i + 1) / count;
    const start = lerp(a, b, t0), end = lerp(a, b, t1), middle = lerp(start, end, .5);
    const mesh = meshAt(...middle, Math.hypot(flatLength / count, (b[2] - a[2]) / count) / 2 + width + CUBE_CEILING_HEIGHT);
    const floor = [plus(start, nx, ny), plus(end, nx, ny), plus(end, -nx, -ny), plus(start, -nx, -ny)];
    const alternate = i % 2;
    quad(mesh, ...floor, ramp ? alternate ? [28, 56, 75] : [25, 48, 66] : alternate ? [24, 36, 53] : [20, 31, 47]);
    // Thin seam markings are world geometry on the slope, not screen pictures.
    if (ramp) {
      const bandStart = lerp(start, end, .15), bandEnd = lerp(start, end, .19);
      quad(mesh, plus(bandStart, nx * .88, ny * .88, .012), plus(bandEnd, nx * .88, ny * .88, .012), plus(bandEnd, -nx * .88, -ny * .88, .012), plus(bandStart, -nx * .88, -ny * .88, .012), [61, 157, 182]);
    }
    // Stop side walls at the room portals; otherwise every junction would be
    // blocked by the side of the next corridor. Floor remains continuous.
    const margin = Math.min(1.48 / flatLength, .24);
    const wallT0 = Math.max(t0, margin), wallT1 = Math.min(t1, 1 - margin);
    if (wallT1 > wallT0) {
      const s = lerp(a, b, wallT0), e = lerp(a, b, wallT1);
      for (const side of [-1, 1]) {
        const sl = plus(s, nx * side, ny * side), el = plus(e, nx * side, ny * side);
        quad(mesh, sl, el, plus(el, 0, 0, CUBE_CEILING_HEIGHT), plus(sl, 0, 0, CUBE_CEILING_HEIGHT), side === 1 ? [57, 74, 94] : [43, 59, 79]);
        quad(mesh, plus(sl, 0, 0, .14), plus(el, 0, 0, .14), plus(el, 0, 0, .19), plus(sl, 0, 0, .19), ramp ? [69, 179, 201] : [52, 105, 133]);
        quad(mesh, plus(sl, 0, 0, 2.62), plus(el, 0, 0, 2.62), plus(el, 0, 0, 2.67), plus(sl, 0, 0, 2.67), [31, 56, 77]);
      }
      quad(mesh, plus(s, nx, ny, CUBE_CEILING_HEIGHT), plus(s, -nx, -ny, CUBE_CEILING_HEIGHT), plus(e, -nx, -ny, CUBE_CEILING_HEIGHT), plus(e, nx, ny, CUBE_CEILING_HEIGHT), [16, 26, 41]);
    }
    result.push(mesh);
  }
  return result;
}
function nodeMesh(node, incident) {
  const radius = node.radius || 2.1, mesh = meshAt(node.x, node.y, node.z, radius + CUBE_CEILING_HEIGHT);
  const center = [node.x, node.y, node.z], sides = 16;
  const angles = incident.map((edge) => {
    const other = edge.a.id === node.id ? edge.b : edge.a;
    return Math.atan2(other.y - node.y, other.x - node.x);
  });
  const halfOpening = Math.asin(Math.min(.99, 1.54 / radius));
  for (let i = 0; i < sides; i++) {
    const aa = i * TAU / sides, ab = (i + 1) * TAU / sides;
    const a = plus(center, Math.cos(aa) * radius, Math.sin(aa) * radius), b = plus(center, Math.cos(ab) * radius, Math.sin(ab) * radius);
    mesh.triangles.push({ a: center, b: a, c: b, color: [29, 44, 62] });
    const angle = (aa + ab) / 2;
    if (angles.some((opening) => Math.abs(Math.atan2(Math.sin(angle - opening), Math.cos(angle - opening))) < halfOpening + Math.PI / sides)) continue;
    quad(mesh, a, b, plus(b, 0, 0, CUBE_CEILING_HEIGHT), plus(a, 0, 0, CUBE_CEILING_HEIGHT), [49, 65, 86]);
    quad(mesh, plus(a, 0, 0, .16), plus(b, 0, 0, .16), plus(b, 0, 0, .21), plus(a, 0, 0, .21), [50, 120, 145]);
  }
  return mesh;
}

export function buildCubeGeometry(scene) {
  const edges = scene.edges || [];
  return [...edges.flatMap(edgeMeshes), ...(scene.nodes || []).map((node) => nodeMesh(node, edges.filter((edge) => edge.a.id === node.id || edge.b.id === node.id)))];
}
function geometryFor(world, scene) {
  let cache = meshCaches.get(world);
  if (!cache) { cache = new Map(); meshCaches.set(world, cache); }
  const result = [];
  for (const edge of scene.edges) {
    const id = `edge:${edge.id}`;
    if (!cache.has(id)) cache.set(id, edgeMeshes(edge));
    result.push(...cache.get(id));
  }
  for (const node of scene.nodes) {
    const incident = scene.edges.filter((edge) => edge.a.id === node.id || edge.b.id === node.id);
    const id = `node:${node.id}:${incident.map((edge) => edge.id).sort().join(",")}`;
    if (!cache.has(id)) cache.set(id, [nodeMesh(node, incident)]);
    result.push(...cache.get(id));
  }
  while (cache.size > 1400) cache.delete(cache.keys().next().value);
  return result;
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
      const polygon = clipOutdoorPolygon([cubeCameraPoint(camera, face.a), cubeCameraPoint(camera, face.b), cubeCameraPoint(camera, face.c)], CUBE_NEAR);
      if (polygon.length < 3) continue;
      const projected = polygon.map((v) => [target.width / 2 + v[0] * plane / v[2], target.height / 2 - v[1] * plane / v[2], v[2]]);
      const color = face.color.map((channel, i) => channel * (1 - fog) + [3, 8, 19][i] * fog);
      for (let i = 1; i < projected.length - 1; i++) rasterOutdoorTriangle(target, projected[0], projected[i], projected[i + 1], color);
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
function routeNodes(world) {
  if (!(world.compass > 0 || world.sonar > 0)) return [];
  const route = cubeMazeHint(world,24);
  return Array.isArray(route) ? route.map((node) => node.node || node).filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.z)) : [];
}
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
  ctx.save(); ctx.fillStyle = "#030813"; ctx.fillRect(0, 0, width, height); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(surface.canvas, 0, 0, width, height);
  const vignette = ctx.createRadialGradient(width * .5, height * .48, width * .12, width * .5, height * .48, width * .72);
  vignette.addColorStop(0, "#02061700"); vignette.addColorStop(1, "#020617a0"); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
  const centerX = width / 2, centerY = height / 2;
  ctx.strokeStyle = "#a5e5f5cc"; ctx.lineWidth = 1.5; ctx.beginPath();
  for (const [x1, y1, x2, y2] of [[-9, 0, -4, 0], [4, 0, 9, 0], [0, -9, 0, -4], [0, 4, 0, 9]]) { ctx.moveTo(centerX + x1, centerY + y1); ctx.lineTo(centerX + x2, centerY + y2); }
  ctx.stroke();
  const ramp = world.activeRamp;
  ctx.font = "700 12px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#b9d1e5";
  ctx.fillText(`THE CUBE · ALT ${world.player.z.toFixed(1)} / ${CUBE_DIMENSIONS.height}`, 16, height - 20);
  if (ramp) { ctx.fillStyle = "#67e8f9"; ctx.fillText(`RAMP · ${Math.abs(ramp.riseStories || 1)} ${Math.abs(ramp.riseStories || 1) === 1 ? "STORY" : "STORIES"}`, 16, height - 40); }
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
  return { center:{x:CUBE_DIMENSIONS.length/2,y:CUBE_DIMENSIONS.width/2,z:CUBE_DIMENSIONS.height/2},yaw:-.65,tilt:.65,zoom:.04,band:CUBE_DIMENSIONS.height,follow:false,overview:true };
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
    const ramp = edge.kind === "ramp" || edge.a.z !== edge.b.z;
    const distance = Math.abs((edge.a.z + edge.b.z) / 2 - center.z);
    const alpha = clamp(1 - distance / Math.max(8, view.band || 20), .18, 1);
    ctx.globalAlpha = alpha;
    projectLine(edge.a, edge.b, ramp ? "#67dcef" : explored ? "#8ca7c3" : "#405570", ramp ? 2.3 : 1.6);
    if (ramp && width > 350 && Math.hypot(p(edge.a).x - p(edge.b).x, p(edge.a).y - p(edge.b).y) > 35) {
      const middle = p({ x: (edge.a.x + edge.b.x) / 2, y: (edge.a.y + edge.b.y) / 2, z: (edge.a.z + edge.b.z) / 2 });
      ctx.fillStyle = "#a5f3fc"; ctx.font = "700 9px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(`${Math.abs(edge.riseStories || 1)}s`, middle.x, middle.y - 4);
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
  if(view.overview) { ctx.fillStyle="#a5d4e7";ctx.font="700 10px system-ui,sans-serif";ctx.textAlign="left";ctx.fillText("WHOLE CUBE · 1,000 × 100 × 1,000",10,18);ctx.fillStyle="#7b98b5";ctx.font="9px system-ui,sans-serif";ctx.fillText("Sampled passages · use altitude slices for detail",10,33); }
  ctx.fillStyle = "#87a6c5"; ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.fillText(`X ${center.x.toFixed(0)} · Y ${center.y.toFixed(0)} · Z ${center.z.toFixed(0)}`, 10, height - 11);
  ctx.restore();
}
