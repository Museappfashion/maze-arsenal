import { DEFENSE_COLUMNS, DEFENSE_ROWS, DEFENSE_PATH, DEFENSE_TYPES, defenseTowerStats, canPlaceDefense, isDefensePath } from "./towerDefense.js";

export const DEFENSE_CANVAS_WIDTH = 900;
export const DEFENSE_CANVAS_HEIGHT = 600;
const TILE = DEFENSE_CANVAS_WIDTH / DEFENSE_COLUMNS;

function circle(ctx, x, y, radius, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); }
function polygon(ctx, points, fill, stroke) {
  ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
export function drawDefenseGame(ctx, game, hover, placingType) {
  ctx.clearRect(0, 0, DEFENSE_CANVAS_WIDTH, DEFENSE_CANVAS_HEIGHT);
  ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, DEFENSE_CANVAS_WIDTH, DEFENSE_CANVAS_HEIGHT);
  for (let y = 0; y < DEFENSE_ROWS; y++) for (let x = 0; x < DEFENSE_COLUMNS; x++) {
    const path = isDefensePath(x, y);
    ctx.fillStyle = path ? "#1e293b" : (x + y) % 2 ? "#0f172a" : "#111b2e";
    ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
    if (!path) { ctx.fillStyle = "#253146"; ctx.fillRect(x * TILE + 24, y * TILE + 24, 2, 2); }
    else { ctx.strokeStyle = "#334155"; ctx.lineWidth = 1; ctx.strokeRect(x * TILE + 1.5, y * TILE + 1.5, TILE - 3, TILE - 3); }
  }
  ctx.strokeStyle = "#67e8f92b"; ctx.lineWidth = 2; ctx.setLineDash([5, 10]); ctx.beginPath();
  DEFENSE_PATH.forEach((point, i) => i ? ctx.lineTo(point.x * TILE, point.y * TILE) : ctx.moveTo(point.x * TILE, point.y * TILE));
  ctx.stroke(); ctx.setLineDash([]);
  const start = DEFENSE_PATH[0], end = DEFENSE_PATH.at(-1);
  circle(ctx, start.x * TILE, start.y * TILE, 18, "#5d2841");
  ctx.font = "bold 21px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fda4af"; ctx.fillText("›", start.x * TILE, start.y * TILE - 1);
  ctx.save(); ctx.translate(end.x * TILE, end.y * TILE); ctx.lineWidth = 1.5; ctx.shadowColor = "#67e8f9"; ctx.shadowBlur = 16;
  polygon(ctx, [[0, -22], [19, -11], [0, 0], [-19, -11]], "#a5f3fc", "#cffafe");
  polygon(ctx, [[-19, -11], [0, 0], [0, 23], [-19, 12]], "#0891b2", "#67e8f9");
  polygon(ctx, [[0, 0], [19, -11], [19, 12], [0, 23]], "#155e75", "#67e8f9"); ctx.restore();
  const selected = game.towers.find((tower) => tower.id === game.selectedId);
  const preview = hover && !game.towers.some((tower) => Math.floor(tower.x) === hover.x && Math.floor(tower.y) === hover.y) ? { x: hover.x + .5, y: hover.y + .5, type: placingType, level: 1 } : selected;
  if (preview && DEFENSE_TYPES[preview.type]) {
    const stats = defenseTowerStats(preview), color = stats.color;
    circle(ctx, preview.x * TILE, preview.y * TILE, stats.range * TILE, `${color}14`);
    ctx.strokeStyle = `${color}70`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(preview.x * TILE, preview.y * TILE, stats.range * TILE, 0, Math.PI * 2); ctx.stroke();
  }
  for (const tower of game.towers) {
    const stats = defenseTowerStats(tower), x = tower.x * TILE, y = tower.y * TILE;
    if (tower.type === "frost") { circle(ctx, x, y, stats.range * TILE, "#67e8f90a"); ctx.strokeStyle = "#67e8f933"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, stats.range * TILE, 0, Math.PI * 2); ctx.stroke(); }
    ctx.save(); ctx.translate(x, y); ctx.shadowColor = stats.color; ctx.shadowBlur = 15;
    ctx.rotate(Math.sin(game.time * .7 + tower.id) * .12); ctx.lineWidth = 1.5;
    polygon(ctx, [[0, -16], [16, 0], [0, 16], [-16, 0]], stats.color, "#ffffff");
    ctx.shadowBlur = 0; ctx.fillStyle = "#020617"; ctx.font = "800 13px system-ui"; ctx.fillText(stats.symbol, 0, 1); ctx.restore();
    ctx.strokeStyle = tower.id === game.selectedId ? "#f8fafc" : `${stats.color}80`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < tower.level; i++) circle(ctx, x - (tower.level - 1) * 4 + i * 8, y + 24, 2.2, stats.color);
  }
  for (const enemy of game.enemies) {
    const x = enemy.x * TILE, y = enemy.y * TILE, radius = Math.max(7, enemy.radius * TILE * .8);
    circle(ctx, x + 2, y + 3, radius + 2, "#0005");
    if (enemy.slow < 1) circle(ctx, x, y, radius + 4, "#67e8f950");
    if (enemy.kind === "warden") { ctx.strokeStyle = "#a78bfa35"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, TILE * 2.2, 0, Math.PI * 2); ctx.stroke(); }
    if (enemy.protected) { ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, radius + 3, 0, Math.PI * 2); ctx.stroke(); }
    ctx.save(); ctx.shadowColor = enemy.color; ctx.shadowBlur = enemy.boss ? 18 : 9;
    ctx.fillStyle = enemy.color; ctx.beginPath();
    if (enemy.kind === "skitter" || enemy.kind === "charger") { ctx.moveTo(x, y - radius); ctx.lineTo(x + radius, y + radius); ctx.lineTo(x - radius, y + radius); }
    else if (enemy.kind === "warden" || enemy.kind === "brute") { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; if (!i) ctx.moveTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius); else ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius); } }
    else ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = enemy.veteran ? "#f8fafc" : enemy.boss ? "#ddd6fe" : "#ffffff60"; ctx.lineWidth = enemy.veteran || enemy.boss ? 2 : 1; ctx.stroke(); ctx.restore();
    circle(ctx, x - radius * .3, y - 2, 2, "#0f172a"); circle(ctx, x + radius * .3, y - 2, 2, "#0f172a");
    if (enemy.veteran) { ctx.fillStyle = "#f8fafc"; ctx.font = "bold 10px system-ui"; ctx.fillText("+", x, y + radius + 8); }
    if (enemy.hp < enemy.maxHp) { ctx.fillStyle = "#020617"; ctx.fillRect(x - 14, y - radius - 7, 28, 4); ctx.fillStyle = enemy.slow < 1 ? "#67e8f9" : "#4ade80"; ctx.fillRect(x - 14, y - radius - 7, 28 * Math.max(0, enemy.hp / enemy.maxHp), 4); }
  }
  for (const effect of game.effects) {
    ctx.save(); ctx.globalAlpha = effect.ttl / effect.maxTtl; ctx.strokeStyle = effect.color;
    if (effect.type === "beam") { ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(effect.x * TILE, effect.y * TILE); ctx.lineTo(effect.x2 * TILE, effect.y2 * TILE); ctx.stroke(); }
    else { const radius = effect.radius * TILE * (1.2 - effect.ttl / effect.maxTtl); circle(ctx, effect.x * TILE, effect.y * TILE, radius, `${effect.color}44`); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(effect.x * TILE, effect.y * TILE, radius, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  if (hover && game.status !== "defeat" && game.status !== "victory") {
    const occupied = game.towers.some((tower) => Math.floor(tower.x) === hover.x && Math.floor(tower.y) === hover.y);
    ctx.strokeStyle = occupied ? "#f8fafc" : canPlaceDefense(game, placingType, hover.x, hover.y) ? "#fb7185" : "#86efac";
    ctx.lineWidth = 2; ctx.strokeRect(hover.x * TILE + 3, hover.y * TILE + 3, TILE - 6, TILE - 6);
  }
}
