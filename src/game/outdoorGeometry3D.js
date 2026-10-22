// World-space triangles replace camera-facing wall pictures. Near-plane
// clipping and a pixel depth buffer keep every side correct while turning.
const TAU = Math.PI * 2;
export const OUTDOOR_NEAR_PLANE = .08;
const noise = (x, y, salt = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 53.13) * 43758.5453;
  return n - Math.floor(n);
};

function triangle(mesh, a, b, c, color, variation = 1) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz) || 1;
  nx /= length; ny /= length; nz /= length;
  const light = .52 + Math.max(0, nx * -.4 + ny * -.25 + nz * .8) * .48;
  mesh.triangles.push({ a, b, c, color: color.map((channel) => Math.round(channel * light * variation)) });
}

function rings(mesh, levels, sides, color, seed, jitter = 0) {
  const rotation = noise(seed, 2) * TAU;
  const vertices = levels.map(([x, y, z, radius], layer) => Array.from({ length: sides }, (_, i) => {
    const angle = rotation + i * TAU / sides;
    const r = radius * (1 - jitter / 2 + noise(i, seed, layer) * jitter);
    return [x + Math.cos(angle) * r, y + Math.sin(angle) * r, z];
  }));
  for (let layer = 0; layer < vertices.length - 1; layer++) {
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const variation = .88 + noise(i, seed, layer + 11) * .22;
      triangle(mesh, vertices[layer][i], vertices[layer][j], vertices[layer + 1][i], color, variation);
      triangle(mesh, vertices[layer][j], vertices[layer + 1][j], vertices[layer + 1][i], color, variation);
    }
  }
}

export function createOutdoorMesh(theme, tileX, tileY) {
  const x = tileX + .5, y = tileY + .5, seed = tileX * 71 + tileY * 19;
  const mesh = { x, y, radius: 1.15, triangles: [] };
  if (theme === "jungle") {
    const height = 2.6 + noise(tileX, tileY, 2) * .95;
    const bendX = (noise(tileX, tileY, 4) - .5) * .15;
    const bendY = (noise(tileX, tileY, 5) - .5) * .15;
    // Flared roots, a tall real trunk, then irregular foliage volumes.
    rings(mesh, [[x, y, 0, .48], [x, y, .22, .27], [x + bendX, y + bendY, height * .77, .14]], 7, [133, 100, 59], seed, .16);
    rings(mesh, [[x + bendX, y + bendY, height * .5, .12], [x, y, height * .69, .72], [x + bendX, y + bendY, height * .9, .73], [x + bendX, y + bendY, height, 0]], 8, [75, 137, 55], seed + 2, .3);
    for (let branch = 0; branch < 3; branch++) {
      const angle = branch * TAU / 3 + noise(seed, 7), bx = x + Math.cos(angle) * .47, by = y + Math.sin(angle) * .47;
      const bz = height * (.64 + noise(seed, branch, 6) * .12);
      rings(mesh, [[bx, by, bz - .23, 0], [bx, by, bz, .39], [bx, by, bz + .38, .3], [bx, by, bz + .54, 0]], 6, [66, 119 + branch * 7, 44], seed + branch + 8, .28);
    }
  } else {
    const low = .13 + noise(tileX, tileY, 11) * .16;
    const height = .9 + noise(tileX, tileY, 12) * .8;
    const dx = (noise(tileX, tileY, 14) - .5) * .2, dy = (noise(tileX, tileY, 15) - .5) * .2;
    const stone = noise(tileX, tileY, 16);
    const color = [114 + stone * 31, 110 + stone * 22, 109 + stone * 30];
    rings(mesh, [[x + dx, y + dy, low, 0], [x, y, low + height * .25, .59], [x - dx, y - dy, low + height * .64, .62], [x + dx, y + dy, low + height, .18], [x + dx, y + dy, low + height + .05, 0]], 8, color, seed, .38);
    // Dark scars lie on actual rock faces, retaining the same perspective.
    const faces = mesh.triangles.slice();
    for (let i = 0; i < faces.length; i++) {
      if (noise(seed, i, 31) > .12) continue;
      const { a, b, c } = faces[i];
      const center = a.map((v, axis) => (v + b[axis] + c[axis]) / 3);
      const points = [a, b, c].map((v) => v.map((n, axis) => center[axis] + (n - center[axis]) * .55 + (axis === 2 ? .001 : 0)));
      triangle(mesh, ...points, [48, 47, 48]);
    }
  }
  return mesh;
}

// Camera-space vertices are [horizontal, vertical, forward]. Clip before
// perspective division: clamping projected vertices creates stretched strips.
export function clipOutdoorPolygon(vertices, near = OUTDOOR_NEAR_PLANE) {
  const result = [];
  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i], previous = vertices[(i + vertices.length - 1) % vertices.length];
    const currentInside = current[2] >= near, previousInside = previous[2] >= near;
    if (currentInside !== previousInside) {
      const t = (near - previous[2]) / (current[2] - previous[2]);
      result.push([previous[0] + (current[0] - previous[0]) * t, previous[1] + (current[1] - previous[1]) * t, near]);
    }
    if (currentInside) result.push(current);
  }
  return result;
}

export function createOutdoorRaster(width, height) {
  return { width, height, pixels: new Uint8ClampedArray(width * height * 4), depth: new Float32Array(width * height).fill(Infinity) };
}

