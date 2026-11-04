import { useEffect, useRef, useState } from "react";
import { StatCard } from "./StatCard.jsx";
import { ENEMY_TYPES } from "../config/enemies.js";
import { recordGameStarted, recordGameFinished, recordPlaySeconds } from "../services/developerAnalytics.js";
import { recordActivePlay, flushPlayerProgress } from "../services/playerProgress.js";
import { DEFENSE_COLUMNS, DEFENSE_ROWS, DEFENSE_LEVELS, getDefenseLevel, DEFENSE_TYPES, DEFENSE_WAVES, DEFENSE_MAX_LEVEL, DEFENSE_SPEEDS, createDefenseGame, placeDefense, upgradeDefense, sellDefense, startDefenseWave, stepDefense, setDefenseSpeed, defenseTowerStats, defenseStatSummary, defenseUpgradeCost, defenseSellValue, defenseWave, defenseWaveBrief } from "../game/towerDefense.js";
import { drawDefenseGame, drawDefensePowerIcon, DEFENSE_CANVAS_WIDTH, DEFENSE_CANVAS_HEIGHT } from "../game/towerDefenseRenderer.js";
import "../styles/towerDefense.css";

const powerKeys = Object.keys(DEFENSE_TYPES);
const powerShortcuts = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "j", "k", "h", "m", "i", "v", "l", "a", "f"];
export function TowerDefenseGame({ onBack, playerName }) {
  const gameRef = useRef(null);
  if (!gameRef.current) gameRef.current = createDefenseGame();
  const canvasRef = useRef(null), hoverRef = useRef(null), placingRef = useRef("rapidFire");
  const [revision, setRevision] = useState(0), [placing, setPlacing] = useState("rapidFire");
  const [pendingLevel,setPendingLevel]=useState(null);
  const refresh = () => setRevision((value) => value + 1);
  const game = gameRef.current;
  const selected = game.towers.find((tower) => tower.id === game.selectedId);
  const ended = game.status === "defeat" || game.status === "victory";
  const selectedStats = selected && defenseTowerStats(selected);
  const analytics = useRef({ game:null, seconds:0, finished:false });
  const levelDialog = useRef(null);
  useEffect(()=>{if(pendingLevel)levelDialog.current?.querySelector("button")?.focus({preventScroll:true});},[pendingLevel]);
  function flushDefenseAnalytics() {
    const seconds=Math.floor(analytics.current.seconds);
    if(seconds>0){analytics.current.seconds-=seconds;void recordPlaySeconds({playerName},seconds);}
  }
  function updateDefenseAnalytics(current, active=0) {
    if(analytics.current.game!==current){flushDefenseAnalytics();analytics.current={game:current,seconds:0,finished:false};void recordGameStarted({playerName});}
    analytics.current.seconds+=active;
    if(analytics.current.seconds>=30)flushDefenseAnalytics();
    if(["defeat","victory"].includes(current.status)&&!analytics.current.finished){analytics.current.finished=true;flushDefenseAnalytics();void recordGameFinished({playerName});}
  }

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = DEFENSE_CANVAS_WIDTH * dpr; canvas.height = DEFENSE_CANVAS_HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let frame, previous = performance.now(), lastUi = 0;
    const animate = (now) => {
      const dt = Math.max(0, Math.min((now - previous) / 1000, .1)); previous = now;
      const current = gameRef.current;
      updateDefenseAnalytics(current);
      if (!document.hidden && current.status === "running" && !current.paused) {
        const active=stepDefense(current,dt);recordActivePlay(playerName,active);updateDefenseAnalytics(current,active);
      }
      drawDefenseGame(ctx, current, hoverRef.current, placingRef.current);
      if (now - lastUi > 120) { lastUi = now; setRevision((value) => value + 1); }
      frame = requestAnimationFrame(animate);
    };
    const suspend = () => {
      const current = gameRef.current;
      if (current.status === "running") { current.paused = true; current.message = "Paused while you were away. Resume when ready."; }
      previous = performance.now(); flushPlayerProgress(); flushDefenseAnalytics(); setRevision((value) => value + 1);
    };
    const visibility = () => { if (document.hidden) suspend(); previous = performance.now(); };
    window.addEventListener("blur", suspend); window.addEventListener("pagehide", suspend);
    document.addEventListener("visibilitychange", visibility);
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("blur", suspend); window.removeEventListener("pagehide", suspend); document.removeEventListener("visibilitychange", visibility); flushPlayerProgress(); flushDefenseAnalytics(); };
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
  function restart() { flushPlayerProgress(); flushDefenseAnalytics(); gameRef.current = createDefenseGame(gameRef.current.levelKey); hoverRef.current = null; refresh(); }
  function changeLevel(key) {
    const current=gameRef.current;
    if(key===current.levelKey)return;
    if(!["defeat","victory"].includes(current.status)&&(current.wave>0||current.towers.length)) {
      setPendingLevel({key,wasPaused:current.paused});current.paused=true;flushPlayerProgress();refresh();return;
    }
    flushPlayerProgress();flushDefenseAnalytics();gameRef.current=createDefenseGame(key);hoverRef.current=null;refresh();
  }
  function cancelLevelChange() {gameRef.current.paused=pendingLevel.wasPaused;setPendingLevel(null);refresh();}
  function confirmLevelChange() {flushDefenseAnalytics();gameRef.current=createDefenseGame(pendingLevel.key);hoverRef.current=null;setPendingLevel(null);refresh();}

  function boardKeys(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || pendingLevel) return;
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
      event.preventDefault(); const at = hoverRef.current || { x: 1, y: 1 };
      hoverRef.current = { x: Math.max(0, Math.min(DEFENSE_COLUMNS - 1, at.x + (key === "arrowright" ? 1 : key === "arrowleft" ? -1 : 0))), y: Math.max(0, Math.min(DEFENSE_ROWS - 1, at.y + (key === "arrowdown" ? 1 : key === "arrowup" ? -1 : 0))) };
      refresh();
    } else if (key === "enter") { event.preventDefault(); const at = hoverRef.current || { x: 1, y: 1 }; chooseTile(at.x, at.y); }
    else if (key === " ") { event.preventDefault(); if (game.status === "building") startDefenseWave(game); else togglePause(); refresh(); }
    else if (key === "p") { event.preventDefault(); togglePause(); }
    else if (key === "s") { event.preventDefault(); setDefenseSpeed(game, DEFENSE_SPEEDS[(DEFENSE_SPEEDS.indexOf(game.speed) + 1) % DEFENSE_SPEEDS.length]); refresh(); }
    else if (powerShortcuts.includes(key)) { event.preventDefault(); choose(powerKeys[powerShortcuts.indexOf(key)]); }
    else if (key === "escape") { game.selectedId = null; hoverRef.current = null; refresh(); }
  }
  const previewWave = Math.min(DEFENSE_WAVES, game.status === "building" ? game.wave + 1 : game.wave || 1);
  const wavePreview = [...new Set(defenseWave(previewWave))].map((key) => ENEMY_TYPES[key].label).join(" · ");
  return <main className="td-screen" data-revision={revision}>
    <section className="td-arena-panel" aria-label="Defense arena">
      <div className="td-canvas-wrap">
        <canvas ref={canvasRef} className="td-canvas" tabIndex={0} role="application" aria-label="Tower defense board. Select a powerup, then click an empty tile. Keyboard: arrows choose tile, Enter places or selects, keys 1 to 9, 0, minus and the displayed letter choose a powerup, Space starts or pauses, S changes speed." aria-describedby="td-board-help" onKeyDown={boardKeys}
          onPointerMove={(event) => { hoverRef.current = pointerTile(event); }} onPointerLeave={() => { hoverRef.current = null; }}
          onPointerDown={(event) => { if (event.button !== 0) return; event.currentTarget.focus({ preventScroll: true }); const tile = pointerTile(event); chooseTile(tile.x, tile.y); }} />
        <div className="td-arena-label"><strong>POWERUP DEFENSE</strong><span>{getDefenseLevel(game).title} · Wave {game.wave || 1} / {DEFENSE_WAVES}</span></div>
        <div className="td-arena-message" role="status">{game.message}</div>
        {(game.paused || ended) && <div className="td-overlay"><div><p className="td-kicker">{ended ? "RUN COMPLETE" : "TAKE YOUR TIME"}</p><h2>{game.status === "victory" ? "Core protected!" : game.status === "defeat" ? "The core has fallen" : "Paused"}</h2><p>{ended ? `${game.kills} enemies defeated · ${game.wave} waves reached` : "Your defenses and enemies are waiting."}</p><button type="button" className="td-button td-primary" onClick={ended ? restart : togglePause}>{ended ? "Play again" : "Resume battle"}</button></div></div>}
      </div>
    </section>
    <aside className="td-sidebar" aria-label="Defense HUD">
      <header className="td-header">
        <div><p className="td-kicker">MIST MAZE · SURVIVAL</p><h1>Powerup Defense</h1></div>
        <button className="td-button td-back" type="button" onClick={() => { flushPlayerProgress(); flushDefenseAnalytics(); onBack(); }}>Back to first page</button>
      </header>
      <section className="td-level-select" aria-label="Tower defense levels">
        {Object.values(DEFENSE_LEVELS).map(level=><button key={level.key} type="button" className={`td-button ${game.levelKey===level.key?"td-level-active":""}`} aria-pressed={game.levelKey===level.key} onClick={()=>changeLevel(level.key)}>{level.title}</button>)}
      </section>
      <div className="td-live-hud">
        <section className="td-stats" aria-label="Battle status">
          <StatCard label="Core health" value={<strong className={game.lives <= 5 ? "td-danger" : ""}>{game.lives} / 20{game.coreShield > 0 && <small className="td-core-shield"> +{game.coreShield} shield</small>}</strong>} />
          <StatCard label="Energy" value={<strong className="td-energy">{game.energy}</strong>} />
          <StatCard label="Wave" value={<strong>{game.wave} / {DEFENSE_WAVES}</strong>} />
          <StatCard label="Defeated" value={<strong>{game.kills}</strong>} />
        </section>
        <div className="td-battle-controls">
          {game.status === "building" && <button type="button" className="td-button td-primary" onClick={() => { startDefenseWave(game); refresh(); }}>Start wave {game.wave + 1}</button>}
          {game.status === "running" && <button type="button" className="td-button td-primary" onClick={togglePause}>{game.paused ? "Resume" : "Pause"}</button>}
          <div className="td-speed-controls" role="group" aria-label="Battle speed">{DEFENSE_SPEEDS.map((speed) => <button key={speed} type="button" className={`td-button ${game.speed === speed ? "td-speed-active" : ""}`} aria-pressed={game.speed === speed} disabled={ended} onClick={() => { setDefenseSpeed(game, speed); refresh(); }}>{speed}×</button>)}</div>
          {!ended && <button type="button" className="td-button td-restart" onClick={restart}>Restart</button>}
        </div>
        {selected && <section className="td-upgrade" aria-label="Selected defense">
          <h3>{selectedStats.label} <span>Lv. {selected.level}</span></h3>
          <p className="td-current-stats"><strong>Current:</strong> {defenseStatSummary(selected)}</p>
          <p className="td-next-stats">{selected.level < DEFENSE_MAX_LEVEL ? <><strong>Next · Lv. {selected.level + 1}:</strong> {defenseStatSummary({ ...selected, level: selected.level + 1 })}</> : <strong>Maximum level · these are your final stats.</strong>}</p>
          <p>{selected.kills} enemies defeated</p>
          <div>{selected.level < DEFENSE_MAX_LEVEL ? <button type="button" className="td-button td-primary" disabled={game.energy < defenseUpgradeCost(selected) || game.paused || ended} onClick={() => { upgradeDefense(game, selected.id); refresh(); }}>Upgrade · {defenseUpgradeCost(selected)}</button> : <span className="td-maxed">Maximum level</span>}<button type="button" className="td-button" disabled={game.paused || ended} onClick={() => { sellDefense(game, selected.id); refresh(); }}>Sell · {defenseSellValue(selected)}</button></div>
        </section>}
      </div>
      <div className="td-shop" aria-label="Powerup defenses">
        <div className="td-shop-heading"><h2>Powerups</h2><p>Select a powerup, then place it beside the enemy route.</p></div>
        <div className="td-power-grid">{powerKeys.map((key, index) => {
          const type = DEFENSE_TYPES[key];
          return <button key={key} type="button" className={`td-power ${placing === key ? "td-power-selected" : ""}`} aria-pressed={placing === key} onClick={() => choose(key)} style={{ "--td-power-color": type.color }}>
            <DefensePowerIcon type={key} /><span className="td-power-copy"><strong>{type.label}</strong><small>{type.description}</small><b>{type.cost} energy <span>· key {powerShortcuts[index]}</span></b></span>
          </button>;
        })}</div>
        <div className="td-wave-details">{(game.coreRepairs > 0 || game.coreDamageBlocked > 0) && <p className="td-wave-preview">Core support · {game.coreRepairs} health repaired · {game.coreDamageBlocked} damage blocked</p>}<p className="td-wave-preview">{game.status === "building" ? "Next wave" : "This wave"}: {defenseWave(previewWave).length} enemies · {wavePreview}</p><p className="td-wave-traits">{defenseWaveBrief(previewWave)}</p></div>
        <p className="td-tip">Cover several bends with one defense. Frost holds groups in place for Demolition; Precision handles armored Brutes and Wardens. Choose from all twenty powers: add slams, piercing rounds, drain bolts, sweeps, barrages and phase burns to your damage, then combine support fields, repairs and shields. Upgrade through six tiers to survive all 60 waves.</p>
        <p id="td-board-help" className="td-help">Click or tap an empty tile to build; select a defense to upgrade or sell. Arrows + Enter to build · 1–9, 0, − and displayed letters choose powerup · Space starts or pauses · S changes speed. Energy resets each run; playtime counts real active time at every speed.</p>
      </div>
    </aside>
    {pendingLevel&&<div className="td-level-modal" ref={levelDialog} onKeyDown={(event)=>{
      if(event.key==="Escape"){event.preventDefault();cancelLevelChange();return;}
      if(event.key!=="Tab")return;const buttons=levelDialog.current.querySelectorAll("button");
      if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons[buttons.length-1].focus();}
      else if(!event.shiftKey&&document.activeElement===buttons[buttons.length-1]){event.preventDefault();buttons[0].focus();}
    }} role="alertdialog" aria-modal="true" aria-labelledby="td-level-change-title"><section><p className="td-kicker">CHANGE DEFENSE LEVEL</p><h2 id="td-level-change-title">Start {getDefenseLevel(pendingLevel.key).title}?</h2><p>This starts a fresh defense battle on the selected map. Your player profile, currencies, cosmetics, and maze progress stay saved.</p><div><button type="button" className="td-button" onClick={cancelLevelChange}>Keep this battle</button><button type="button" className="td-button td-primary" onClick={confirmLevelChange}>Start selected level</button></div></section></div>}
  </main>;
}

function DefensePowerIcon({ type }) {
  const canvas = useRef(null);
  useEffect(() => { drawDefensePowerIcon(canvas.current.getContext("2d"), type); }, [type]);
  return <canvas ref={canvas} className="td-power-symbol" width="44" height="44" aria-hidden="true" />;
}
export default TowerDefenseGame;
