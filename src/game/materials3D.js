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
  const base = { space: [44, 52, 66], jungle: [42, 60, 31], city: [58, 63, 67], medieval: [76, 71, 61] }[key] || [30, 35, 42];
  const floorImage = f.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const grain = (noise(x, y) - .5) * 17;
    const rock = key === "space" ? Math.sin(x * .11 + Math.sin(y * .08) * 3) * 6 + Math.sin(y * .15 + x * .04) * 5 : 0;
    const i = (y * 128 + x) * 4;
    for (let channel = 0; channel < 3; channel++) floorImage.data[i + channel] = base[channel] + grain + rock;
    floorImage.data[i + 3] = 255;
  }
  f.putImageData(floorImage, 0, 0);
  if (key === "medieval") paintFlagstones(f);
  if (key === "space") {
    for (let i = 0; i < 11; i++) {
      const x = noise(i, 12) * 128, y = noise(i, 13) * 128, radius = 3 + noise(i, 14) * 7;
      f.fillStyle = "#121b2b85"; f.beginPath(); f.ellipse(x, y, radius, radius * .7, noise(i, 9), 0, TAU); f.fill();
      f.strokeStyle = "#72839a60"; f.lineWidth = 1; f.beginPath(); f.ellipse(x, y, radius + 1, radius * .7 + 1, noise(i, 9), .2, 2.5); f.stroke();
    }
    f.strokeStyle = "#111c2c"; f.lineWidth = 1;
    f.beginPath(); f.moveTo(0, 43); f.lineTo(24, 51); f.lineTo(43, 46); f.lineTo(61, 66); f.lineTo(90, 70); f.lineTo(128, 86); f.stroke();
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
    c.fillStyle = "#334151"; c.fillRect(0, 0, 128, 192);
    for (let i = 0; i < 37; i++) {
      const x = noise(i, 21) * 128, y = noise(i, 22) * 192, radius = 9 + noise(i, 23) * 26;
      c.fillStyle = ["#293642", "#435362", "#536374", "#344250", "#24333f"][i % 5];
      c.strokeStyle = "#192734"; c.lineWidth = 1.2; c.beginPath();
      for (let corner = 0; corner < 6; corner++) {
        const angle = corner / 6 * TAU, r = radius * (.65 + noise(i, corner, 24) * .5);
        const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
        if (corner) c.lineTo(px, py); else c.moveTo(px, py);
      }
      c.closePath(); c.fill(); c.stroke();
    }
    c.strokeStyle = "#81c1d375"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(31, 192); c.lineTo(42, 136); c.lineTo(63, 118); c.lineTo(55, 74); c.lineTo(72, 32); c.stroke();
    c.strokeStyle = "#152330"; c.lineWidth = 2; c.beginPath(); c.moveTo(92, 0); c.lineTo(77, 57); c.lineTo(96, 95); c.lineTo(82, 139); c.lineTo(95, 192); c.stroke();
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

export function draw3DSky(ctx, world, width, horizon) {
  if (world.labyrinthMode) return;
  const key = world.level.themeKey;
  ctx.save(); ctx.globalAlpha = 1;
  if (key === "space") {
    const sky = ctx.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, "#01030b"); sky.addColorStop(1, "#10152c");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, horizon);
    // Spherical directions keep stars fixed in the sky as the player turns.
    for (let i = 0; i < 180; i++) {
      let angle = noise(i, 61) * TAU - world.player.facing; angle = Math.atan2(Math.sin(angle), Math.cos(angle));
      if (Math.abs(angle) > .7) continue;
      const x = width / 2 + Math.tan(angle) * width * .74, y = noise(i, 62) * horizon * .96;
      ctx.globalAlpha = .35 + noise(i, 63) * .6; ctx.fillStyle = i % 6 ? "#d4e0ef" : "#8bb3df"; ctx.fillRect(x, y, i % 11 ? 1 : 2, i % 11 ? 1 : 2);
    }
    let moonAngle = .28 - world.player.facing; moonAngle = Math.atan2(Math.sin(moonAngle), Math.cos(moonAngle));
    if (Math.abs(moonAngle) < 1) {
      const x = width / 2 + Math.tan(moonAngle) * width * .74, y = horizon * .3, radius = horizon * .19;
      const moon = ctx.createRadialGradient(x - radius * .4, y - radius * .4, 1, x, y, radius); moon.addColorStop(0, "#63708b"); moon.addColorStop(.6, "#33425e"); moon.addColorStop(1, "#10172c");
      ctx.globalAlpha = 1; ctx.fillStyle = moon; ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#6c8baf80"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, radius + 1, 3.3, 5.8); ctx.stroke();
    }
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
  const w = Math.ceil(width / 3), h = Math.ceil((height - horizon) / 3);
  if (!floorSurface || floorSurface.width !== w || floorSurface.height !== h) {
    const surface = canvas(w, h); if (!surface) return;
    const context = surface.getContext("2d"); floorSurface = { width: w, height: h, surface, context, image: context.createImageData(w, h) };
  }
  const { image, context, surface } = floorSurface;
  const forwardX = Math.cos(world.player.facing), forwardY = Math.sin(world.player.facing);
  const src = material.floor, dst = image.data, frequency = key === "medieval" ? 20 : 32;
  for (let row = 0; row < h; row++) {
    const depth = plane * .5 / (row * 3 + 1.5), shade = Math.max(key === "space" ? .25 : .18, 1 - depth / (maxDistance * 1.3));
    const sideStart = -width / 2 / plane * depth, sideStep = 3 / plane * depth;
    let wx = world.player.x + forwardX * depth - forwardY * sideStart, wy = world.player.y + forwardY * depth + forwardX * sideStart;
    for (let col = 0; col < w; col++) {
      const tx = Math.floor(wx * frequency) & 127, ty = Math.floor(wy * frequency) & 127;
      const from = (ty * 128 + tx) * 4, to = (row * w + col) * 4;
      const inWorld = wx >= 0 && wy >= 0 && wx < world.width && wy < world.height, voidSpace = key === "space" && (!inWorld || depth > maxDistance);
      dst[to] = voidSpace ? 3 : src[from] * shade; dst[to + 1] = voidSpace ? 6 : src[from + 1] * shade; dst[to + 2] = voidSpace ? 16 : src[from + 2] * shade; dst[to + 3] = 255;
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
