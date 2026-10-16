// Procedural materials keep the existing palettes and raycast geometry.
const cache = new Map();
let floorSurface = null;
const noise = (x, y, salt = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 37.7) * 43758.5453;
  return n - Math.floor(n);
};
function canvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = width; c.height = height; return c;
}
function materials(key) {
  if (cache.has(key)) return cache.get(key);
  const floor = canvas(64, 64), wall = canvas(64, 96);
  if (!floor || !wall) return null;
  const f = floor.getContext("2d"), c = wall.getContext("2d");
  const palette = {
    space: ["#0b1c2c", "#14283a", "#294458", "#132b40"],
    jungle: ["#28492a", "#345a30", "#526343", "#293d2c"],
    medieval: ["#49403a", "#574a3e", "#8a8071", "#504b43"],
    city: ["#393e42", "#42484c", "#899098", "#59616b"],
  }[key] || ["#171c22", "#242a31", "#454e58", "#242a31"];
  f.fillStyle = palette[0]; f.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const n = noise(x, y); f.fillStyle = n > .5 ? `rgba(220,220,195,${(n - .5) * .12})` : `rgba(0,0,0,${(.5 - n) * .17})`; f.fillRect(x, y, 1, 1);
  }
  f.strokeStyle = palette[1]; f.lineWidth = 1;
  if (key !== "city") {
    for (const y of [0, 32, 63]) { f.beginPath(); f.moveTo(0, y); f.lineTo(64, y); f.stroke(); }
    for (let row = 0; row < 2; row++) { const x = row % 2 ? 32 : 0; f.beginPath(); f.moveTo(x, row * 32); f.lineTo(x, (row + 1) * 32); f.stroke(); }
  }
  if (key === "space") {
    f.strokeStyle = "#497586"; f.strokeRect(3.5, 3.5, 57, 57);
    f.fillStyle = "#41a2b8"; f.fillRect(7, 7, 9, 1); f.fillRect(48, 56, 9, 1);
  } else if (key === "jungle") {
    for (let i = 0; i < 17; i++) { f.fillStyle = i % 2 ? "#53703b" : "#725d36"; f.fillRect(noise(i, 4) * 62, noise(i, 8) * 62, 2, 1); }
  } else if (key === "city") {
    f.strokeStyle = "#262b30"; f.beginPath(); f.moveTo(5, 11); f.lineTo(13, 19); f.lineTo(10, 27); f.lineTo(22, 37); f.stroke();
  }
  c.fillStyle = palette[3]; c.fillRect(0, 0, 64, 96);
  if (key === "space") {
    c.fillStyle = palette[2]; c.fillRect(3, 3, 58, 90);
    c.strokeStyle = "#0a1b29"; c.lineWidth = 2; c.strokeRect(6, 6, 52, 84);
    c.fillStyle = "#70c8d6"; c.fillRect(30, 8, 3, 72);
    c.fillStyle = "#071724"; c.fillRect(12, 15, 11, 23);
    for (let y = 18; y < 35; y += 4) { c.fillStyle = "#54717e"; c.fillRect(14, y, 7, 1); }
    for (const x of [8, 55]) for (const y of [8, 87]) { c.fillStyle = "#9aaab3"; c.fillRect(x, y, 2, 2); }
    c.fillStyle = "#778b94"; c.fillRect(8, 84, 48, 3);
  } else if (key === "city") {
    c.fillStyle = palette[2]; c.fillRect(2, 0, 60, 96);
    c.fillStyle = "#c0c5c9"; c.fillRect(0, 0, 3, 96);
    for (const y of [8, 42]) {
      const glass = c.createLinearGradient(0, y, 0, y + 23); glass.addColorStop(0, "#263c4b"); glass.addColorStop(1, "#101e2a");
      c.fillStyle = "#c2c7c9"; c.fillRect(10, y, 45, 26);
      c.fillStyle = glass; c.fillRect(12, y + 2, 41, 22);
      c.fillStyle = "#647582"; c.fillRect(31, y + 2, 2, 22);
      c.strokeStyle = "#a3bbc84f"; c.beginPath(); c.moveTo(15, y + 19); c.lineTo(27, y + 4); c.stroke();
      c.fillStyle = "#4a5159"; c.fillRect(8, y + 26, 49, 3);
    }
    c.fillStyle = "#39424a"; c.fillRect(0, 79, 64, 17);
    c.fillStyle = "#69737a"; c.fillRect(0, 79, 64, 2);
    c.strokeStyle = "#6d777f"; c.lineWidth = .6;
    for (const y of [36, 75]) { c.beginPath(); c.moveTo(3, y); c.lineTo(64, y); c.stroke(); }
  } else {
    for (let row = 0; row < 6; row++) for (let col = -1; col < 3; col++) {
      const x = col * 32 + (row % 2) * 16, y = row * 16;
      const value = noise(col, row, key === "jungle" ? 7 : 9);
      c.fillStyle = key === "jungle" ? value > .5 ? "#60754b" : "#4f6441" : value > .5 ? "#92887b" : "#776f66";
      c.fillRect(x + 1, y + 1, 30, 14);
      c.fillStyle = "#d3c7a82b"; c.fillRect(x + 2, y + 2, 28, 1);
      c.fillStyle = "#171c2538"; c.fillRect(x + 2, y + 13, 28, 2);
    }
    if (key === "jungle") {
      c.strokeStyle = "#263b1c"; c.lineWidth = 2; c.beginPath(); c.moveTo(9, 0); c.bezierCurveTo(28, 22, 5, 50, 21, 96); c.stroke();
      for (let i = 0; i < 13; i++) { c.fillStyle = "#94a94b"; c.beginPath(); c.ellipse(10 + noise(i, 3) * 12, i * 8, 3, 1.5, -.5, 0, Math.PI * 2); c.fill(); }
    }
  }
  const result = { floor: f.getImageData(0, 0, 64, 64).data, wall };
  cache.set(key, result); return result;
}

