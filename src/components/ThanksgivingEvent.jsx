import { useCallback, useEffect, useRef, useState } from "react";
import { FARM_POWERUPS, FARM_WIDTH, FARM_HEIGHT } from "../config/thanksgiving.js";
import { activateThanksgivingPower, createThanksgivingWorld, getThanksgivingSnapshot, updateThanksgivingWorld } from "../game/thanksgiving.js";
import { drawThanksgivingWorld } from "../game/thanksgivingRendering.js";
import { buyFarmSupply, earnHux, loadHuxState, recordTurkeyRescues, saveFarmInventory } from "../services/huxEconomy.js";
import { isThanksgivingOpen, THANKSGIVING_DATE_LABEL } from "../services/thanksgivingSeason.js";
import { ThanksgivingArtwork } from "./ThanksgivingArtwork.jsx";
import { TurkeyCosmeticCard } from "./TurkeyCosmeticCard.jsx";
import { useHuxWallet } from "./useHuxWallet.js";
import "../styles/thanksgiving.css";

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function FarmStore({ wallet, onClose }) {
  const [message, setMessage] = useState("");
  return (
    <section className="farm-store" aria-label="Farm supply store">
      <header><div><span className="farm-eyebrow">The harvest trading post</span><h2>Farm supply store</h2></div><button className="farm-button farm-quiet" onClick={onClose} type="button" aria-label="Close farm store">Close ×</button></header>
      <p>Trade corn-earned hux for farm supplies. Each supply purchase adds one use to your bag. Character cosmetics below use MIZ and are permanent.</p>
      <div className="farm-store-grid">
        {FARM_POWERUPS.map((item) => (
          <article className="farm-store-item" key={item.id}>
            <span className="farm-supply-icon" style={{ color: item.color }} aria-hidden="true">{item.icon}</span>
            <h3>{item.name}</h3><p>{item.description}</p>
            <div className="farm-item-meta"><strong>{item.price} hux</strong><span>{wallet.inventory[item.id]} in bag</span></div>
            <button className="farm-button" type="button" disabled={wallet.hux < item.price || wallet.inventory[item.id] >= 99} onClick={() => setMessage(buyFarmSupply(item.id).message)} aria-label={`Buy ${item.name} for ${item.price} hux`}>{wallet.inventory[item.id] >= 99 ? "Bag full" : wallet.hux < item.price ? `Need ${item.price - wallet.hux} hux` : "Buy supply"}</button>
          </article>
        ))}
      </div>
      <TurkeyCosmeticCard onMessage={setMessage} />
      <TurkeyCosmeticCard onMessage={setMessage} cosmetic="alien" />
      <p className="farm-store-message" role="status">{message || "You can also find free power-ups along the farm lanes."}</p>
    </section>
  );
}

function FarmJoystick({ onMove }) {
  const [thumb, setThumb] = useState({ x: 0, y: 0 });
  const pointer = useRef(null);
  const update = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) / (rect.width * .32);
    const y = (event.clientY - rect.top - rect.height / 2) / (rect.height * .32);
    const distance = Math.max(1, Math.hypot(x, y));
    const position = { x: x / distance, y: y / distance };
    setThumb(position);
    onMove(position);
  };
  const release = () => { pointer.current = null; setThumb({ x: 0, y: 0 }); onMove({ x: 0, y: 0 }); };
  return <div className="farm-joystick" role="group" aria-label="Touch movement joystick" onPointerDown={(event) => {
    event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); update(event);
  }} onPointerMove={(event) => { if (pointer.current === event.pointerId) update(event); }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><span style={{ transform: `translate(${thumb.x * 28}px, ${thumb.y * 28}px)` }}/><small>MOVE</small></div>;
}

