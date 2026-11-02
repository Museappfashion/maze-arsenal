import { useCallback, useEffect, useRef, useState } from "react";
import { CUBE_DIMENSIONS, CUBE_STORIES, CUBE_STORY_HEIGHT, activateCubeCompass, createCubeMaze, cubeMazeSaveKey, loadCubeMaze, saveCubeMaze, updateCubeMaze } from "../game/cubeMaze.js";
import { drawCubeMaze } from "../game/cubeMazeRendering3D.js";
import { CubeMazeMinimap } from "./CubeMazeMinimap.jsx";
import { StatCard } from "./StatCard.jsx";
import { GAME_STYLES } from "../styles/gameStyles.js";
import { recordActivePlay, flushPlayerProgress } from "../services/playerProgress.js";
import "../styles/hundredFloorMaze.css";

const timer = (seconds) => `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(Math.floor(seconds) % 60).padStart(2, "0")}`;
const snapshotOf = (world) => ({
  elapsed: world.elapsed, completed: world.completed, x: world.player.x, y: world.player.y, z: world.player.z,
  story: Math.min(CUBE_STORIES, Math.floor(world.player.z / CUBE_STORY_HEIGHT) + 1),
  visited: world.visited.size, ramp: world.activeRamp?.riseStories || 0,
  haste: world.haste, sonar: world.sonar, compassCooldown: world.compassCooldown,
  message: world.messageTime > 0 || world.completed ? world.message : "Follow the passages and ramps toward the green summit beacon. Open the 3D map to plan your route.",
});

