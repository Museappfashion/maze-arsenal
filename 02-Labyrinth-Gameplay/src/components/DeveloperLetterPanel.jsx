import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEVELOPER_LETTER_LIMIT,
  loadDeveloperLetterInbox,
  sendDeveloperLetter,
} from "../services/developerLetters.js";

function LetterTime({ value }) {
  return <time dateTime={value}>{new Date(value).toLocaleString()}</time>;
}

export function DeveloperLetterPanel({ playerName, open, onReplyCountChange }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [letters, setLetters] = useState([]);
  const [inboxStatus, setInboxStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const requestVersion = useRef(0);

  const refreshInbox = useCallback(async ({ silent = false } = {}) => {
    const version = ++requestVersion.current;
    setLoading(!silent);
    try {
      const result = await loadDeveloperLetterInbox();
      if (version === requestVersion.current) {
        setLetters(result);
        setInboxStatus("");
      }
    } catch (error) {
      if (version === requestVersion.current) setInboxStatus(error.message || "Could not load your inbox.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The panel stays mounted on the menu, so players can see a reply count
    // without opening it. Pause polling when this browser tab is hidden.
    const checkForReplies = () => {
      if (document.visibilityState !== "hidden") void refreshInbox({ silent: true });
    };
    if (document.visibilityState !== "hidden") void refreshInbox({ silent: !open });
    const timer = window.setInterval(checkForReplies, 30_000);
    window.addEventListener("focus", checkForReplies);
    document.addEventListener("visibilitychange", checkForReplies);
    return () => {
      requestVersion.current += 1;
      window.clearInterval(timer);
      window.removeEventListener("focus", checkForReplies);
      document.removeEventListener("visibilitychange", checkForReplies);
    };
  }, [open, refreshInbox]);

  const replyCount = letters.reduce((total, letter) => total + (letter.replies?.length ?? 0), 0);
  useEffect(() => { onReplyCountChange?.(replyCount); }, [onReplyCountChange, replyCount]);
  const latestReplyTime = letter => Math.max(0, ...(letter.replies ?? []).map(reply => Date.parse(reply.createdAt) || 0));
  const orderedLetters = [...letters].sort((a, b) => latestReplyTime(b) - latestReplyTime(a));

  async function submitLetter(event) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setStatus("Sending…");
    try {
      await sendDeveloperLetter({ message, playerName });
      setMessage("");
      setStatus("✓ Your letter was delivered. Check your inbox below for a reply.");
      await refreshInbox();
    } catch (error) {
      setStatus(error.message || "Your letter could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="first-page-expanded-panel developer-letter-expanded" hidden={!open} style={!open ? { display: "none" } : undefined}>
      <style>{`
        .player-letter-inbox { margin-bottom: 22px; border-bottom: 1px solid #1e3a5f; padding-bottom: 18px; }
        .player-letter-inbox header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .player-letter-inbox h2 { font-size: 15px; margin: 0; color: #bfdbfe; }
        .player-letter-inbox button { border: 1px solid #3b82f6; border-radius: 8px; background: #172554; color: #dbeafe; padding: 7px 12px; cursor: pointer; }
        .player-letter-inbox button:disabled { opacity: .5; cursor: default; }
        .player-letter-inbox > p { font-size: 11px; color: #94a3b8; line-height: 1.5; }
        .player-letter-threads { display: grid; gap: 12px; max-height: 460px; overflow: auto; margin-top: 12px; }
        .player-letter-thread { padding: 13px; background: #0f172a; border: 1px solid #27364e; border-radius: 12px; }
        .player-letter-thread .letter-meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; color: #93c5fd; font-size: 11px; }
        .player-letter-thread p { white-space: pre-wrap; overflow-wrap: anywhere; color: #e2e8f0; line-height: 1.5; font-size: 13px; margin: 9px 0; }
        .player-letter-thread .letter-reply { margin-top: 12px; padding: 12px; border-left: 3px solid #60a5fa; border-radius: 6px; background: #172554; }
        .player-letter-thread .letter-waiting { font-size: 11px; color: #94a3b8; margin-bottom: 0; }
        .player-letter-thread details { margin-top: 12px; color: #94a3b8; font-size: 12px; }
        .player-letter-thread summary { cursor: pointer; }
      `}</style>
      <section className="player-letter-inbox" aria-label="Your inbox">
        <header>
          <h2>YOUR INBOX · {replyCount} {replyCount === 1 ? "REPLY" : "REPLIES"}</h2>
          <button type="button" disabled={loading} onClick={() => void refreshInbox()}>{loading ? "CHECKING…" : "REFRESH"}</button>
        </header>
        <p>The developer’s replies appear here automatically. Return using this browser to keep access to your letters.</p>
        {inboxStatus && <div className="developer-letter-status" role="status">{inboxStatus}</div>}
        {!loading && !inboxStatus && !letters.length && <p>No letters yet. Send your first one above.</p>}
        <div className="player-letter-threads" aria-live="polite" aria-relevant="additions text">
          {orderedLetters.map(letter => (
            <article className="player-letter-thread" key={letter.id}>
              {letter.replies?.length ? letter.replies.map(reply => (
                <div className="letter-reply" key={reply.id}>
                  <div className="letter-meta"><strong>DEVELOPER REPLY</strong><LetterTime value={reply.createdAt} /></div>
                  <p>{reply.message}</p>
                </div>
              )) : <p className="letter-waiting">Awaiting a reply.</p>}
              <details open={!letter.replies?.length}>
                <summary>Your letter · <LetterTime value={letter.createdAt} /></summary>
                <p>{letter.message}</p>
              </details>
            </article>
          ))}
        </div>
      </section>
      <form className="developer-letter-form" onSubmit={submitLetter}>
        <div className="developer-letter-heading">
          <strong>WRITE TO THE DEVELOPER</strong>
          <span>Share feedback, report a problem, or leave a note.</span>
        </div>
        <textarea
          value={message}
          maxLength={DEVELOPER_LETTER_LIMIT}
          placeholder="Write your letter here…"
          aria-label="Letter to the developer"
          disabled={sending}
          onChange={event => { setMessage(event.target.value); setStatus(""); }}
        />
        <div className="developer-letter-footer">
          <span>{message.length}/{DEVELOPER_LETTER_LIMIT}</span>
          <button type="submit" disabled={sending || !message.trim()}>{sending ? "SENDING…" : "SEND LETTER"}</button>
        </div>
        {status && <div className="developer-letter-status" role="status">{status}</div>}
      </form>
    </section>
  );
}
