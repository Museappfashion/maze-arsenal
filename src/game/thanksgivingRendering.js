import { FARM_POWER_SETTINGS } from '../config/thanksgiving.js';

const TAU = Math.PI * 2;
const POWER_COLORS = {
  speed: '#ffc54a',
  stun: '#b48b63',
  teleport: '#c5a1ff',
  decoy: '#ffab85',
  camouflage: '#a6d68c',
};
const POWER_LABELS = {
  speed: 'DASH',
  stun: 'MUD',
  teleport: 'WARP',
  decoy: 'GUST',
  camouflage: 'SLIP',
};
const landscapeCache = new WeakMap();

function cachedLandscape(world, tile) {
  const previous = landscapeCache.get(world);
  if (previous?.tile === tile && previous.grid === world.grid) return previous.canvas;
  const width = world.width * tile;
  const height = world.height * tile;
  // The landscape is immutable. Paint it once so mesh fences and crop rows do
  // not add thousands of drawing calls to every mobile animation frame.
  let canvas;
  if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(width, height);
  else if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
  } else return null;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const bounds = { minX: 0, minY: 0, maxX: world.width - 1, maxY: world.height - 1 };
  drawGround(context, world, bounds, tile);
  drawFences(context, world, bounds, tile);
  landscapeCache.set(world, { tile, grid: world.grid, canvas });
  return canvas;
}

function seed(x, y, offset = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + offset * 74.9) * 43758.5453;
  return n - Math.floor(n);
}

