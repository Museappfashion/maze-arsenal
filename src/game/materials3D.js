import { orbitalPlatformSample } from "./outdoorScenes3D.js";
import { createOutdoorMesh, createOutdoorRaster, renderOutdoorMeshes } from "./outdoorGeometry3D.js";
// Cached, world-anchored outdoor materials. These never affect maze collision.
const cache = new Map();
let floorSurface = null;
const TAU = Math.PI * 2;
const noise = (x, y, salt = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 37.7) * 43758.5453;
  return n - Math.floor(n);
};
function canvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = width; c.height = height; return c;
}

export function get3DWallHeight(world, hit) {
  if (world.labyrinthMode) return 1;
  if (world.level.themeKey === "city") {
    // One footprint retains its roofline across both faces and adjacent tiles.
    const bx = Math.floor(hit.mapX / 5), by = Math.floor(hit.mapY / 5);
    return [2.8, 4.1, 5.8, 7.6, 9.2][Math.floor(noise(bx, by, 31) * 5)];
  }
  if (world.level.themeKey === "jungle") return 2.15 + noise(Math.floor(hit.mapX / 3), Math.floor(hit.mapY / 3), 41) * .55;
  if (world.level.themeKey === "space") return 1.1 + noise(hit.mapX, hit.mapY, 16) * .65;
  return 1;
}

export function project3DWall(plane, horizon, distance, wallHeight = 1) {
  const scale = plane / Math.max(.08, distance);
  // Feet stay on the existing floor plane; additional height extends upward.
  return { top: horizon - scale * (wallHeight - .5), bottom: horizon + scale * .5, height: scale * wallHeight, scale };
}

function paintFlagstones(f) {
  const points = [];
  // A periodic jittered tessellation makes large irregular slabs without a grid.
  for (let y = -1; y <= 3; y++) for (let x = -1; x <= 3; x++) {
    const ix = (x + 3) % 3, iy = (y + 3) % 3;
    points.push({ x: (x + .18 + noise(ix, iy, 6) * .62) * 128 / 3, y: (y + .18 + noise(ix, iy, 7) * .62) * 128 / 3, shade: noise(ix, iy, 8) });
  }
  const image = f.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    let first = Infinity, second = Infinity, slab = points[0];
    for (const point of points) {
      const d = Math.hypot(x - point.x, y - point.y);
      if (d < first) { second = first; first = d; slab = point; } else if (d < second) second = d;
    }
    const seam = second - first < 1.45, rim = second - first < 3;
    const grain = (noise(x, y, 19) - .5) * 13;
    const value = seam ? 36 + grain : 76 + slab.shade * 23 + grain + (rim ? 8 : 0);
    const i = (y * 128 + x) * 4;
    image.data[i] = value + 4; image.data[i + 1] = value; image.data[i + 2] = value - 7; image.data[i + 3] = 255;
  }
  f.putImageData(image, 0, 0);
  f.strokeStyle = "#24252265"; f.lineWidth = .65;
  for (let i = 0; i < 8; i++) {
    const x = noise(i, 8) * 128, y = noise(i, 9) * 128;
    f.beginPath(); f.moveTo(x, y); f.lineTo(x + 4, y + 3); f.lineTo(x + 6, y + 10); f.stroke();
  }
}

