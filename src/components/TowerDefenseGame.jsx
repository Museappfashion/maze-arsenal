import { useEffect, useRef, useState } from "react";
import { ENEMY_TYPES } from "../config/enemies.js";
import { recordActivePlay, flushPlayerProgress } from "../services/playerProgress.js";
import { DEFENSE_COLUMNS, DEFENSE_ROWS, DEFENSE_TYPES, DEFENSE_WAVES, createDefenseGame, placeDefense, upgradeDefense, sellDefense, startDefenseWave, stepDefense, defenseTowerStats, defenseUpgradeCost, defenseSellValue, defenseWave } from "../game/towerDefense.js";
import { drawDefenseGame, DEFENSE_CANVAS_WIDTH, DEFENSE_CANVAS_HEIGHT } from "../game/towerDefenseRenderer.js";
import "../styles/towerDefense.css";

const powerKeys = Object.keys(DEFENSE_TYPES);
export function TowerDefenseGame({ onBack, playerName }) {
  const gameRef = useRef(null);
  if (!gameRef.current) gameRef.current = createDefenseGame();
  const canvasRef = useRef(null), hoverRef = useRef(null), placingRef = useRef("rapidFire");
  const [revision, setRevision] = useState(0), [placing, setPlacing] = useState("rapidFire");
  const refresh = () => setRevision((value) => value + 1);
  const game = gameRef.current;
  const selected = game.towers.find((tower) => tower.id === game.selectedId);
  const ended = game.status === "defeat" || game.status === "victory";
  const selectedStats = selected && defenseTowerStats(selected);

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = DEFENSE_CANVAS_WIDTH * dpr; canvas.height = DEFENSE_CANVAS_HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let frame, previous = performance.now(), lastUi = 0;
    const animate = (now) => {
      const dt = Math.max(0, Math.min((now - previous) / 1000, .1)); previous = now;
      const current = gameRef.current;
      if (!document.hidden && current.status === "running" && !current.paused) {
        const before = current.time; stepDefense(current, dt);
        recordActivePlay(playerName, current.time - before);
      }
      drawDefenseGame(ctx, current, hoverRef.current, placingRef.current);
      if (now - lastUi > 120) { lastUi = now; setRevision((value) => value + 1); }
      frame = requestAnimationFrame(animate);
    };
    const suspend = () => {
      const current = gameRef.current;
      if (current.status === "running") { current.paused = true; current.message = "Paused while you were away. Resume when ready."; }
      previous = performance.now(); flushPlayerProgress(); setRevision((value) => value + 1);
    };
    const visibility = () => { if (document.hidden) suspend(); previous = performance.now(); };
    window.addEventListener("blur", suspend); window.addEventListener("pagehide", suspend);
    document.addEventListener("visibilitychange", visibility);
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("blur", suspend); window.removeEventListener("pagehide", suspend); document.removeEventListener("visibilitychange", visibility); flushPlayerProgress(); };
  }, [playerName]);

  function choose(type) { placingRef.current = type; setPlacing(type); game.selectedId = null; refresh(); }
  function chooseTile(x, y) {
    hoverRef.current = { x, y };
    const tower = game.towers.find((item) => Math.floor(item.x) === x && Math.floor(item.y) === y);
    if (tower) { game.selectedId = tower.id; game.message = `${DEFENSE_TYPES[tower.type].label}, level ${tower.level}. Upgrade for more power and range.`; }
    else placeDefense(game, placingRef.current, x, y);
    refresh();
  }
  function pointerTile(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(DEFENSE_COLUMNS - 1, Math.floor((event.clientX - bounds.left) / bounds.width * DEFENSE_COLUMNS))), y: Math.max(0, Math.min(DEFENSE_ROWS - 1, Math.floor((event.clientY - bounds.top) / bounds.height * DEFENSE_ROWS))) };
  }
  function togglePause() { if (game.status === "running") { game.paused = !game.paused; game.message = game.paused ? "Paused. Resume to keep defending." : `Wave ${game.wave}: defend the core!`; flushPlayerProgress(); refresh(); } }
  function restart() { flushPlayerProgress(); gameRef.current = createDefenseGame(); hoverRef.current = null; refresh(); }
  function boardKeys(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
      event.preventDefault(); const at = hoverRef.current || { x: 1, y: 1 };
      hoverRef.current = { x: Math.max(0, Math.min(DEFENSE_COLUMNS - 1, at.x + (key === "arrowright" ? 1 : key === "arrowleft" ? -1 : 0))), y: Math.max(0, Math.min(DEFENSE_ROWS - 1, at.y + (key === "arrowdown" ? 1 : key === "arrowup" ? -1 : 0))) };
      refresh();
    } else if (key === "enter") { event.preventDefault(); const at = hoverRef.current || { x: 1, y: 1 }; chooseTile(at.x, at.y); }
    else if (key === " ") { event.preventDefault(); if (game.status === "building") startDefenseWave(game); else togglePause(); refresh(); }
    else if (key === "p") { event.preventDefault(); togglePause(); }
    else if (powerKeys[Number(key) - 1]) { event.preventDefault(); choose(powerKeys[Number(key) - 1]); }
    else if (key === "escape") { game.selectedId = null; hoverRef.current = null; refresh(); }
  }
  const wavePreview = [...new Set(defenseWave(Math.min(DEFENSE_WAVES, game.status === "building" ? game.wave + 1 : game.wave || 1)))].map((key) => ENEMY_TYPES[key].label).join(" · ");
  return <main className="td-screen" data-revision={revision}>
    <div className="td-content">
      <header className="td-header">
        <div><p className="td-kicker">MIST MAZE · SURVIVAL</p><h1>Powerup Defense</h1><p className="td-subtitle">Build your defenses. Keep the enemy waves away from the core.</p></div>
        <button className="td-button" type="button" onClick={() => { flushPlayerProgress(); onBack(); }}>Back to first page</button>
      </header>
      <section className="td-stats" aria-label="Battle status">
        <div><span>Core health</span><strong className={game.lives <= 5 ? "td-danger" : ""}>{game.lives} / 20</strong></div>
        <div><span>Battlefield energy</span><strong className="td-energy">{game.energy}</strong></div>
        <div><span>Wave</span><strong>{game.wave} / {DEFENSE_WAVES}</strong></div>
        <div><span>Enemies defeated</span><strong>{game.kills}</strong></div>
      </section>
      <div className="td-layout">
        <section className="td-arena-panel" aria-label="Defense arena">
          <div className="td-arena-heading"><strong>Defend the crystal core</strong><span><i className="td-path-key" /> Enemy route</span></div>
          <div className="td-canvas-wrap">
            <canvas ref={canvasRef} className="td-canvas" tabIndex={0} role="application" aria-label="Tower defense board. Select a powerup, then click an empty tile. Keyboard: arrows choose tile, Enter places or selects, keys 1 to 5 choose powerup, Space starts or pauses." aria-describedby="td-board-help" onKeyDown={boardKeys}
              onPointerMove={(event) => { hoverRef.current = pointerTile(event); }} onPointerLeave={() => { hoverRef.current = null; }}
              onPointerDown={(event) => { if (event.button !== 0) return; event.currentTarget.focus({ preventScroll: true }); const tile = pointerTile(event); chooseTile(tile.x, tile.y); }} />
            {(game.paused || ended) && <div className="td-overlay"><div><p className="td-kicker">{ended ? "RUN COMPLETE" : "TAKE YOUR TIME"}</p><h2>{game.status === "victory" ? "Core protected!" : game.status === "defeat" ? "The core has fallen" : "Paused"}</h2><p>{ended ? `${game.kills} enemies defeated · ${game.wave} waves reached` : "Your defenses and enemies are waiting."}</p><button type="button" className="td-button td-primary" onClick={ended ? restart : togglePause}>{ended ? "Play again" : "Resume battle"}</button></div></div>}
          </div>
          <div className="td-battle-controls">
            {game.status === "building" && <button type="button" className="td-button td-primary" onClick={() => { startDefenseWave(game); refresh(); }}>Start wave {game.wave + 1}</button>}
            {game.status === "running" && <button type="button" className="td-button td-primary" onClick={togglePause}>{game.paused ? "Resume" : "Pause"}</button>}
            {!ended && <button type="button" className="td-button" onClick={restart}>Restart</button>}
            <span>{game.status === "running" ? `${game.enemies.length} on the route · ${game.queue.length} approaching` : game.status === "building" ? "Build and upgrade before the next wave." : "A new run starts with 270 energy."}</span>
          </div>
          <p className="td-message" role="status">{game.message}</p>
          <p className="td-wave-preview">{game.status === "building" ? "Next wave" : "This wave"}: {wavePreview}</p>
          <p id="td-board-help" className="td-help">Click or tap an empty tile to build; select a defense to upgrade or sell. Keyboard: arrows + Enter to build, 1–5 to choose a powerup, Space to start or pause. The route stays clear.</p>
        </section>
        <aside className="td-shop" aria-label="Powerup defenses">
          <div className="td-shop-heading"><h2>Place powerups</h2><p>Enemies arrive in waves. Your energy is earned here and resets each run.</p></div>
          <div className="td-power-grid">{powerKeys.map((key, index) => {
            const type = DEFENSE_TYPES[key];
            return <button key={key} type="button" className={`td-power ${placing === key ? "td-power-selected" : ""}`} aria-pressed={placing === key} onClick={() => choose(key)} style={{ "--td-power-color": type.color }}>
              <span className="td-power-symbol">{type.symbol}</span><span className="td-power-copy"><strong>{type.label}</strong><small>{type.description}</small><b>{type.cost} energy <span>· key {index + 1}</span></b></span>
            </button>;
          })}</div>
          {selected && <section className="td-upgrade" aria-label="Selected defense">
            <h3>{selectedStats.label} <span>Lv. {selected.level}</span></h3>
            <p>{selected.type === "frost" ? `${Math.round((1 - selectedStats.slow) * 100)}% slow` : `${selectedStats.damage} damage · ${selectedStats.cooldown.toFixed(2)}s between shots`} · {selectedStats.range.toFixed(1)} tile range</p>
            <p>{selected.kills} enemies defeated</p>
            <div>{selected.level < 3 ? <button type="button" className="td-button td-primary" disabled={game.energy < defenseUpgradeCost(selected) || game.paused || ended} onClick={() => { upgradeDefense(game, selected.id); refresh(); }}>Upgrade · {defenseUpgradeCost(selected)}</button> : <span className="td-maxed">Maximum level</span>}<button type="button" className="td-button" disabled={game.paused || ended} onClick={() => { sellDefense(game, selected.id); refresh(); }}>Sell · {defenseSellValue(selected)}</button></div>
          </section>}
          <p className="td-tip">Cover several bends with one defense. Frost holds groups in place for Demolition; Precision handles armored Brutes and Wardens. Win by surviving all 20 waves.</p>
        </aside>
      </div>
    </div>
  </main>;
}
export default TowerDefenseGame;