function ellipse(ctx, x, y, rx, ry, fill, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

function roundRect(ctx, x, y, width, height, radius, fill) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function isRoad(world, x, y) {
  return x >= 0 && y >= 0 && x < world.width && y < world.height && world.grid?.[y]?.[x] === 0;
}

function drawPumpkin(ctx, x, y, radius) {
  ellipse(ctx, x + 2, y + radius * .6, radius, radius * .55, '#453d2440');
  ellipse(ctx, x, y, radius, radius * .76, '#bb5c23');
  ellipse(ctx, x - radius * .34, y - 1, radius * .37, radius * .67, '#e48231');
  ellipse(ctx, x + radius * .3, y - 1, radius * .36, radius * .66, '#df7427');
  ctx.fillStyle = '#64633b';
  ctx.fillRect(x - 1, y - radius, 2, radius * .48);
}

function drawHay(ctx, x, y, size) {
  roundRect(ctx, x - size * .48 + 3, y - size * .35 + 4, size, size * .75, 3, '#413a283b');
  roundRect(ctx, x - size * .5, y - size * .4, size, size * .75, 3, '#d8ad57');
  ctx.strokeStyle = '#b48c43';
  ctx.lineWidth = 1;
  for (let n = 1; n < 5; n++) {
    ctx.beginPath();
    ctx.moveTo(x - size * .42, y - size * .4 + n * size * .12);
    ctx.lineTo(x + size * .42, y - size * .4 + n * size * .12);
    ctx.stroke();
  }
  ctx.fillStyle = '#8b693b';
  ctx.fillRect(x - size * .3, y - size * .4, 2, size * .75);
  ctx.fillRect(x + size * .22, y - size * .4, 2, size * .75);
}

function drawBarn(ctx, x, y, tile, variant) {
  const w = tile * 3.15;
  const h = tile * 2.35;
  ctx.fillStyle = '#3a322a32';
  ctx.fillRect(x - w / 2 + 8, y - h / 2 + 11, w + 2, h);
  ctx.fillStyle = variant ? '#9a614b' : '#aa5440';
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = '#c56a4c';
  ctx.fillRect(x - w / 2, y - h / 2, w, h * .36);
  ctx.strokeStyle = '#dfad7a66';
  ctx.lineWidth = 1;
  for (let n = 0; n < 9; n++) {
    const xx = x - w / 2 + n * w / 8;
    ctx.beginPath();
    ctx.moveTo(xx, y - h / 2);
    ctx.lineTo(xx, y + h / 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#d6c89b';
  ctx.fillRect(x - w / 2 - 3, y - h / 2 - 2, w + 6, 4);
  ctx.fillRect(x - w / 2 - 3, y + h / 2 - 3, w + 6, 4);
  ctx.fillStyle = '#644239';
  ctx.fillRect(x - tile * .6, y + h * .04, tile * 1.2, h * .46);
  ctx.strokeStyle = '#efdab4';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - tile * .6, y + h * .04, tile * 1.2, h * .46);
  ctx.beginPath();
  ctx.moveTo(x - tile * .6, y + h * .04);
  ctx.lineTo(x + tile * .6, y + h * .5);
  ctx.moveTo(x + tile * .6, y + h * .04);
  ctx.lineTo(x - tile * .6, y + h * .5);
  ctx.stroke();
  ctx.fillStyle = '#464d43';
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 5, y - h * .04);
  ctx.lineTo(x, y - h * .7);
  ctx.lineTo(x + w / 2 + 5, y - h * .04);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#78816a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 5, y - h * .04);
  ctx.lineTo(x, y - h * .7);
  ctx.lineTo(x + w / 2 + 5, y - h * .04);
  ctx.stroke();
  ellipse(ctx, x, y - h * .19, tile * .15, tile * .15, '#d6c89b');
  ellipse(ctx, x, y - h * .19, tile * .1, tile * .1, '#363e36');
}

function drawGround(ctx, world, bounds, tile) {
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const px = x * tile;
      const py = y * tile;
      const road = isRoad(world, x, y);
      if (road) {
        ctx.fillStyle = '#b69b70';
        ctx.fillRect(px, py, tile + .4, tile + .4);
        for (let n = 0; n < 5; n++) {
          const a = seed(x, y, n);
          const b = seed(y, x, n + 7);
          ctx.fillStyle = n % 2 ? '#ddc29955' : '#796e5029';
          ctx.fillRect(px + a * tile, py + b * tile, 1 + a * 2.5, 1 + b);
        }
        // Broken scuffs give the dirt texture without implying regular lanes.
        if (seed(x, y, 40) > .6) {
          const scuffX = px + tile * (.2 + seed(x, y, 41) * .5);
          const scuffY = py + tile * (.2 + seed(x, y, 42) * .5);
          const angle = seed(x, y, 43) * TAU;
          const length = tile * .2;
          ctx.strokeStyle = '#8f805529';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(scuffX, scuffY);
          ctx.quadraticCurveTo(scuffX + Math.cos(angle + .3) * length,
            scuffY + Math.sin(angle + .3) * length,
            scuffX + Math.cos(angle) * length * 2,
            scuffY + Math.sin(angle) * length * 2);
          ctx.stroke();
        }
      } else {
        const style = world.terrain?.[y]?.[x] ?? 4;
        ctx.fillStyle = ['#9b8d4f', '#827849', '#7f8550', '#939161', '#6f7950', '#b69b70'][style];
        ctx.fillRect(px, py, tile + .4, tile + .4);
        if (style === 0 || style === 1) {
          for (let row = 0; row < 3; row++) {
            const yy = py + 5 + row * tile / 3;
            ctx.strokeStyle = style === 0 ? '#c2a45d8a' : '#544d3266';
            ctx.lineWidth = style === 0 ? 2 : 3;
            ctx.beginPath();
            ctx.moveTo(px, yy);
            ctx.lineTo(px + tile, yy);
            ctx.stroke();
            if (style === 0) {
              ctx.strokeStyle = '#e0c07899';
              ctx.lineWidth = 1;
              ctx.beginPath();
              for (let stalk = 0; stalk < 4; stalk++) {
                const xx = px + stalk * tile / 4 + 3;
                ctx.moveTo(xx, yy);
                ctx.lineTo(xx + 2, yy - 4);
              }
              ctx.stroke();
            }
          }
          if (style === 1 && seed(x, y, 7) > .67) drawPumpkin(ctx, px + tile * .5, py + tile * .5, tile * .16);
        } else {
          ctx.strokeStyle = '#c2bd762f';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let n = 0; n < 3; n++) {
            const xx = px + seed(x, y, n + 20) * tile;
            const yy = py + seed(y, x, n + 30) * tile;
            ctx.moveTo(xx - 2, yy - 3);
            ctx.lineTo(xx, yy);
            ctx.lineTo(xx + 2, yy - 4);
          }
          ctx.stroke();
        }
      }
    }
  }
  // Every visible prop corresponds to an actual solid footprint in the grid.
  for (const prop of world.farmProps || []) {
    if (prop.x + prop.width < bounds.minX || prop.x > bounds.maxX || prop.y + prop.height < bounds.minY || prop.y > bounds.maxY) continue;
    const x = prop.x * tile;
    const y = prop.y * tile;
    const w = prop.width * tile;
    const h = prop.height * tile;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (prop.type === 'barn') {
      // The raised foundation marks the whole solid area, including the barn's
      // margins, so apparent dirt never conceals an invisible collision box.
      ctx.fillStyle = '#79664e';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#bba780';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      ctx.strokeStyle = '#4e473b';
      ctx.lineWidth = 1;
      for (let edge = tile * .5; edge < w; edge += tile * .7) {
        ctx.beginPath(); ctx.moveTo(x + edge, y); ctx.lineTo(x + edge, y + 5);
        ctx.moveTo(x + edge, y + h - 5); ctx.lineTo(x + edge, y + h); ctx.stroke();
      }
      drawBarn(ctx, x + w / 2, y + h * .57, Math.min(w / 3.5, h / 3.1), seed(x, y) > .5);
    } else if (prop.type === 'wagon') {
      roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 3, '#4b4734');
      roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 2, '#9f7044');
      ctx.strokeStyle = '#dbad70';
      ctx.lineWidth = 2;
      for (let n = 1; n < 5; n++) {
        ctx.beginPath(); ctx.moveTo(x + 6, y + h * n / 5); ctx.lineTo(x + w - 6, y + h * n / 5); ctx.stroke();
      }
      for (const xx of [x + 4, x + w - 4]) for (const yy of [y + 6, y + h - 6]) ellipse(ctx, xx, yy, 3, 5, '#302f29');
    } else {
      for (let dy = 0; dy < prop.height; dy++) for (let dx = 0; dx < prop.width; dx++) {
        const cx = x + (dx + .5) * tile;
        const cy = y + (dy + .5) * tile;
        if (prop.type === 'hay') drawHay(ctx, cx, cy, tile * .96);
        else if (prop.type === 'barrels') {
          ellipse(ctx, cx + 2, cy + 3, tile * .43, tile * .44, '#51412f');
          ellipse(ctx, cx, cy, tile * .42, tile * .43, '#847351');
          ctx.strokeStyle = '#c5b58d'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(cx, cy, tile * .33, tile * .34, 0, 0, TAU); ctx.stroke();
          ellipse(ctx, cx + tile * .16, cy - tile * .15, 2, 2, '#322d23');
        } else {
          roundRect(ctx, cx - tile * .46, cy - tile * .46, tile * .92, tile * .92, 2, '#84603c');
          ctx.strokeStyle = '#d1a873'; ctx.lineWidth = 2;
          ctx.strokeRect(cx - tile * .36, cy - tile * .36, tile * .72, tile * .72);
          ctx.beginPath(); ctx.moveTo(cx - tile * .36, cy - tile * .36); ctx.lineTo(cx + tile * .36, cy + tile * .36); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}

function drawFenceSegment(ctx, ax, ay, bx, by, tile) {
  const lift = tile * .24;
  // A slight sideways projection keeps vertical wire panels visible from above.
  const lean = tile * .1;
  const length = Math.hypot(bx - ax, by - ay);
  const pieces = Math.max(3, Math.round(length / 6));
  ctx.beginPath();
  ctx.moveTo(ax + 2, ay + 3);
  ctx.lineTo(bx + 2, by + 3);
  ctx.strokeStyle = '#302f2838';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx + lean, by - lift);
  ctx.lineTo(ax + lean, ay - lift);
  ctx.closePath();
  ctx.fillStyle = '#d8dbc221';
  ctx.fill();
  ctx.strokeStyle = '#d3d6bd';
  ctx.lineWidth = .75;
  ctx.stroke();
  ctx.beginPath();
  for (let n = 0; n < pieces; n++) {
    const t1 = n / pieces;
    const t2 = (n + 1) / pieces;
    const x1 = ax + (bx - ax) * t1;
    const y1 = ay + (by - ay) * t1;
    const x2 = ax + (bx - ax) * t2;
    const y2 = ay + (by - ay) * t2;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 + lean, y2 - lift);
    ctx.moveTo(x1 + lean, y1 - lift);
    ctx.lineTo(x2, y2);
  }
  ctx.strokeStyle = '#e4e4cc9c';
  ctx.lineWidth = .65;
  ctx.stroke();
  for (const [x, y] of [[ax, ay], [bx, by]]) {
    ctx.strokeStyle = '#695035';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + lean, y - lift - 3);
    ctx.stroke();
    ctx.strokeStyle = '#a38a5c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - .7, y);
    ctx.lineTo(x + lean - .7, y - lift - 3);
    ctx.stroke();
  }
}