function materials(key) {
  if (cache.has(key)) return cache.get(key);
  const floor = canvas(128, 128), wall = canvas(128, key === "city" ? 1024 : 192);
  if (!floor || !wall) return null;
  const f = floor.getContext("2d"), c = wall.getContext("2d");
  const base = { space: [25, 30, 45], jungle: [42, 60, 31], city: [58, 63, 67], medieval: [76, 71, 61] }[key] || [30, 35, 42];
  const floorImage = f.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const grain = (noise(x, y) - .5) * 17;
    const rock = 0;
    const i = (y * 128 + x) * 4;
    for (let channel = 0; channel < 3; channel++) floorImage.data[i + channel] = base[channel] + grain + rock;
    floorImage.data[i + 3] = 255;
  }
  f.putImageData(floorImage, 0, 0);
  if (key === "medieval") paintFlagstones(f);
  if (key === "space") {
    // A faint continuous gravity field gives navigation a readable floor while
    // leaving the stars and distant nebula visible under every footstep.
    f.fillStyle = "#22394c"; f.fillRect(0, 0, 128, 128);
    f.strokeStyle = "#607d9022"; f.lineWidth = .6;
    for (let i = 0; i < 6; i++) {
      const x = noise(i, 71) * 128, y = noise(i, 72) * 128;
      f.beginPath(); f.ellipse(x, y, 5 + noise(i, 73) * 12, 2, -.3, 0, TAU); f.stroke();
    }
  } else if (key === "jungle") {
    for (let i = 0; i < 72; i++) {
      f.fillStyle = ["#6a743e", "#1c4925", "#53602d", "#705836"][i % 4];
      f.beginPath(); f.ellipse(noise(i, 1) * 128, noise(i, 2) * 128, 1 + noise(i, 3) * 3, .8, noise(i, 4) * TAU, 0, TAU); f.fill();
    }
    f.strokeStyle = "#22351b"; f.lineWidth = 2; f.beginPath(); f.moveTo(0, 83); f.bezierCurveTo(43, 68, 62, 111, 128, 94); f.stroke();
  } else if (key === "city") {
    f.strokeStyle = "#252a2f"; f.lineWidth = 1; f.beginPath(); f.moveTo(5, 11); f.lineTo(13, 19); f.lineTo(10, 27); f.lineTo(32, 47); f.lineTo(35, 66); f.stroke();
  }

  if (key === "space") {
    c.fillStyle = "#3b334f"; c.fillRect(0, 0, 128, 192);
    c.fillStyle = "#514361"; c.beginPath(); c.moveTo(7, 0); c.lineTo(50, 8); c.lineTo(43, 112); c.lineTo(15, 165); c.closePath(); c.fill();
    c.fillStyle = "#29263d"; c.beginPath(); c.moveTo(92, 0); c.lineTo(74, 79); c.lineTo(101, 119); c.lineTo(80, 192); c.lineTo(128, 192); c.lineTo(128, 0); c.fill();
    c.strokeStyle = "#a6cee0"; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(39, 57); c.lineTo(88, 57); c.lineTo(88, 100); c.lineTo(54, 100); c.lineTo(54, 72); c.lineTo(72, 72); c.lineTo(72, 88); c.stroke();
    c.strokeStyle = "#151526"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(12, 0); c.lineTo(24, 36); c.lineTo(17, 66); c.lineTo(43, 116); c.lineTo(38, 192); c.stroke();
  } else if (key === "jungle") {
    c.fillStyle = "#14351f"; c.fillRect(0, 0, 128, 192);
    for (let i = 0; i < 5; i++) {
      const x = i * 31 - 6, width = 12 + noise(i, 11) * 11;
      c.fillStyle = ["#514631", "#403c26", "#655239"][i % 3];
      c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 7, 55, x - 8, 124, x - 14, 192); c.lineTo(x + width + 18, 192); c.bezierCurveTo(x + width - 4, 130, x + width + 9, 51, x + width, 0); c.closePath(); c.fill();
      c.strokeStyle = "#2d2e20"; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 5, 0); c.bezierCurveTo(x + 13, 73, x - 2, 147, x - 7, 192); c.stroke();
    }
    for (let i = 0; i < 220; i++) {
      const y = noise(i, 33) * 192, x = noise(i, 32) * 128;
      if (y > 70 && y < 160 && noise(i, 34) < .48) continue;
      c.fillStyle = ["#24572b", "#366b31", "#497a35", "#1c4827", "#5b843b"][i % 5];
      c.beginPath(); c.ellipse(x, y, 3 + noise(i, 35) * 7, 1.8 + noise(i, 36) * 3.5, noise(i, 37) * TAU, 0, TAU); c.fill();
    }
    c.strokeStyle = "#83934b"; c.lineWidth = 2; c.beginPath(); c.moveTo(105, 0); c.bezierCurveTo(87, 54, 118, 105, 101, 173); c.stroke();
  } else if (key === "city") {
    c.fillStyle = "#6c747b"; c.fillRect(0, 0, 128, 1024);
    c.fillStyle = "#a1a8ad"; c.fillRect(0, 0, 4, 1024); c.fillRect(124, 0, 4, 1024);
    for (let row = 0; row < 31; row++) {
      const y = row * 32; c.fillStyle = "#343e46"; c.fillRect(4, y + 28, 120, 4);
      for (let col = 0; col < 4; col++) {
        const x = 8 + col * 29;
        c.fillStyle = "#a4acb2"; c.fillRect(x, y + 4, 23, 23);
        c.fillStyle = noise(col, row, 51) > .89 ? "#727767" : noise(col, row, 52) > .55 ? "#233b4b" : "#152630"; c.fillRect(x + 2, y + 6, 19, 19);
        c.fillStyle = "#768a965c"; c.fillRect(x + 3, y + 7, 2, 16);
      }
    }
    c.fillStyle = "#354049"; c.fillRect(0, 992, 128, 32); c.fillStyle = "#76818a"; c.fillRect(0, 992, 128, 3);
    c.fillStyle = "#12212a"; c.fillRect(46, 998, 35, 26);
  } else {
    c.fillStyle = "#504b43"; c.fillRect(0, 0, 128, 192);
    for (let row = 0; row < 8; row++) for (let col = -1; col < 4; col++) {
      const x = col * 42 + (row % 2) * 21, y = row * 24;
      c.fillStyle = noise(col, row, 9) > .5 ? "#82796d" : "#6a635a"; c.fillRect(x + 1, y + 1, 40, 22);
      c.fillStyle = "#c7bca632"; c.fillRect(x + 2, y + 2, 38, 1); c.fillStyle = "#171c2540"; c.fillRect(x + 2, y + 20, 38, 3);
    }
  }
  const result = { floor: f.getImageData(0, 0, 128, 128).data, wall };
  cache.set(key, result); return result;
}