export function drawPerspectiveFloor(ctx, world, plane, width, height, horizon, maxDistance) {
  if (world.labyrinthMode) return;
  const material = materials(world.level.themeKey); if (!material) return;
  const w = Math.ceil(width / 3), h = Math.ceil((height - horizon) / 3);
  if (!floorSurface || floorSurface.width !== w || floorSurface.height !== h) {
    const surface = canvas(w, h); if (!surface) return;
    const context = surface.getContext("2d"); floorSurface = { width: w, height: h, surface, context, image: context.createImageData(w, h) };
  }
  const { image, context, surface } = floorSurface;
  const forwardX = Math.cos(world.player.facing), forwardY = Math.sin(world.player.facing);
  const src = material.floor, dst = image.data;
  for (let row = 0; row < h; row++) {
    const depth = plane * .5 / (row * 3 + 1.5);
    const shade = Math.max(.16, 1 - depth / (maxDistance * 1.3));
    const sideStart = -width / 2 / plane * depth, sideStep = 3 / plane * depth;
    let wx = world.player.x + forwardX * depth - forwardY * sideStart;
    let wy = world.player.y + forwardY * depth + forwardX * sideStart;
    for (let col = 0; col < w; col++) {
      const tx = Math.floor(wx * 32) & 63, ty = Math.floor(wy * 32) & 63;
      const from = (ty * 64 + tx) * 4, to = (row * w + col) * 4;
      dst[to] = src[from] * shade; dst[to + 1] = src[from + 1] * shade; dst[to + 2] = src[from + 2] * shade; dst[to + 3] = 255;
      wx -= forwardY * sideStep; wy += forwardX * sideStep;
    }
  }
  context.putImageData(image, 0, 0);
  ctx.save(); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(surface, 0, horizon, width, height - horizon); ctx.restore();
}

export function drawWallMaterial(ctx, world, hit, x, top, width, height, brightness) {
  const material = materials(world.level.themeKey); if (!material || hit.wallType == null) return;
  const u = Math.min(63, Math.floor(hit.wallOffset * 64));
  ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = "#131a20"; ctx.fillRect(x, top, width, height);
  ctx.globalAlpha = Math.min(1, Math.max(.12, brightness));
  ctx.imageSmoothingEnabled = false; ctx.drawImage(material.wall, u, 0, 1, 96, x, top, width, height);
  ctx.restore();
}