function drawFences(ctx, world, bounds, tile) {
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (isRoad(world, x, y) || world.obstacleTiles?.has(y * world.width + x)) continue;
      const px = x * tile;
      const py = y * tile;
      if (isRoad(world, x, y - 1)) drawFenceSegment(ctx, px, py, px + tile, py, tile);
      if (isRoad(world, x, y + 1)) drawFenceSegment(ctx, px, py + tile, px + tile, py + tile, tile);
      if (isRoad(world, x - 1, y)) drawFenceSegment(ctx, px, py, px, py + tile, tile);
      if (isRoad(world, x + 1, y)) drawFenceSegment(ctx, px + tile, py, px + tile, py + tile, tile);
    }
  }
}

function drawTurkey(ctx, x, y, size, angle = 0, { player = false, ghost = false, time = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (ghost) ctx.globalAlpha *= .5;
  ellipse(ctx, 2, size * .4, size * .71, size * .37, '#2a211a44');
  if (player) {
    ctx.strokeStyle = '#fff4c2';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 1, size * .93, size * .84, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.rotate(angle + Math.PI / 2);
  const steps = player ? Math.sin(time * 15) * size * .07 : 0;
  ctx.strokeStyle = '#dc9a3b';
  ctx.lineWidth = size * .12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-size * .2, size * .4);
  ctx.lineTo(-size * .32, size * .66 + steps);
  ctx.moveTo(size * .2, size * .4);
  ctx.lineTo(size * .32, size * .66 - steps);
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const a = (i - 3) * .28;
    const fx = Math.sin(a) * size * .6;
    const fy = Math.cos(a) * size * .42;
    ellipse(ctx, fx, fy, size * .16, size * .59, i % 2 ? '#75442e' : '#985b36', -a);
    ellipse(ctx, fx + Math.sin(a) * size * .23, fy + Math.cos(a) * size * .36, size * .12, size * .17, i % 2 ? '#e3a151' : '#f0bc6d', -a);
    ellipse(ctx, fx + Math.sin(a) * size * .1, fy + Math.cos(a) * size * .16, size * .08, size * .12, '#352d24', -a);
  }
  ellipse(ctx, 0, 0, size * .4, size * .49, '#65412f');
  ellipse(ctx, -size * .23, size * .07, size * .15, size * .3, '#bc7942', -.25);
  ellipse(ctx, size * .23, size * .07, size * .15, size * .3, '#a46536', .25);
  ellipse(ctx, 0, -size * .41, size * .22, size * .32, '#8ca4a0');
  ellipse(ctx, -size * .04, -size * .61, size * .25, size * .23, '#acc5b8');
  ellipse(ctx, size * .13, -size * .36, size * .09, size * .24, '#d75540', -.15);
  ctx.fillStyle = '#f4be59';
  ctx.beginPath();
  ctx.moveTo(-size * .1, -size * .76);
  ctx.lineTo(size * .12, -size * .76);
  ctx.lineTo(size * .015, -size * .99);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, -size * .16, -size * .66, size * .065, size * .074, '#161f1e');
  ellipse(ctx, size * .1, -size * .67, size * .057, size * .069, '#161f1e');
  ellipse(ctx, -size * .18, -size * .69, size * .02, size * .024, '#fff9dd');
  ctx.restore();
}

