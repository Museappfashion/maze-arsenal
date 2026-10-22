// Render trees as individual silhouettes, retaining the maze's solid barrier map.
const treeCache = new Map();
const boundaryCache = new WeakMap();
const noise = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };

function treeSprite(variant) {
  if (treeCache.has(variant)) return treeCache.get(variant);
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(160, 360) : Object.assign(document.createElement("canvas"), { width: 160, height: 360 });
  const c = canvas.getContext("2d");
  const bend = (variant - 3) * 2;
  // Broad buttress roots close the ground beneath each otherwise narrow trunk.
  c.fillStyle = "#333b22"; c.strokeStyle = "#132219"; c.lineWidth = 3;
  c.beginPath(); c.moveTo(65, 230); c.lineTo(91, 225); c.lineTo(103, 320); c.lineTo(151, 352); c.lineTo(104, 345); c.lineTo(78, 330); c.lineTo(29, 353); c.lineTo(9, 349); c.lineTo(58, 316); c.closePath(); c.fill(); c.stroke();
  const bark = c.createLinearGradient(58, 0, 103, 0); bark.addColorStop(0, "#322d20"); bark.addColorStop(.45, "#796143"); bark.addColorStop(1, "#403922");
  c.fillStyle = bark;
  c.beginPath(); c.moveTo(64, 335); c.bezierCurveTo(72 + bend, 240, 52, 133, 64 + bend, 83); c.lineTo(89 + bend, 78); c.bezierCurveTo(77, 180, 97, 270, 96, 335); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = "#302d1f"; c.lineWidth = 2;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(69 + i * 5, 320); c.bezierCurveTo(85 + i * 2, 220, 57 + i * 7, 166, 68 + i * 5, 99); c.stroke(); }
  c.strokeStyle = "#675235"; c.lineWidth = 10; c.lineCap = "round";
  c.beginPath(); c.moveTo(76, 170); c.lineTo(37, 125); c.moveTo(84, 142); c.lineTo(123, 89); c.stroke();
  // Irregular overlapping leaf clusters leave a recognisable canopy outline.
  for (let i = 0; i < 38; i++) {
    const x = 17 + noise(i, variant + 4) * 126;
    const y = 20 + noise(i, variant + 9) * 123;
    c.fillStyle = ["#183e22", "#24532a", "#326a31", "#437c37", "#53833c"][i % 5];
    c.beginPath(); c.ellipse(x, y, 13 + noise(i, 22) * 16, 11 + noise(i, 34) * 14, noise(i, 45), 0, Math.PI * 2); c.fill();
  }
  c.strokeStyle = "#91a958"; c.lineWidth = 2;
  c.beginPath(); c.moveTo(98, 101); c.bezierCurveTo(112, 169, 92, 207, 108, 270); c.stroke();
  treeCache.set(variant, canvas); return canvas;
}

function boundaryTrees(world) {
  const cached = boundaryCache.get(world);
  if (cached?.grid === world.grid) return cached.trees;
  const trees = [];
  for (let y = 0; y < world.height; y++) for (let x = 0; x < world.width; x++) {
    if (world.grid[y][x] === 0) continue;
    trees.push({ x: x + .5, y: y + .5, cell: y * world.width + x, variant: Math.floor(noise(x, y) * 8), height: 3.1 + noise(y, x) * .9 });
  }
  boundaryCache.set(world, { grid: world.grid, trees }); return trees;
}

export function drawJungleTrees3D(c, world, plane, width, horizon, rayWidth, zBuffer, wallCells) {
  if (world.labyrinthMode || world.level.themeKey !== "jungle") return;
  const forwardX = Math.cos(world.player.facing), forwardY = Math.sin(world.player.facing);
  const visible = [];
  for (const tree of boundaryTrees(world)) {
    const tx = Math.floor(tree.x), ty = Math.floor(tree.y);
    if (world.grid[ty]?.[tx] === 0 || ![[tx-1,ty],[tx+1,ty],[tx,ty-1],[tx,ty+1]].some(([x,y]) => world.grid[y]?.[x] === 0)) continue;
    const dx = tree.x - world.player.x, dy = tree.y - world.player.y;
    const depth = dx * forwardX + dy * forwardY;
    const side = -dx * forwardY + dy * forwardX;
    if (depth <= .1 || depth > 24 || Math.abs(side) > depth * width / plane + 2) continue;
    visible.push({ ...tree, depth, screenX: width / 2 + side / depth * plane });
  }
  visible.sort((a, b) => b.depth - a.depth);
  for (const tree of visible) {
    const scale = plane / tree.depth, w = scale * 1.5, h = scale * tree.height;
    const left = tree.screenX - w / 2, bottom = horizon + scale * .5;
    c.save(); c.beginPath();
    for (let ray = Math.max(0, Math.floor(left / rayWidth)); ray < Math.min(zBuffer.length, Math.ceil((left + w) / rayWidth)); ray++) {
      if (wallCells[ray] === tree.cell || tree.depth < zBuffer[ray] + .65) c.rect(ray * rayWidth, 0, rayWidth + .5, 10000);
    }
    c.clip(); c.globalAlpha = 1;
    c.drawImage(treeSprite(tree.variant), left, bottom - h, w, h);
    c.restore();
  }
}

// Ancient slabs and narrow luminous connections hang above the void.
export function orbitalPlatformSample(world, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (world.grid[ty]?.[tx] !== 0) return 0;
  const lx = ((x % 2) + 2) % 2, ly = ((y % 2) + 2) % 2;
  const edge = .15 + Math.sin(ly * 8 + Math.floor(x / 2)) * .025;
  if (lx > edge && lx < 2 - edge && ly > .15 && ly < 1.85) return Math.min(lx - edge, 2 - edge - lx, ly - .15, 1.85 - ly) < .07 ? 2 : 1;
  return Math.abs(lx - 1) < .13 || Math.abs(ly - 1) < .13 ? 3 : 0;
}