const orbitalBeltCache = new WeakMap();
function orbitalBelt(world) {
  let belt = orbitalBeltCache.get(world);
  if (belt) return belt;
  belt = [];
  const mapWidth = world.width || world.grid?.[0]?.length || 60, mapHeight = world.height || world.grid?.length || 60;
  for (let y = -24; y <= mapHeight + 24; y += 7) for (let x = -24; x <= mapWidth + 24; x += 7) {
    const rock = createOutdoorMesh("space", x, y);
    const scale = .45 + noise(x, y, 93) * 1.25, z = -3.5 - noise(x, y, 94) * 7;
    const dx = (noise(x, y, 95) - .5) * 5, dy = (noise(x, y, 96) - .5) * 5;
    const vertex = (v) => [rock.x + dx + (v[0] - rock.x) * scale, rock.y + dy + (v[1] - rock.y) * scale, z + v[2] * scale];
    belt.push({ x: rock.x + dx, y: rock.y + dy, radius: scale, triangles: rock.triangles.map(({ a, b, c, color }) => ({ a: vertex(a), b: vertex(b), c: vertex(c), color })) });
  }
  orbitalBeltCache.set(world, belt); return belt;
}

let orbitalBeltSurface;
function drawOrbitalBelt(ctx, belt, camera, plane, width, height, horizon) {
  // The deep belt uses its own small raster; it never replaces the depth map
  // of the playable scene. Perspective and near clipping share the same code.
  const scale = 3, w = Math.ceil(width / scale), h = Math.ceil(height / scale);
  if (!orbitalBeltSurface || orbitalBeltSurface.width !== w || orbitalBeltSurface.height !== h) {
    const surface = canvas(w, h); if (!surface) return;
    const context = surface.getContext("2d");
    orbitalBeltSurface = { ...createOutdoorRaster(w, h), surface, context, image: context.createImageData(w, h) };
  }
  const target = orbitalBeltSurface;
  renderOutdoorMeshes(target, belt, camera, { plane: plane / scale, horizon: horizon / scale, maxDistance: 48, theme: "space" });
  target.image.data.set(target.pixels); target.context.putImageData(target.image, 0, 0);
  ctx.imageSmoothingEnabled = false; ctx.globalAlpha = .65; ctx.drawImage(target.surface, 0, 0, width, height); ctx.globalAlpha = 1;
}

export function draw3DSky(ctx, world, width, horizon, height = horizon) {
  if (world.labyrinthMode) return;
  const key = world.level.themeKey;
  ctx.save(); ctx.globalAlpha = 1;
  if (key === "space") {
    ctx.fillStyle = "#02040d"; ctx.fillRect(0, 0, width, height);
    // Distant clouds have fixed positions in the world. Moving changes their
    // parallax as well as their bearing; they never turn into a horizon or moon.
    const plane = width * .74, cos = Math.cos(world.player.facing), sin = Math.sin(world.player.facing);
    const cloudSpacing = 44;
    const centerX = Math.floor(world.player.x / cloudSpacing), centerY = Math.floor(world.player.y / cloudSpacing);
    for (let cy = centerY - 2; cy <= centerY + 2; cy++) for (let cx = centerX - 2; cx <= centerX + 2; cx++) {
      const wx = cx * cloudSpacing + 17, wy = cy * cloudSpacing + 23;
      const dx = wx - world.player.x, dy = wy - world.player.y;
      const depth = dx * cos + dy * sin, side = -dx * sin + dy * cos;
      if (depth < 8 || depth > 110 || Math.abs(side) > depth * 1.4) continue;
      const x = width / 2 + side * plane / depth, y = horizon + 11 * plane / depth;
      const radius = 24 * plane / depth;
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius);
      cloud.addColorStop(0, "#4d326b"); cloud.addColorStop(.27, "#2b345e"); cloud.addColorStop(.65, "#172c493b"); cloud.addColorStop(1, "#02040d00");
      ctx.fillStyle = cloud; ctx.fillRect(0, 0, width, height);
    }
    for (let i = 0; i < 900; i++) {
      let angle = noise(i, 61) * TAU - world.player.facing; angle = Math.atan2(Math.sin(angle), Math.cos(angle));
      if (Math.abs(angle) > .8) continue;
      const x = width / 2 + Math.tan(angle) * width * .74, y = noise(i, 62) * height;
      ctx.globalAlpha = .4 + noise(i, 63) * .6; ctx.fillStyle = i % 6 ? "#d4e0ef" : "#8bb3df"; ctx.fillRect(x, y, i % 11 ? 1 : 2, i % 11 ? 1 : 2);
    }
    // A loose belt hangs several metres BELOW the traversable field. Each
    // faceted body is projected from fixed world vertices, so walking and
    // turning reveal different sides without screen-facing scenery strips.
    const belt = orbitalBelt(world);
    drawOrbitalBelt(ctx, belt, world.player, plane, width, height, horizon);
  } else if (key === "city") {
    const sky = ctx.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, "#242a31"); sky.addColorStop(1, "#67717a"); ctx.fillStyle = sky; ctx.fillRect(0, 0, width, horizon);
  } else if (key === "jungle") {
    const sky = ctx.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, "#0d2418"); sky.addColorStop(1, "#53704b"); ctx.fillStyle = sky; ctx.fillRect(0, 0, width, horizon);
  }
  ctx.restore();
}