function drawFarmer(ctx, farmer, tile, time, stunned) {
  const x = farmer.x * tile;
  const y = farmer.y * tile;
  const size = tile * .62;
  ctx.save();
  ctx.translate(x, y);
  ellipse(ctx, 2, size * .34, size * .63, size * .42, '#30251950');
  ctx.rotate((farmer.facing || 0) + Math.PI / 2);
  const step = stunned ? 0 : Math.sin(time * 13) * size * .13;
  roundRect(ctx, -size * .32, size * .12 + step, size * .25, size * .52, 3, '#313c36');
  roundRect(ctx, size * .08, size * .12 - step, size * .25, size * .52, 3, '#313c36');
  ellipse(ctx, 0, 0, size * .58, size * .38, '#aa6240');
  ellipse(ctx, -size * .54, -size * .1, size * .13, size * .2, '#d5a77b');
  ellipse(ctx, size * .54, -size * .1, size * .13, size * .2, '#d5a77b');
  roundRect(ctx, -size * .3, -size * .2, size * .6, size * .57, 3, '#436c72');
  ctx.fillStyle = '#739290';
  ctx.fillRect(-size * .23, -size * .28, size * .09, size * .35);
  ctx.fillRect(size * .15, -size * .28, size * .09, size * .35);
  ellipse(ctx, 0, -size * .32, size * .3, size * .32, '#dbae82');
  ellipse(ctx, 0, -size * .44, size * .55, size * .29, '#d4b268');
  ellipse(ctx, 0, -size * .47, size * .34, size * .27, '#e9c982');
  ctx.strokeStyle = '#90734e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -size * .47, size * .33, size * .25, 0, 0, Math.PI);
  ctx.stroke();
  // Pitchfork is visible from above and immediately identifies the pursuer.
  ctx.strokeStyle = '#6d5136';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(size * .69, size * .52);
  ctx.lineTo(size * .69, -size * .98);
  ctx.stroke();
  ctx.strokeStyle = '#d0c6a4';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(size * .52, -size * .82);
  ctx.lineTo(size * .52, -size * 1.14);
  ctx.moveTo(size * .69, -size * .82);
  ctx.lineTo(size * .69, -size * 1.2);
  ctx.moveTo(size * .86, -size * .82);
  ctx.lineTo(size * .86, -size * 1.14);
  ctx.moveTo(size * .52, -size * .82);
  ctx.lineTo(size * .86, -size * .82);
  ctx.stroke();
  ctx.restore();
  if (stunned) {
    for (let n = 0; n < 3; n++) {
      const a = time * 3 + n * TAU / 3;
      ellipse(ctx, x + Math.cos(a) * tile * .6, y - tile * .6 + Math.sin(a) * tile * .13, 2.4, 2.4, '#aff1ff');
    }
  }
}