function CubeJoystick({ onMove, look = false }) {
  const pointer = useRef(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });
  const release = () => { pointer.current = null; onMove({ x: 0, y: 0 }); setThumb({ x: 0, y: 0 }); };
  const move = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) / (rect.width * .3);
    const y = (event.clientY - rect.top - rect.height / 2) / (rect.height * .3);
    const length = Math.max(1, Math.hypot(x, y));
    const next = { x: x / length, y: y / length };
    onMove(next); setThumb(next);
  };
  return <div className={`hundred-joystick ${look ? "cube-look-joystick" : ""}`} role="group" aria-label={look ? "Look joystick" : "Movement joystick"} onPointerDown={(event) => { event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={(event) => { if (pointer.current === event.pointerId) move(event); }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><span style={{ transform: `translate(${thumb.x * 25}px, ${thumb.y * 25}px)` }} /><small>{look ? "LOOK" : "MOVE"}</small></div>;
}

function CubeMazeRun({ onBack, playerName }) {
  const [world, setWorld] = useState(() => loadCubeMaze(playerName));
  const [snapshot, setSnapshot] = useState(() => snapshotOf(world));
  const [paused, setPaused] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const canvasRef = useRef(null), dialogRef = useRef(null), keys = useRef({});
  const joystick = useRef({ x: 0, y: 0 }), lookStick = useRef({ x: 0, y: 0 });
  const drag = useRef(null), stopped = useRef(false), mapRef = useRef(false), pauseRef = useRef(false);
  const clearInput = useCallback(() => { keys.current = {}; joystick.current = { x: 0, y: 0 }; lookStick.current = { x: 0, y: 0 }; drag.current = null; }, []);
  const persist = useCallback(() => { const saved = saveCubeMaze(playerName, world); setSaveFailed(!saved); return saved; }, [playerName, world]);
  const pause = useCallback((value) => { pauseRef.current = value; stopped.current = value || mapRef.current; setPaused(value); clearInput(); if (value) { persist(); flushPlayerProgress(); } }, [clearInput, persist]);
  const showMap = useCallback((value) => { mapRef.current = value; stopped.current = value || pauseRef.current; setMapOpen(value); clearInput(); if (value) { persist(); flushPlayerProgress(); } }, [clearInput, persist]);
  const compass = useCallback(() => { if (!stopped.current && activateCubeCompass(world)) setSnapshot(snapshotOf(world)); }, [world]);
  const leave = () => { persist(); flushPlayerProgress(); onBack(); };
  const restart = () => {
    const next = createCubeMaze();
    saveCubeMaze(playerName, next); clearInput(); pauseRef.current = false; mapRef.current = false; stopped.current = false;
    setPaused(false); setMapOpen(false); setRestartConfirm(false); setWorld(next); setSnapshot(snapshotOf(next));
  };

  useEffect(() => {
    const down = (event) => {
      const key = event.key.toLowerCase();
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select")) return;
      if (restartConfirm) {
        if (key === "escape" && !event.repeat) { event.preventDefault(); setRestartConfirm(false); pause(true); }
        return;
      }
      if (key === "escape" && !event.repeat) { event.preventDefault(); if (mapRef.current) showMap(false); else if (!world.completed) pause(!pauseRef.current); return; }
      if (key === "m" && !event.repeat && !pauseRef.current && !world.completed) { event.preventDefault(); showMap(!mapRef.current); return; }
      if (stopped.current || world.completed) return;
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "q", "pageup", "pagedown"].includes(key)) event.preventDefault();
      keys.current[key] = true;
      if (!event.repeat && key === "q") compass();
    };
    const up = (event) => { keys.current[event.key.toLowerCase()] = false; };
    const blur = () => { if (!world.completed) pause(true); clearInput(); };
    const visibility = () => { if (document.hidden) blur(); };
    const unload = () => { saveCubeMaze(playerName, world); flushPlayerProgress(); };
    // Capture releases even when map controls consume their own navigation keys.
    window.addEventListener("keydown", down); window.addEventListener("keyup", up, true); window.addEventListener("blur", blur);
    window.addEventListener("pagehide", unload); document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up, true); window.removeEventListener("blur", blur); window.removeEventListener("pagehide", unload); document.removeEventListener("visibilitychange", visibility); clearInput(); };
  }, [clearInput, compass, pause, playerName, restartConfirm, showMap, world]);

  useEffect(() => {
    const canvas = canvasRef.current, context = canvas.getContext("2d");
    let viewport = { width: 1, height: 1, ratio: 1 };
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      viewport = { width: Math.max(1, bounds.width), height: Math.max(1, bounds.height), ratio: Math.min(1.5, window.devicePixelRatio || 1) };
      canvas.width = Math.round(viewport.width * viewport.ratio); canvas.height = Math.round(viewport.height * viewport.ratio);
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(canvas);
    globalThis.__mistCubeMazeWorld = world;
    let previous = 0, refresh = 0, saveTime = 0, frame;
    const loop = (now) => {
      const dt = previous ? Math.max(0, Math.min(.05, (now - previous) / 1000)) : 0; previous = now;
      if (!stopped.current && !world.completed && !document.hidden) {
        const held = keys.current;
        updateCubeMaze(world, dt, {
          forward: Number(Boolean(held.w || held.arrowup)) - Number(Boolean(held.s || held.arrowdown)) - joystick.current.y,
          strafe: Number(Boolean(held.d)) - Number(Boolean(held.a)) + joystick.current.x,
          turn: Number(Boolean(held.arrowright)) - Number(Boolean(held.arrowleft)) + lookStick.current.x,
          look: Number(Boolean(held.pageup)) - Number(Boolean(held.pagedown)) - lookStick.current.y,
        });
        recordActivePlay(playerName, dt); saveTime += dt;
        if (saveTime > 5) { persist(); saveTime = 0; }
      }
      refresh += dt;
      if (refresh > .1) { setSnapshot(snapshotOf(world)); refresh = 0; }
      context.setTransform(viewport.ratio, 0, 0, viewport.ratio, 0, 0);
      drawCubeMaze(context, world, viewport.width, viewport.height, { playerName });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); flushPlayerProgress(); if (globalThis.__mistCubeMazeWorld === world) delete globalThis.__mistCubeMazeWorld; };
  }, [persist, playerName, world]);

  useEffect(() => {
    if (!paused && !mapOpen && !snapshot.completed && !restartConfirm) { canvasRef.current?.focus({ preventScroll: true }); return; }
    if (mapOpen) { document.querySelector(".cube-minimap-expanded .cube-map-canvas")?.focus({ preventScroll: true }); return; }
    const buttons = dialogRef.current?.querySelectorAll("button"); buttons?.[0]?.focus({ preventScroll: true });
    const focusTrap = (event) => {
      if (event.key !== "Tab" || !buttons?.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
    };
    document.addEventListener("keydown", focusTrap);
    return () => document.removeEventListener("keydown", focusTrap);
  }, [paused, mapOpen, restartConfirm, snapshot.completed]);

  const latest = useRef({ world, playerName }); latest.current = { world, playerName };
  useEffect(() => () => { saveCubeMaze(latest.current.playerName, latest.current.world); }, []);
  const busy = paused || mapOpen || snapshot.completed || restartConfirm;
  const pointerDown = (event) => { if (busy || event.button !== 0) return; event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; };
  const pointerMove = (event) => {
    const previous = drag.current;
    if (!previous || previous.id !== event.pointerId || busy) return;
    world.player.facing += (event.clientX - previous.x) * .006;
    world.player.pitch = Math.max(-.8, Math.min(.8, world.player.pitch - (event.clientY - previous.y) * .004));
    drag.current = { id: previous.id, x: event.clientX, y: event.clientY };
  };

  return <main className="hundred-page cube-page mode-3d">
    <style>{GAME_STYLES}</style>
    <div className="maze-game-shell">
      <section className="maze-stage hundred-stage" aria-label="The Cube 3D maze play area">
        <div className="maze-frame hundred-frame">
          <canvas className="hundred-canvas cube-canvas" ref={canvasRef} tabIndex="0" role="application" aria-label="The Cube. WASD to walk, arrows to move or turn, drag to look, Q for a route hint, M for the navigable 3D map, Escape to pause. Walk onto ramps to climb or descend." onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} />
          <div className="cube-view-title"><strong>THE CUBE</strong><span>Story {snapshot.story} · elevation {snapshot.z.toFixed(1)}{snapshot.ramp ? ` · ${snapshot.ramp}-story ramp` : ""}</span></div>
          <div className="hundred-message" role="status">{saveFailed ? "Saving is unavailable. Keep this tab open to preserve this maze run." : snapshot.message}</div>
          {!busy && <div className="hundred-touch cube-touch"><CubeJoystick onMove={(next) => { joystick.current = next; }} /><CubeJoystick look onMove={(next) => { lookStick.current = next; }} /></div>}
          {(paused || snapshot.completed || restartConfirm) && <div className="hundred-overlay"><section className="hundred-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cube-dialog-title">
            <span className="hundred-kicker">{snapshot.completed ? "Summit reached" : restartConfirm ? "Start a new maze" : saveFailed ? "Saving unavailable" : "Position saved"}</span>
            <h2 id="cube-dialog-title">{restartConfirm ? "Restart The Cube?" : snapshot.completed ? "You escaped The Cube." : "Maze paused"}</h2>
            <p>{restartConfirm ? "This replaces your saved Cube run with a new layout. Your original mazes, wallets, unlocks, and old Hundred Floors save stay unchanged." : snapshot.completed ? `You crossed the connected 3D maze in ${timer(snapshot.elapsed)}.` : saveFailed ? "The browser could not save your run. Keep this screen open to retain your position." : "Your position, explored junctions, and powerups save for this player name. Ramps remain connected when you return."}</p>
            <div className="hundred-dialog-actions">{restartConfirm ? <><button type="button" onClick={() => { setRestartConfirm(false); if (!snapshot.completed) pause(true); }}>Keep this maze</button><button type="button" className="hundred-primary" onClick={restart}>Start a new Cube</button></> : <>{!snapshot.completed && <button type="button" className="hundred-primary" onClick={() => pause(false)}>Keep exploring</button>}<button type="button" onClick={leave}>Save and return</button><button type="button" onClick={() => { pause(true); setRestartConfirm(true); }}>Start a new maze</button></>}</div>
          </section></div>}
        </div>
      </section>
      <aside className="maze-sidebar hundred-sidebar" aria-label="Cube maze status and controls">
        <CubeMazeMinimap world={world} expanded={mapOpen} onToggle={() => showMap(!mapRef.current)} />
        <header className="hundred-panel hundred-header">
          <h1>Mist Maze</h1><div className="hundred-kicker">The Cube · one connected 3D maze</div>
          <p>1,000 long × 100 wide × 1,000 tall. Walk through branching passages and ramps rising 1–10 stories. Reach the green summit beacon.</p>
        </header>
        <section className="hundred-panel" aria-label="Cube maze status">
          <h2>Status</h2>
          <div className="hundred-status-grid">
            <StatCard label="Story" value={`${snapshot.story} / ${CUBE_STORIES}`} />
            <StatCard label="Time" value={timer(snapshot.elapsed)} />
            <StatCard label="Elevation" value={`${snapshot.z.toFixed(1)} / ${CUBE_DIMENSIONS.height}`} />
            <StatCard label="Junctions mapped" value={snapshot.visited} />
            <StatCard label="Position" value={`${snapshot.x.toFixed(0)}, ${snapshot.y.toFixed(0)}`} />
            <StatCard label="Ramp" value={snapshot.ramp ? `${snapshot.ramp} stories` : "Level passage"} />
          </div>
          <div className="hundred-progress" aria-label={`Elevation ${Math.round(snapshot.z)} of 1000`}><span style={{ width: `${Math.min(100, snapshot.z / CUBE_DIMENSIONS.height * 100)}%` }} /></div>
          <div className="hundred-actions"><button type="button" onClick={() => pause(!paused)} disabled={snapshot.completed || restartConfirm || mapOpen}>{paused ? "Resume" : "Pause"}</button><button type="button" onClick={leave}>Back to first page</button></div>
        </section>
        <section className="hundred-panel">
          <h2>Powerups</h2>
          <div className="hundred-buffs"><span className={snapshot.haste > 0 ? "is-active" : ""}><i className="hundred-haste" /> Haste {snapshot.haste > 0 ? `· ${Math.ceil(snapshot.haste)}s` : "· faster movement"}</span><span className={snapshot.sonar > 0 ? "is-active" : ""}><i className="hundred-sonar" /> Sonar {snapshot.sonar > 0 ? `· ${Math.ceil(snapshot.sonar)}s` : "· reveals nearby routes"}</span></div>
          <div className="hundred-controls"><button type="button" onClick={compass} disabled={busy || snapshot.compassCooldown > 0}><kbd>Q</kbd> Compass {snapshot.compassCooldown > 0 ? `· ${Math.ceil(snapshot.compassCooldown)}s` : "· ready"}</button><button type="button" onClick={() => showMap(!mapOpen)} disabled={paused || snapshot.completed || restartConfirm}><kbd>M</kbd> {mapOpen ? "Close 3D map" : "Explore 3D map"}</button><button type="button" onClick={() => { world.player.pitch = 0; canvasRef.current?.focus(); }} disabled={busy}>Level view</button></div>
        </section>
        <section className="hundred-panel hundred-help"><h2>Controls</h2><p>Walk: WASD or left joystick<br />Turn: ← / → · look: drag or right joystick<br />Look up/down: Page Up / Page Down<br />Compass: Q · 3D map: M · Pause: Esc</p><p>Walk onto ramps to climb or descend. One story is {CUBE_STORY_HEIGHT} maze units. The world stays connected across its full height.</p><p>Auto-saves every 5 seconds. Previous Hundred Floors saves are kept separately.</p></section>
      </aside>
    </div>
  </main>;
}

// Keep the existing playtime-unlock route and import stable for saved profiles.
export function HundredFloorMaze({ onBack, playerName }) {
  return <CubeMazeRun key={cubeMazeSaveKey(playerName)} onBack={onBack} playerName={playerName} />;
}