export function drawPerspectiveFloor(ctx, world, plane, width, height, horizon, maxDistance) {
  if (world.labyrinthMode) return;
  const key = world.level.themeKey, material = materials(key); if (!material) return;
  const resolution = key === "space" ? 2 : 3;
  const w = Math.ceil(width / resolution), h = Math.ceil((height - horizon) / resolution);
  if (!floorSurface || floorSurface.width !== w || floorSurface.height !== h) {
    const surface = canvas(w, h); if (!surface) return;
    const context = surface.getContext("2d"); floorSurface = { width: w, height: h, surface, context, image: context.createImageData(w, h) };
  }
  const { image, context, surface } = floorSurface;
  const forwardX = Math.cos(world.player.facing), forwardY = Math.sin(world.player.facing);
  const src = material.floor, dst = image.data, frequency = key === "medieval" ? 20 : 32;
  for (let row = 0; row < h; row++) {
    const depth = plane * .5 / (row * resolution + resolution / 2), shade = Math.max(key === "space" ? .25 : .18, 1 - depth / (maxDistance * 1.3));
    const sideStart = (-width / 2 + resolution / 2) / plane * depth, sideStep = resolution / plane * depth;
    let wx = world.player.x + forwardX * depth - forwardY * sideStart, wy = world.player.y + forwardY * depth + forwardX * sideStart;
    for (let col = 0; col < w; col++) {
      const tx = Math.floor(wx * frequency) & 127, ty = Math.floor(wy * frequency) & 127;
      const from = (ty * 128 + tx) * 4, to = (row * w + col) * 4;
      const platform = key === "space" && depth <= maxDistance ? orbitalPlatformSample(world, wx, wy) : key === "space" ? 0 : 1;
      const bevel = key === "space" && platform === 2 ? 2.1 : 1;
      dst[to] = src[from] * shade * bevel; dst[to + 1] = src[from + 1] * shade * bevel; dst[to + 2] = src[from + 2] * shade * bevel;
      if (key === "jungle") {
        const fog = Math.min(1, Math.max(0, depth - 6) / maxDistance);
        dst[to] = dst[to] * (1 - fog) + 35 * fog;
        dst[to + 1] = dst[to + 1] * (1 - fog) + 58 * fog;
        dst[to + 2] = dst[to + 2] * (1 - fog) + 35 * fog;
      }
      dst[to + 3] = key === "space" ? (platform === 2 ? 135 : platform ? 58 : 0) : platform ? 255 : 0;
      wx -= forwardY * sideStep; wy += forwardX * sideStep;
    }
  }
  context.putImageData(image, 0, 0);
  ctx.save(); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false; ctx.drawImage(surface, 0, horizon, width, height - horizon); ctx.restore();
}

export function drawWallMaterial(ctx, world, hit, x, top, width, height, brightness, wallHeight = 1) {
  const material = materials(world.level.themeKey); if (!material || hit.wallType == null) return;
  const u = Math.min(127, Math.floor(hit.wallOffset * 128));
  const sourceHeight = world.level.themeKey === "city" ? Math.min(1024, Math.round(wallHeight * 96)) : 192, sourceTop = world.level.themeKey === "city" ? 1024 - sourceHeight : 0;
  ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = "#10171d"; ctx.fillRect(x, top, width, height);
  ctx.globalAlpha = Math.min(1, Math.max(.16, brightness)); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(material.wall, u, sourceTop, 1, sourceHeight, x, top, width, height);
  if (world.level.themeKey === "city") {
    ctx.globalAlpha = Math.min(1, brightness * .85); ctx.fillStyle = "#b0b6ba"; ctx.fillRect(x, top, width, Math.max(1, height / wallHeight * .045));
  }
  ctx.restore();
}