function drawCorn(ctx, corn, tile, time) {
  const x = corn.x * tile;
  const y = corn.y * tile;
  const bob = Math.sin(time * 3 + corn.x) * 1.2;
  ellipse(ctx, x, y + 5, 6, 3, '#6e502c33');
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(-.55);
  ellipse(ctx, 0, 0, 3.8, 7.2, '#ffdc65');
  ctx.strokeStyle = '#d6a330';
  ctx.lineWidth = .7;
  for (let n = -2; n <= 2; n++) {
    ctx.beginPath();
    ctx.moveTo(-2.6, n * 2);
    ctx.lineTo(2.6, n * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, -5.5);
  ctx.lineTo(0, 5.5);
  ctx.stroke();
  ellipse(ctx, -3.2, 3.8, 1.8, 5.2, '#668248', -.4);
  ellipse(ctx, 3.1, 3.6, 1.7, 4.5, '#83a053', .4);
  ctx.restore();
}

function powerSymbol(ctx, type, x, y, radius) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#2f382f';
  ctx.fillStyle = '#2f382f';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  if (type === 'speed') {
    ctx.beginPath();
    ctx.moveTo(1, -radius * .7);
    ctx.lineTo(-radius * .48, radius * .05);
    ctx.lineTo(0, radius * .05);
    ctx.lineTo(-1, radius * .73);
    ctx.lineTo(radius * .48, -radius * .13);
    ctx.lineTo(1, -radius * .13);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'stun') {
    ellipse(ctx, 0, radius * .2, radius * .75, radius * .4, '#664b35');
    ellipse(ctx, -radius * .2, 0, radius * .3, radius * .12, '#d5b48f');
  } else if (type === 'teleport') {
    ctx.beginPath();
    for (let n = 0; n < 34; n++) {
      const a = n / 33 * Math.PI * 3.7;
      const r = n / 33 * radius * .73;
      if (!n) ctx.moveTo(0, 0);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.stroke();
  } else if (type === 'decoy') {
    for (let n = -1; n <= 1; n++) {
      ctx.beginPath(); ctx.moveTo(-radius * .7, n * radius * .4);
      ctx.quadraticCurveTo(radius, n * radius * .4, radius * .4, n * radius * .4 - radius * .2); ctx.stroke();
    }
  } else {
    for (const n of [-.5, 0, .5]) {
      ctx.beginPath(); ctx.moveTo(n * radius, -radius * .7); ctx.lineTo(n * radius, radius * .7); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-radius * .8, radius * .2); ctx.lineTo(radius * .8, -radius * .2); ctx.stroke();
  }
  ctx.restore();
}

function drawPickup(ctx, pickup, tile, time) {
  const x = pickup.x * tile;
  const y = pickup.y * tile + Math.sin(time * 3 + pickup.x) * 2;
  const color = POWER_COLORS[pickup.type] || '#eed793';
  ellipse(ctx, x, y + 9, 10, 4, '#45351e33');
  ellipse(ctx, x, y, 12.5, 12.5, `${color}32`);
  ellipse(ctx, x, y, 9, 9, color);
  ctx.strokeStyle = '#fff7d3';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, TAU);
  ctx.stroke();
  powerSymbol(ctx, pickup.type, x, y, 9);
  const label = POWER_LABELS[pickup.type] || 'BOOST';
  ctx.font = '700 7px system-ui, sans-serif';
  const width = ctx.measureText(label).width + 8;
  roundRect(ctx, x - width / 2, y + 12, width, 11, 3, '#293529e8');
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 20);
}

