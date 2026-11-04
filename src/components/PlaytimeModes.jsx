import { useEffect, useState } from "react";
import { getPlayerProgress, MODE_UNLOCK_SECONDS, PLAYER_PROGRESS_EVENT } from "../services/playerProgress.js";
import { getPlayerDisplayName, PLAYER_NAME_LIMIT } from "../utils/player.js";
import "../styles/playtimeModes.css";

const duration = (seconds) => `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
export function PlaytimeModes({ playerName, onPlayerNameChange, onOpenMode }) {
  const [draft, setDraft] = useState(playerName);
  const [progress, setProgress] = useState(() => getPlayerProgress(playerName));
  useEffect(() => {
    setDraft(playerName);
    const refresh = () => setProgress(getPlayerProgress(playerName));
    refresh(); window.addEventListener(PLAYER_PROGRESS_EVENT, refresh);
    return () => window.removeEventListener(PLAYER_PROGRESS_EVENT, refresh);
  }, [playerName]);
  const apply = (event) => { event.preventDefault(); onPlayerNameChange(draft); };
  return <section className="playtime-modes" aria-label="Playtime unlocks">
    <div className="playtime-heading"><div><div className="selector-kicker">Keep exploring</div><h2>Playtime unlocks</h2></div><span>{getPlayerDisplayName(playerName)} · {duration(progress.playedSeconds)} played</span></div>
    <form onSubmit={apply} className="playtime-player-form">
      <label htmlFor="progress-player">Player name<input id="progress-player" required autoComplete="nickname" maxLength={PLAYER_NAME_LIMIT} placeholder="You" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
      <button type="submit">Use name</button>
    </form>
    <p className="playtime-note">Active play across all modes counts for this name. Progress saves in this browser; menus, paused games, and hidden tabs do not count.</p>
    {progress.special && <p className="playtime-gift" role="status">Special name active · both modes unlocked · one-time gift: 1,000,000 MIZ + 10,000 hux.</p>}
    <div className="playtime-cards">
      {[{ id: "towerDefense", title: "Powerup Defense", eyebrow: "Unlock at 1 hour", text: "Choose from four maze levels and all 20 powerups. Build damaging defenses and protect the core through 60 increasingly difficult waves." }, { id: "hundredFloor", title: "The Cube", eyebrow: "Unlock at 2 hours", text: "Explore one connected 100 × 100 × 100 maze. Ride lifts and walk ramps spanning 1–10 stories, with an interactive 3D minimap." }].map((mode) => <article className="playtime-card" key={mode.id}>
        <span className="selector-kicker">{mode.eyebrow}</span><h3>{mode.title}</h3><p>{mode.text}</p>
        <progress aria-label={`${mode.title} unlock progress`} value={progress[mode.id] ? MODE_UNLOCK_SECONDS[mode.id] : progress.playedSeconds} max={MODE_UNLOCK_SECONDS[mode.id]} />
        <button type="button" disabled={!progress[mode.id]} onClick={() => onOpenMode(mode.id)}>{progress[mode.id] ? `Enter ${mode.title}` : `${Math.ceil((MODE_UNLOCK_SECONDS[mode.id] - progress.playedSeconds) / 60)} min of play remaining`}</button>
      </article>)}
    </div>
  </section>;
}
