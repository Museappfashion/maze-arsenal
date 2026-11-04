import { useEffect, useRef, useState } from "react";
import { PLAYER_NAME_LIMIT, sanitizePlayerName } from "../utils/player.js";
import "../styles/firstTimePlayerName.css";

export function FirstTimePlayerName({ onSubmit }) {
  const [name, setName] = useState("");
  const card = useRef(null), input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);
  const clean = sanitizePlayerName(name);
  const submit = (event) => { event.preventDefault(); if (clean) onSubmit(clean); };
  const keys = (event) => {
    if (event.key === "Escape") { event.preventDefault(); return; }
    if (event.key !== "Tab") return;
    const controls = card.current.querySelectorAll("input,button:not(:disabled)");
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0].focus(); }
  };
  return <main className="first-identity-page">
    <form ref={card} className="first-identity-card" role="dialog" aria-modal="true" aria-labelledby="first-player-title" aria-describedby="first-player-description" onSubmit={submit} onKeyDown={keys}>
      <div className="first-identity-kicker">Mist Maze</div>
      <h1 id="first-player-title">Choose your player name</h1>
      <p id="first-player-description">Enter your name once for all game modes. It saves on this device and appears with your activity in the developer dashboard.</p>
      <label htmlFor="first-player-name">Player name</label>
      <input ref={input} id="first-player-name" type="text" value={name} maxLength={PLAYER_NAME_LIMIT} autoComplete="nickname" placeholder="Your name" required onChange={(event) => setName(event.target.value)} />
      <p className="first-identity-help">You can change it later using Player name on the first page.</p>
      <button type="submit" disabled={!clean}>Start exploring</button>
    </form>
  </main>;
}