function drawCage(ctx, cage, tile, time, player) {
  const x = cage.x * tile;
  const y = cage.y * tile;
  const s = tile * .9;
  const near = player && Math.hypot(cage.x - player.x, cage.y - player.y) < 2;
  ellipse(ctx, x + 2, y + s * .36, s * .58, s * .32, '#312c2344');
  roundRect(ctx, x - s / 2, y - s / 2, s, s, 4, '#66563a');
  roundRect(ctx, x - s / 2 + 2, y - s / 2 + 2, s - 4, s - 4, 3, '#b69b68');
  drawTurkey(ctx, x, y - 1, tile * .3, -.6 + Math.sin(time + cage.x) * .2);
  ctx.strokeStyle = near ? '#f8e5a2' : '#d2d1b3';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x - s / 2, y - s / 2, s, s);
  ctx.beginPath();
  for (let n = 1; n < 5; n++) {
    const xx = x - s / 2 + n * s / 5;
    ctx.moveTo(xx, y - s / 2);
    ctx.lineTo(xx, y + s / 2);
  }
  ctx.moveTo(x - s / 2, y);
  ctx.lineTo(x + s / 2, y);
  ctx.stroke();
  roundRect(ctx, x - 3, y + s / 2 - 3, 6, 7, 1.5, '#e8bf58');
  ellipse(ctx, x, y + s / 2, 1, 1.3, '#776239');
  if (near || cage.progress > 0) {
    ctx.strokeStyle = '#fff7d340';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, s * .78, 0, TAU);
    ctx.stroke();
    if (cage.progress > 0) {
      ctx.strokeStyle = '#ffde6e';
      ctx.beginPath();
      ctx.arc(x, y, s * .78, -Math.PI / 2, -Math.PI / 2 + Math.min(1, cage.progress) * TAU);
      ctx.stroke();
    }
  }
}

function drawMinimap(ctx, world, width, height, bounds) {
  const size = Math.min(width < 520 ? 108 : 144, height * .3);
  if (size < 62) return;
  const x = width - size - 16;
  const y = 16;
  roundRect(ctx, x - 7, y - 7, size + 14, size + 31, 12, '#20372ff0');
  ctx.strokeStyle = '#dccfa34d';
  ctx.lineWidth = 1;
  ctx.stroke();
  const sx = size / world.width;
  const sy = size / world.height;
  ctx.fillStyle = '#67724d';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#b6a77b';
  for (let row = 0; row < world.height; row++) {
    let runStart = -1;
    for (let col = 0; col <= world.width; col++) {
      if (col < world.width && isRoad(world, col, row)) {
        if (runStart < 0) runStart = col;
      } else if (runStart >= 0) {
        ctx.fillRect(x + runStart * sx, y + row * sy, (col - runStart) * sx, sy + .2);
        runStart = -1;
      }
    }
  }
  ctx.fillStyle = '#f6e3ad';
  for (const cage of world.cages || []) ctx.fillRect(x + cage.x * sx - 1.4, y + cage.y * sy - 1.4, 2.8, 2.8);
  ctx.strokeStyle = '#fff5d449';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + bounds.cameraX * sx, y + bounds.cameraY * sy, bounds.viewTilesX * sx, bounds.viewTilesY * sy);
  if (world.farmer) ellipse(ctx, x + world.farmer.x * sx, y + world.farmer.y * sy, 3.2, 3.2, '#f17857');
  if (world.player) {
    ellipse(ctx, x + world.player.x * sx, y + world.player.y * sy, 4.7, 4.7, '#213a32');
    ellipse(ctx, x + world.player.x * sx, y + world.player.y * sy, 3.1, 3.1, '#fff4be');
  }
  ctx.fillStyle = '#d8dec5';
  ctx.font = '600 8px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(size < 105 ? 'MAP' : 'FARM MAP', x, y + size + 15);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f49c79';
  ctx.fillText('● FARMER', x + size, y + size + 15);
}

