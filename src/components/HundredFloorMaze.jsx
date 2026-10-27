import { useCallback, useEffect, useRef, useState } from "react";
import { activateHundredFloorCompass, ascendHundredFloor, createHundredFloorRun, hundredFloorSaveKey, loadHundredFloorRun, nearHundredFloorStairs, saveHundredFloorRun, updateHundredFloorRun } from "../game/hundredFloorMaze.js";
import { drawHundredFloorMaze } from "../game/hundredFloorRendering.js";
import { recordActivePlay, flushPlayerProgress } from "../services/playerProgress.js";
import "../styles/hundredFloorMaze.css";

const timer = (seconds) => `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(Math.floor(seconds) % 60).padStart(2, "0")}`;
const snapshotOf = (world) => ({ floor: world.floor, theme: world.theme.name, elapsed: world.elapsed, completed: world.completed, nearStairs: nearHundredFloorStairs(world), haste: world.haste, sonar: world.sonar, compassCooldown: world.compassCooldown, message: world.messageTime > 0 || world.completed ? world.message : "Explore the floor. Green marks the stairs on your map." });

function TowerJoystick({ onMove }) {
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
  return <div className="hundred-joystick" role="group" aria-label="Movement joystick" onPointerDown={(event) => { event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={(event) => { if (pointer.current === event.pointerId) move(event); }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><span style={{ transform: `translate(${thumb.x * 25}px, ${thumb.y * 25}px)` }} /><small>MOVE</small></div>;
}

function HundredFloorRun({ onBack, playerName }) {
  const [world, setWorld] = useState(() => loadHundredFloorRun(playerName));
  const [snapshot, setSnapshot] = useState(() => snapshotOf(world));
  const [paused, setPaused] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const canvasRef = useRef(null);
  const keys = useRef({});
  const joystick = useRef({ x: 0, y: 0 });
  const stopped = useRef(false);
  const mapRef = useRef(false);
  const pauseRef = useRef(false);
  const dialogRef = useRef(null);
  const clearInput = useCallback(() => { keys.current = {}; joystick.current = { x: 0, y: 0 }; }, []);
  const persist = useCallback(() => { const saved = saveHundredFloorRun(playerName, world); setSaveFailed(!saved); return saved; }, [playerName, world]);
  const pause = useCallback((value) => { pauseRef.current = value; stopped.current = value || mapRef.current; setPaused(value); clearInput(); if (value) { persist(); flushPlayerProgress(playerName); } }, [clearInput, persist, playerName]);
  const showMap = useCallback((value) => { mapRef.current = value; stopped.current = value || pauseRef.current; setMapOpen(value); clearInput(); }, [clearInput]);
  const compass = useCallback(() => { if (!stopped.current && activateHundredFloorCompass(world)) setSnapshot(snapshotOf(world)); }, [world]);
  const climb = useCallback(() => { if (!stopped.current && ascendHundredFloor(world)) { clearInput(); persist(); setSnapshot(snapshotOf(world)); } }, [clearInput, persist, world]);
  const leave = () => { persist(); flushPlayerProgress(playerName); onBack(); };
  const restart = () => {
    const next = createHundredFloorRun();
    saveHundredFloorRun(playerName, next);
    clearInput(); pauseRef.current = false; mapRef.current = false; stopped.current = false;
    setPaused(false); setMapOpen(false); setRestartConfirm(false); setWorld(next); setSnapshot(snapshotOf(next));
  };

  useEffect(() => {
    const down = (event) => {
      if (event.target instanceof Element && event.target.closest("input, textarea, select")) return;
      const key = event.key.toLowerCase();
      if (restartConfirm) {
        if (key === "escape" && !event.repeat) { event.preventDefault(); setRestartConfirm(false); pause(true); }
        return;
      }
      if (key === "escape" && !event.repeat) { event.preventDefault(); if (mapRef.current) showMap(false); else if (!world.completed) pause(!pauseRef.current); return; }
      if (key === "m" && !event.repeat && !pauseRef.current && !world.completed) { event.preventDefault(); showMap(!mapRef.current); return; }
      if (stopped.current || world.completed) return;
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "q", "e"].includes(key)) event.preventDefault();
      keys.current[key] = true;
      if (!event.repeat && key === "q") compass();
      if (!event.repeat && key === "e") climb();
    };
    const up = (event) => { keys.current[event.key.toLowerCase()] = false; };
    const blur = () => { if (!world.completed) pause(true); clearInput(); };
    const visibility = () => { if (document.hidden) blur(); };
    const unload = () => { saveHundredFloorRun(playerName, world); flushPlayerProgress(playerName); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    window.addEventListener("pagehide", unload); document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); window.removeEventListener("pagehide", unload); document.removeEventListener("visibilitychange", visibility); clearInput(); };
  }, [clearInput, climb, compass, pause, playerName, restartConfirm, showMap, world]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    let viewport = { width: 1, height: 1, ratio: 1 };
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      viewport = { width: Math.max(1, bounds.width), height: Math.max(1, bounds.height), ratio: Math.min(2, window.devicePixelRatio || 1) };
      canvas.width = Math.round(viewport.width * viewport.ratio); canvas.height = Math.round(viewport.height * viewport.ratio);
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    updateHundredFloorRun(world, 0);
    let previous = 0;
    let refresh = 0;
    let saveTime = 0;
    let frame;
    const loop = (now) => {
      const dt = previous ? Math.min(.05, (now - previous) / 1000) : 0;
      previous = now;
      if (!stopped.current && !world.completed && !document.hidden) {
        const held = keys.current;
        updateHundredFloorRun(world, dt, { x: Number(Boolean(held.d || held.arrowright)) - Number(Boolean(held.a || held.arrowleft)) + joystick.current.x, y: Number(Boolean(held.s || held.arrowdown)) - Number(Boolean(held.w || held.arrowup)) + joystick.current.y });
        recordActivePlay(playerName, dt);
        saveTime += dt;
        if (saveTime > 5) { persist(); saveTime = 0; }
      }
      refresh += dt;
      if (refresh > .1) { setSnapshot(snapshotOf(world)); refresh = 0; }
      context.setTransform(viewport.ratio, 0, 0, viewport.ratio, 0, 0);
      drawHundredFloorMaze(context, world, viewport.width, viewport.height, mapRef.current);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); flushPlayerProgress(playerName); };
  }, [persist, playerName, world]);

  useEffect(() => {
    if (!paused && !snapshot.completed && !restartConfirm) { canvasRef.current?.focus({ preventScroll: true }); return; }
    const buttons = dialogRef.current?.querySelectorAll("button");
    buttons?.[0]?.focus({ preventScroll: true });
    const focusTrap = (event) => {
      if (event.key !== "Tab" || !buttons?.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
    };
    document.addEventListener("keydown", focusTrap);
    return () => document.removeEventListener("keydown", focusTrap);
  }, [paused, restartConfirm, snapshot.completed]);

  // Keep the latest world saved when this screen is removed; a restart owns its new save.
  const latest = useRef({ world, playerName });
  latest.current = { world, playerName };
  useEffect(() => () => { saveHundredFloorRun(latest.current.playerName, latest.current.world); }, []);

  const busy = paused || mapOpen || snapshot.completed || restartConfirm;
  return <main className="hundred-page">
    <header className="hundred-header">
      <div><span className="hundred-kicker">Mist Maze · The long climb</span><h1>Hundred-floor maze</h1><p>100 × 100 tiles per floor · 100 floors</p></div>
      <div className="hundred-stat"><strong>Floor {snapshot.floor}<small> / 100</small></strong><span>{snapshot.theme}</span><span>{timer(snapshot.elapsed)}</span></div>
      <div className="hundred-actions"><button type="button" onClick={() => pause(!paused)} disabled={snapshot.completed || restartConfirm}>{paused ? "Resume" : "Pause"}</button><button type="button" onClick={leave}>← First page</button></div>
    </header>
    <div className="hundred-progress" aria-label={`${snapshot.completed ? 100 : snapshot.floor - 1} of 100 floors cleared`}><span style={{ width: `${snapshot.completed ? 100 : snapshot.floor - 1}%` }} /></div>
    <div className="hundred-stage">
      <canvas className="hundred-canvas" ref={canvasRef} tabIndex="0" aria-label="Hundred-floor maze. WASD or arrows to move, E to climb nearby stairs, Q for a compass trail, M for the map, Escape to pause." />
      <div className="hundred-message" role="status">{saveFailed ? "Saving is unavailable in this browser. Keep this tab open to continue this run." : snapshot.message}</div>
      {!busy && <div className="hundred-touch"><TowerJoystick onMove={(next) => { joystick.current = next; }} /><button type="button" disabled={!snapshot.nearStairs} onClick={climb}>{snapshot.floor === 100 ? "SUMMIT" : "CLIMB"}<small>E</small></button></div>}
      {(paused || snapshot.completed || restartConfirm) && <div className="hundred-overlay"><section className="hundred-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="hundred-dialog-title">
        <span className="hundred-kicker">{snapshot.completed ? "100 floors cleared" : restartConfirm ? "Start a new climb" : saveFailed ? "Saving unavailable" : "Checkpoint saved"}</span>
        <h2 id="hundred-dialog-title">{restartConfirm ? "Restart from floor 1?" : snapshot.completed ? "You reached the summit." : "Climb paused"}</h2>
        <p>{restartConfirm ? `This replaces your saved climb on floor ${snapshot.floor}. Your other game progress stays saved.` : snapshot.completed ? `All 100 floors, each 10,000 tiles. Your climb took ${timer(snapshot.elapsed)}.` : saveFailed ? "Your browser could not save this climb. Keep this screen open to preserve your current position." : `Your position on floor ${snapshot.floor}, explored map, and power-ups are saved for this player name.`}</p>
        <div className="hundred-dialog-actions">{restartConfirm ? <><button type="button" onClick={() => { setRestartConfirm(false); if (!snapshot.completed) pause(true); }}>Keep this climb</button><button type="button" className="hundred-primary" onClick={restart}>Restart all 100 floors</button></> : <>{!snapshot.completed && <button type="button" className="hundred-primary" onClick={() => pause(false)}>Keep climbing</button>}<button type="button" onClick={leave}>Save and return</button><button type="button" onClick={() => { pause(true); setRestartConfirm(true); }}>Start a new climb</button></>}</div>
      </section></div>}
    </div>
    <footer className="hundred-footer">
      <div className="hundred-controls"><button type="button" onClick={compass} disabled={busy || snapshot.compassCooldown > 0}><kbd>Q</kbd> Compass {snapshot.compassCooldown > 0 ? `· ${Math.ceil(snapshot.compassCooldown)}s` : "· ready"}</button><button type="button" onClick={() => showMap(!mapOpen)} disabled={paused || snapshot.completed || restartConfirm}><kbd>M</kbd> {mapOpen ? "Close map" : "Floor map"}</button><button type="button" className="hundred-primary" onClick={climb} disabled={busy || !snapshot.nearStairs}><kbd>E</kbd> {snapshot.floor === 100 ? "Reach summit" : "Climb stairs"}</button><div className="hundred-buffs"><span className={snapshot.haste > 0 ? "is-active" : ""}>Haste {snapshot.haste > 0 ? `${Math.ceil(snapshot.haste)}s` : "· green diamond"}</span><span className={snapshot.sonar > 0 ? "is-active" : ""}>Sonar {snapshot.sonar > 0 ? `${Math.ceil(snapshot.sonar)}s` : "· cyan diamond"}</span></div></div>
      <p>WASD / arrows: move · Q: 10-second route hint · E: stairs · M: map · Esc: pause <span>Auto-saves every 5 seconds and at every staircase.</span></p>
    </footer>
  </main>;
}

export function HundredFloorMaze({ onBack, playerName }) {
  return <HundredFloorRun key={hundredFloorSaveKey(playerName)} onBack={onBack} playerName={playerName} />;
}