export function rasterOutdoorTriangle(target, a, b, c, color) {
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (!Number.isFinite(area) || Math.abs(area) < .00001) return;
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), maxX = Math.min(target.width - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), maxY = Math.min(target.height - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const invArea = 1 / area;
  const waX = (b[1] - c[1]) * invArea, waY = (c[0] - b[0]) * invArea;
  const wbX = (c[1] - a[1]) * invArea, wbY = (a[0] - c[0]) * invArea;
  const wa0 = ((b[0] - minX - .5) * (c[1] - minY - .5) - (b[1] - minY - .5) * (c[0] - minX - .5)) * invArea;
  const wb0 = ((c[0] - minX - .5) * (a[1] - minY - .5) - (c[1] - minY - .5) * (a[0] - minX - .5)) * invArea;
  const ia = 1 / a[2], ib = 1 / b[2], ic = 1 / c[2];
  for (let y = minY; y <= maxY; y++) {
    let wa = wa0 + (y - minY) * waY, wb = wb0 + (y - minY) * wbY;
    for (let x = minX; x <= maxX; x++, wa += waX, wb += wbX) {
      const wc = 1 - wa - wb;
      if (wa < -.000001 || wb < -.000001 || wc < -.000001) continue;
      const depth = 1 / (wa * ia + wb * ib + wc * ic), index = y * target.width + x;
      if (depth >= target.depth[index]) continue;
      target.depth[index] = depth;
      const pixel = index * 4;
      target.pixels[pixel] = color[0]; target.pixels[pixel + 1] = color[1]; target.pixels[pixel + 2] = color[2]; target.pixels[pixel + 3] = 255;
    }
  }
}

export function renderOutdoorMeshes(target, meshes, camera, options) {
  target.pixels.fill(0); target.depth.fill(Infinity);
  const { plane, horizon, maxDistance = 24, theme = "jungle" } = options;
  const cos = Math.cos(camera.facing), sin = Math.sin(camera.facing);
  const toCamera = (v) => {
    const dx = v[0] - camera.x, dy = v[1] - camera.y;
    return [-dx * sin + dy * cos, v[2] - .5, dx * cos + dy * sin];
  };
  for (const mesh of meshes) {
    const dx = mesh.x - camera.x, dy = mesh.y - camera.y;
    const distance = Math.hypot(dx, dy), forward = dx * cos + dy * sin, side = -dx * sin + dy * cos;
    if (distance > maxDistance || forward < -mesh.radius || Math.abs(side) - mesh.radius > (forward + mesh.radius) * target.width / (2 * plane)) continue;
    const fog = Math.min(.68, Math.max(0, distance - 4) / maxDistance);
    const fogColor = theme === "space" ? [3, 6, 15] : [35, 58, 35];
    for (const face of mesh.triangles) {
      const polygon = clipOutdoorPolygon([toCamera(face.a), toCamera(face.b), toCamera(face.c)]);
      if (polygon.length < 3) continue;
      const projected = polygon.map((v) => [target.width / 2 + v[0] * plane / v[2], horizon - v[1] * plane / v[2], v[2]]);
      const color = face.color.map((v, i) => v * (1 - fog) + fogColor[i] * fog);
      for (let i = 1; i < projected.length - 1; i++) rasterOutdoorTriangle(target, projected[0], projected[i], projected[i + 1], color);
    }
  }
  return target;
}

let surface;
let renderedWorld;

export function hasOutdoorDepth(world) {
  return renderedWorld === world && !world.labyrinthMode && ["jungle", "space"].includes(world.level.themeKey);
}

export function clipOutdoorSprite(ctx, world, projection) {
  if (!hasOutdoorDepth(world)) return false;
  // Keep each part of an enemy or pickup behind the actual visible geometry,
  // instead of hiding a full screen column because its ray touched a wall tile.
  const scale = 2;
  const halfWidth = Math.max(90, projection.scale * 1.5);
  const from = Math.max(0, Math.floor((projection.screenX - halfWidth) / scale));
  const to = Math.min(surface.width, Math.ceil((projection.screenX + halfWidth) / scale));
  ctx.beginPath();
  for (let y = 0; y < surface.height; y++) {
    let start = -1;
    for (let x = from; x <= to; x++) {
      const visible = x < to && projection.depth <= surface.depth[y * surface.width + x] + .015;
      if (visible && start < 0) start = x;
      else if (!visible && start >= 0) { ctx.rect(start * scale, y * scale, (x - start) * scale, scale); start = -1; }
    }
  }
  ctx.clip();
  return true;
}

export function drawOutdoorMeshScene(ctx, world, meshes, options) {
  const scale = 2, width = Math.ceil(options.width / scale), height = Math.ceil(options.height / scale);
  if (!surface || surface.width !== width || surface.height !== height) {
    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : Object.assign(document.createElement("canvas"), { width, height });
    const context = canvas.getContext("2d");
    surface = { ...createOutdoorRaster(width, height), canvas, context, image: context.createImageData(width, height) };
  }
  renderOutdoorMeshes(surface, meshes, world.player, { plane: options.plane / scale, horizon: options.horizon / scale, theme: world.level.themeKey });
  renderedWorld = world;
  surface.image.data.set(surface.pixels); surface.context.putImageData(surface.image, 0, 0);
  ctx.save(); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(surface.canvas, 0, 0, options.width, options.height); ctx.restore();
}