function drawCageGuide(ctx, world, width, height, cameraX, cameraY, tile) {
  if (!world.player || !world.cages?.length) return;
  let nearest = null;
  let distance = Infinity;
  for (const cage of world.cages) {
    const d = Math.hypot(cage.x - world.player.x, cage.y - world.player.y);
    if (d < distance) { nearest = cage; distance = d; }
  }
  if (!nearest || distance < 3) return;
  const x = (nearest.x - cameraX) * tile;
  const y = (nearest.y - cameraY) * tile;
  if (x > 28 && x < width - 28 && y > 28 && y < height - 28) return;
  const playerX = (world.player.x - cameraX) * tile;
  const playerY = (world.player.y - cameraY) * tile;
  const a = Math.atan2(y - playerY, x - playerX);
  const radius = Math.min(width, height) * .27;
  const gx = playerX + Math.cos(a) * radius;
  const gy = playerY + Math.sin(a) * radius;
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(a);
  ctx.fillStyle = '#ffebad';
  ctx.strokeStyle = '#625536';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#29382ae6';
  ctx.font = '700 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const label = 'RESCUE';
  roundRect(ctx, gx - 23, gy + 11, 46, 15, 5, '#f6eacadb');
  ctx.fillStyle = '#3c4b32';
  ctx.fillText(label, gx, gy + 22);
}