function ThanksgivingRun({ onLeave, onRestart, wallet }) {
  const [world] = useState(() => createThanksgivingWorld({ inventory: loadHuxState().inventory }));
  const [snapshot, setSnapshot] = useState(() => getThanksgivingSnapshot(world));
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const canvasRef = useRef(null);
  const resultRef = useRef(null);
  const keys = useRef({});
  const joystick = useRef({ x: 0, y: 0 });
  const touchRescue = useRef(false);
  const accounted = useRef({ corn: 0, rescued: 0, bag: JSON.stringify(world.inventory) });

  const clearInput = useCallback(() => { keys.current = {}; joystick.current = { x: 0, y: 0 }; touchRescue.current = false; }, []);
  const setPause = useCallback((value) => {
    pausedRef.current = value; setPaused(value); clearInput();
  }, [clearInput]);
  const persistProgress = useCallback(() => {
    const previous = accounted.current;
    if (world.cornCollected > previous.corn) earnHux(world.cornCollected - previous.corn);
    if (world.rescued > previous.rescued) recordTurkeyRescues(world.rescued - previous.rescued, world.rescued);
    const bag = JSON.stringify(world.inventory);
    if (bag !== previous.bag) saveFarmInventory(world.inventory);
    accounted.current = { corn: world.cornCollected, rescued: world.rescued, bag };
  }, [world]);
  const activate = useCallback((id) => {
    if (pausedRef.current || world.caught) return;
    activateThanksgivingPower(world, id);
    persistProgress();
    setSnapshot(getThanksgivingSnapshot(world));
  }, [persistProgress, world]);

  useEffect(() => {
    const down = (event) => {
      const key = event.key.toLowerCase();
      if (key === "escape" && !event.repeat && !world.caught) { setPause(!pausedRef.current); return; }
      if (pausedRef.current || world.caught) return;
      if (key === " " && event.target instanceof Element && event.target.closest("button")) return;
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d", "e"].includes(key)) event.preventDefault();
      keys.current[key] = true;
      if (!event.repeat) {
        const power = FARM_POWERUPS.find((item) => String(item.key) === key);
        if (power) activate(power.id);
      }
    };
    const up = (event) => { keys.current[event.key.toLowerCase()] = false; };
    const blur = () => { if (!world.caught) setPause(true); else clearInput(); };
    const hidden = () => { if (document.hidden) blur(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", hidden);
      clearInput(); persistProgress();
    };
  }, [activate, clearInput, persistProgress, setPause, world]);

  useEffect(() => {
    if (!paused && !snapshot.caught) { canvasRef.current?.focus({ preventScroll: true }); return; }
    const buttons = resultRef.current?.querySelectorAll("button");
    buttons?.[0]?.focus({ preventScroll: true });
    const keepFocus = (event) => {
      if (event.key !== "Tab" || !buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keepFocus);
    return () => document.removeEventListener("keydown", keepFocus);
  }, [paused, snapshot.caught]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    let viewport = { width: 1, height: 1, ratio: 1 };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      viewport = { width: rect.width, height: rect.height, ratio };
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    let frame;
    let lastTime = 0;
    let refresh = 0;
    const loop = (now) => {
      const dt = lastTime ? Math.min(.05, (now - lastTime) / 1000) : 0;
      lastTime = now;
      const wasCaught = world.caught;
      if (!pausedRef.current && !world.caught) {
        const held = keys.current;
        updateThanksgivingWorld(world, dt, {
          x: Number(Boolean(held.d || held.arrowright)) - Number(Boolean(held.a || held.arrowleft)) + joystick.current.x,
          y: Number(Boolean(held.s || held.arrowdown)) - Number(Boolean(held.w || held.arrowup)) + joystick.current.y,
          rescue: Boolean(held.e || held[" "] || touchRescue.current),
        });
        persistProgress();
      }
      refresh += dt;
      if (refresh > .1 || world.caught !== wasCaught) { setSnapshot(getThanksgivingSnapshot(world)); refresh = 0; }
      context.setTransform(viewport.ratio, 0, 0, viewport.ratio, 0, 0);
      drawThanksgivingWorld(context, world, viewport.width, viewport.height, { pixelRatio: viewport.ratio });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [persistProgress, world]);

  return (
    <div className="farm-game">
      <header className="farm-game-header">
        <div className="farm-game-title"><span className="farm-eyebrow">Thanksgiving escape</span><strong>Free the flock</strong></div>
        <div className="farm-run-stats"><span><strong>{snapshot.rescued}</strong> freed</span><span><strong>{wallet.hux}</strong> hux <small>(+{snapshot.cornCollected})</small></span><span>{clock(snapshot.time)}</span></div>
        <div className="farm-game-actions"><button type="button" className="farm-button farm-quiet" onClick={() => setPause(!pausedRef.current)} disabled={snapshot.caught}>{paused ? "Resume" : "Pause"}</button><button type="button" className="farm-button farm-quiet" onClick={onLeave}>Farm menu</button></div>
      </header>
      <div className="farm-canvas-wrap">
        <canvas ref={canvasRef} className="farm-canvas" aria-label="Turkey rescue farm. Use WASD or arrow keys to move, hold E near a cage to rescue, and press 1 and 2 for power-ups." tabIndex="0"/>
        <div className="farm-run-message" role="status">{snapshot.nearCage ? "Hold E or FREE to open this cage" : snapshot.message || "Find a cage. Free a friend. Keep moving."}</div>
        <div className="farm-touch-controls">
          <FarmJoystick key={paused ? "paused" : "moving"} onMove={(position) => { joystick.current = position; }}/>
          <button type="button" className={`farm-rescue-button${snapshot.nearCage ? " nearby" : ""}`} aria-label="Hold to free turkey" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); touchRescue.current = true; }} onPointerUp={() => { touchRescue.current = false; }} onPointerCancel={() => { touchRescue.current = false; }} onLostPointerCapture={() => { touchRescue.current = false; }}>FREE<small>HOLD</small></button>
        </div>
        {(paused || snapshot.caught) && <div className="farm-run-overlay"><section ref={resultRef} className="farm-result" role="dialog" aria-modal="true" aria-labelledby="farm-result-title">
          <span className="farm-eyebrow">{snapshot.caught ? "Back to the barn" : "Take a breather"}</span>
          <h1 id="farm-result-title">{snapshot.caught ? "The farmer caught you!" : "Farm paused"}</h1>
          <p>{snapshot.caught ? "Every turkey you freed made a difference. Your hux and unused supplies are saved." : "Your flock can wait. The farmer is paused too."}</p>
          <div className="farm-result-stats"><span><strong>{snapshot.rescued}</strong>turkeys freed</span><span><strong>+{snapshot.cornCollected}</strong>hux earned</span><span><strong>{clock(snapshot.time)}</strong>time survived</span></div>
          <div className="farm-result-actions">{snapshot.caught ? <button type="button" className="farm-button farm-primary" onClick={onRestart}>Try again</button> : <button type="button" className="farm-button farm-primary" onClick={() => setPause(false)}>Keep rescuing</button>}<button type="button" className="farm-button" onClick={onLeave}>Back to farm menu</button></div>
        </section></div>}
      </div>
      <footer className="farm-game-footer">
        <div className="farm-power-bar" aria-label="Power-up bag">{FARM_POWERUPS.map((item) => <button type="button" className="farm-power" key={item.id} disabled={paused || snapshot.caught || !snapshot.inventory[item.id]} onClick={() => activate(item.id)} title={`${item.description} — press ${item.key}`} aria-label={`Use ${item.name}, ${snapshot.inventory[item.id] || 0} available`}><kbd>{item.key}</kbd><span className="farm-power-icon" style={{ color: item.color }}>{item.icon}</span><span>{item.name}<small>{snapshot.effects[item.id] > 0 ? `${Math.ceil(snapshot.effects[item.id])}s active` : `${snapshot.inventory[item.id] || 0} in bag`}</small></span></button>)}</div>
        <p className="farm-key-guide">WASD / arrows: move · Hold E / Space: free turkey · 1–5: power-ups · Esc: pause <span>Farmer speed: 1.1× yours</span></p>
      </footer>
    </div>
  );
}

