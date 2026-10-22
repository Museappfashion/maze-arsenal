import { DEFENSE_COLUMNS, DEFENSE_ROWS, DEFENSE_PATH, DEFENSE_TYPES, defenseTowerStats, canPlaceDefense, isDefensePath } from "./towerDefense.js";

export const DEFENSE_CANVAS_WIDTH = 900;
export const DEFENSE_CANVAS_HEIGHT = 600;
const TILE = DEFENSE_CANVAS_WIDTH / DEFENSE_COLUMNS;

function circle(ctx, x, y, radius, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); }
export function drawDefenseGame(ctx, game, hover, placingType) {
  ctx.clearRect(0, 0, DEFENSE_CANVAS_WIDTH, DEFENSE_CANVAS_HEIGHT);
  ctx.fillStyle = "#090f1e"; ctx.fillRect(0, 0, DEFENSE_CANVAS_WIDTH, DEFENSE_CANVAS_HEIGHT);
  for (let y = 0; y < DEFENSE_ROWS; y++) for (let x = 0; x < DEFENSE_COLUMNS; x++) {
    const path = isDefensePath(x, y);
    ctx.fillStyle = path ? "#332e44" : (x + y) % 2 ? "#101929" : "#111c2c";
    ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
    if (!path) { ctx.fillStyle = "#253146"; ctx.fillRect(x * TILE + 24, y * TILE + 24, 2, 2); }
  }
  ctx.strokeStyle = "#8a7aab50"; ctx.lineWidth = 2; ctx.setLineDash([5, 10]); ctx.beginPath();
  DEFENSE_PATH.forEach((point, i) => i ? ctx.lineTo(point.x * TILE, point.y * TILE) : ctx.moveTo(point.x * TILE, point.y * TILE));
  ctx.stroke(); ctx.setLineDash([]);
  const start = DEFENSE_PATH[0], end = DEFENSE_PATH.at(-1);
  circle(ctx, start.x * TILE, start.y * TILE, 18, "#5d2841");
  ctx.font = "bold 21px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fda4af"; ctx.fillText("›", start.x * TILE, start.y * TILE - 1);
  ctx.save(); ctx.translate(end.x * TILE, end.y * TILE); ctx.rotate(Math.PI / 4); ctx.fillStyle = "#164e63"; ctx.fillRect(-15, -15, 30, 30); ctx.strokeStyle = "#67e8f9"; ctx.lineWidth = 2; ctx.strokeRect(-15, -15, 30, 30); ctx.restore();
  circle(ctx, end.x * TILE, end.y * TILE, 7, "#cffafe");
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
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = "#171d30"; ctx.fillRect(-16, -16, 32, 32); ctx.strokeStyle = tower.id === game.selectedId ? "#f1f5f9" : stats.color; ctx.lineWidth = 2; ctx.strokeRect(-16, -16, 32, 32); ctx.restore();
    ctx.fillStyle = stats.color; ctx.font = "800 16px system-ui"; ctx.fillText(stats.symbol, x, y - 2);
    for (let i = 0; i < tower.level; i++) ctx.fillRect(x - (tower.level * 6 - 2) / 2 + i * 6, y + 12, 4, 3);
  }
  for (const enemy of game.enemies) {
    const x = enemy.x * TILE, y = enemy.y * TILE, radius = Math.max(7, enemy.radius * TILE * .8);
    circle(ctx, x + 2, y + 3, radius + 2, "#0005");
    if (enemy.slow < 1) circle(ctx, x, y, radius + 4, "#67e8f950");
    ctx.fillStyle = enemy.color; ctx.beginPath();
    if (enemy.kind === "skitter" || enemy.kind === "charger") { ctx.moveTo(x, y - radius); ctx.lineTo(x + radius, y + radius); ctx.lineTo(x - radius, y + radius); }
    else if (enemy.kind === "warden" || enemy.kind === "brute") { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; if (!i) ctx.moveTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius); else ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius); } }
    else ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#ffffff60"; ctx.lineWidth = 1; ctx.stroke();
    circle(ctx, x - radius * .3, y - 2, 2, "#0f172a"); circle(ctx, x + radius * .3, y - 2, 2, "#0f172a");
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