/** Draw in logical CSS pixels; the caller owns canvas sizing and the DPR transform. */
export function drawThanksgivingWorld(ctx, world, viewportWidth, viewportHeight, { pixelRatio = 1 } = {}) {
  if (!ctx || !viewportWidth || !viewportHeight) return;
  // Kept in the interface so callers can share their existing high-DPI setup.
  void pixelRatio;
  ctx.save();
  ctx.fillStyle = '#898150';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);
  if (!world?.grid?.length || !world.width || !world.height) {
    ctx.restore();
    return;
  }
  const tile = viewportWidth < 560 ? 29 : 34;
  const viewTilesX = viewportWidth / tile;
  const viewTilesY = viewportHeight / tile;
  const player = world.player || { x: world.width / 2, y: world.height / 2 };
  const cameraX = Math.max(0, Math.min(world.width - viewTilesX, player.x - viewTilesX / 2));
  const cameraY = Math.max(0, Math.min(world.height - viewTilesY, player.y - viewTilesY / 2));
  const bounds = {
    minX: Math.max(0, Math.floor(cameraX) - 2),
    minY: Math.max(0, Math.floor(cameraY) - 2),
    maxX: Math.min(world.width - 1, Math.ceil(cameraX + viewTilesX) + 2),
    maxY: Math.min(world.height - 1, Math.ceil(cameraY + viewTilesY) + 2),
    cameraX, cameraY, viewTilesX, viewTilesY,
  };
  const visible = entity => entity && entity.x >= bounds.minX - 1 && entity.x <= bounds.maxX + 1 && entity.y >= bounds.minY - 1 && entity.y <= bounds.maxY + 1;
  const time = world.time || 0;
  const effects = world.effects || {};
  ctx.save();
  ctx.translate(-cameraX * tile, -cameraY * tile);
  const landscape = cachedLandscape(world, tile);
  if (landscape) {
    const sx = cameraX * tile;
    const sy = cameraY * tile;
    const sw = Math.min(viewportWidth, world.width * tile - sx);
    const sh = Math.min(viewportHeight, world.height * tile - sy);
    ctx.drawImage(landscape, sx, sy, sw, sh, sx, sy, sw, sh);
  } else {
    drawGround(ctx, world, bounds, tile);
    drawFences(ctx, world, bounds, tile);
  }
  for (const corn of world.corn || []) if (visible(corn)) drawCorn(ctx, corn, tile, time);
  for (const pickup of world.pickups || []) if (visible(pickup)) drawPickup(ctx, pickup, tile, time);
  for (const cage of world.cages || []) if (visible(cage)) drawCage(ctx, cage, tile, time, player);
  for (const turkey of world.freed || []) {
    if (!visible(turkey)) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - (turkey.age || 0) / 2.5);
    drawTurkey(ctx, turkey.x * tile, turkey.y * tile, tile * .35, turkey.facing || -.5, { time });
    ctx.fillStyle = '#fff0b2';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FREE!', turkey.x * tile, turkey.y * tile - tile * .65 - (turkey.age || 0) * 7);
    ctx.restore();
  }
  for (const trap of world.traps || []) {
    if (trap.remaining <= 0 || !visible(trap)) continue;
    // Clip the wider puddle to ground so it never paints across a barn or fence.
    const radius = FARM_POWER_SETTINGS.mudRadius;
    ctx.save(); ctx.beginPath();
    for (let y = Math.floor(trap.y - radius); y <= Math.ceil(trap.y + radius); y++) {
      for (let x = Math.floor(trap.x - radius); x <= Math.ceil(trap.x + radius); x++) {
        if (world.grid[y]?.[x] === 0) ctx.rect(x * tile, y * tile, tile, tile);
      }
    }
    ctx.clip();
    ellipse(ctx, trap.x * tile, trap.y * tile, tile * radius, tile * radius, '#75543877');
    ellipse(ctx, trap.x * tile - 3, trap.y * tile - 2, tile * radius * .55, tile * radius * .35, '#bd936c66');
    ctx.restore();
  }
  if (effects.gust > 0) {
    ctx.strokeStyle = '#fff4dbbb'; ctx.lineWidth = 2;
    for (let n = 0; n < 3; n++) {
      ctx.beginPath(); ctx.arc(player.x * tile, player.y * tile, tile * (1 + n * .7 + (0.7 - effects.gust) * 4), (player.facing || 0) - .6, (player.facing || 0) + .6); ctx.stroke();
    }
  }
  if (effects.speed > 0) {
    const a = player.facing || 0;
    for (let n = 1; n < 4; n++) {
      ellipse(ctx, player.x * tile - Math.cos(a) * n * 8, player.y * tile - Math.sin(a) * n * 8, 5 - n, 5 - n, `rgba(255,228,122,${.45 - n * .1})`);
    }
  }
  if (world.farmer && visible(world.farmer)) drawFarmer(ctx, world.farmer, tile, time, effects.farmerStagger > 0);
  if (effects.mudSlow > 0 && world.farmer && visible(world.farmer)) ellipse(ctx, world.farmer.x * tile, world.farmer.y * tile + 9, tile * .45, tile * .15, "#795335aa");
  if (world.player) {
    drawTurkey(ctx, player.x * tile, player.y * tile, tile * .52, player.facing || 0, { player: true, ghost: effects.fenceSlip > 0, time });
    if (effects.fenceSlip > 0) {
      ctx.strokeStyle = '#bedfa699';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(player.x * tile, player.y * tile, tile * .75, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
  const glow = ctx.createRadialGradient(viewportWidth / 2, viewportHeight / 2, viewportWidth * .12, viewportWidth / 2, viewportHeight / 2, Math.max(viewportWidth, viewportHeight) * .68);
  glow.addColorStop(0, '#ffde9600');
  glow.addColorStop(1, '#302e2333');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);
  if (world.farmer && !world.caught) {
    const distance = Math.hypot(world.farmer.x - player.x, world.farmer.y - player.y);
    if (distance < 5) {
      ctx.strokeStyle = `rgba(185,66,38,${(.14 + Math.sin(time * 5) * .05) * (1 - distance / 5)})`;
      ctx.lineWidth = 18;
      ctx.strokeRect(0, 0, viewportWidth, viewportHeight);
    }
  }
  drawCageGuide(ctx, world, viewportWidth, viewportHeight, cameraX, cameraY, tile);
  drawMinimap(ctx, world, viewportWidth, viewportHeight, bounds);
  ctx.restore();
}