export function ThanksgivingEvent({ onBack }) {
  const wallet = useHuxWallet();
  const [shopOpen, setShopOpen] = useState(false);
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [available, setAvailable] = useState(isThanksgivingOpen);
  useEffect(() => {
    const timer = window.setInterval(() => setAvailable(isThanksgivingOpen()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const start = () => {
    if (!isThanksgivingOpen()) { setAvailable(false); return; }
    setRun((value) => value + 1); setPlaying(true);
  };
  if (playing) return <ThanksgivingRun key={run} wallet={wallet} onLeave={() => setPlaying(false)} onRestart={() => { if (!isThanksgivingOpen()) setPlaying(false); start(); }}/>;
  return (
    <div className="farm-page">
      <main className="farm-content">
        <header className="farm-header">
          <div><span className="farm-eyebrow">Mist Maze · Harvest special</span><h1>Choose your escape.</h1></div>
          <div className="farm-header-actions"><span className="farm-wallet" aria-label={`${wallet.hux} hux available`}><span aria-hidden="true">🌽</span> {wallet.hux.toLocaleString()} <small>hux</small></span><button type="button" className="farm-button" onClick={() => setShopOpen(!shopOpen)} aria-expanded={shopOpen} aria-controls="farm-shop">Farm supply store</button><button type="button" className="farm-button farm-quiet" onClick={onBack}>← Back to first page</button></div>
        </header>
        <div className="farm-season-strip"><span className="farm-season-badge">Only until Thanksgiving</span><span>Through {THANKSGIVING_DATE_LABEL} · A little courage. A lot of gobbling.</span></div>
        {shopOpen && <div id="farm-shop"><FarmStore wallet={wallet} onClose={() => setShopOpen(false)}/></div>}
        <div className="farm-lobby-grid">
          <article className="farm-adventure">
            <div className="farm-art-wrap"><ThanksgivingArtwork/><span className="farm-art-tag">SEASONAL · TURKEY RESCUE</span></div>
            <div className="farm-adventure-copy"><div className="farm-eyebrow">Welcome to the countryside</div><h2>Free the flock</h2><p>You're a turkey with a very important job. Weave through crowded farm passages, open cages, and get as many friends out as you can before the farmer catches you.</p><div className="farm-tags"><span>{FARM_WIDTH} × {FARM_HEIGHT} farm</span><span>Tangled paths</span><span>Endless rescues</span></div><button type="button" className="farm-button farm-primary farm-start" onClick={start} disabled={!available}>{available ? "Enter the farm →" : "This harvest has ended"}</button></div>
          </article>
          <aside className="farm-field-notes">
            <span className="farm-eyebrow">A turkey's field notes</span><h2>Stay one step ahead.</h2>
            <ol><li><strong>Find a way through.</strong><span>Same size as Abandoned City, packed with tangled paths, bent chicken-wire walls, hay bales, carts, and crates. You and the farmer start in random places.</span></li><li><strong>Leave no bird behind.</strong><span>Caged turkeys keep appearing at random. Get close and hold E or the FREE button to rescue them.</span></li><li><strong>Snack, then outsmart.</strong><span>Every corn piece is 1 hux. The farmer runs at 1.1× your normal speed, so collect supplies and use them to get away.</span></li></ol>
            <div className="farm-records"><div><strong>{wallet.bestRescued}</strong><span>Best flock freed</span></div><div><strong>{wallet.totalRescued}</strong><span>All-time rescues</span></div></div>
            <p className="farm-save-note">Your hux, supplies, and rescue records are saved in this browser.</p>
          </aside>
        </div>
        <section className="farm-bag-preview" aria-label="Your escape supplies"><div><span className="farm-eyebrow">Packed for the escape</span><h2>Your supply bag</h2></div><div className="farm-bag-items">{FARM_POWERUPS.map((item) => <div key={item.id} title={item.description}><span style={{ color: item.color }}>{item.icon}</span><span>{item.name}<small>{wallet.inventory[item.id]} ready</small></span></div>)}</div><p>Find free supplies in the lanes, or spend your hux at the farm store. Use keys 1–5 or tap a supply during your run.</p></section>
      </main>
    </div>
  );
}
