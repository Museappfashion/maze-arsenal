import { useEffect, useState } from "react";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_AT = Date.parse("2026-11-06T00:00:00-08:00");
const NOTICE_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Los_Angeles",
});

const UPDATES = [
  // Add player-facing notices as { publishedAt: ISO timestamp with timezone, text: string }.
]
  .map((update) => ({ ...update, startsAt: Date.parse(update.publishedAt) }))
  .filter((update) => update.startsAt >= RESET_AT)
  .sort((a, b) => b.startsAt - a.startsAt);

export function UpdateNoticeBoard() {
  const [now, setNow] = useState(Date.now);
  const visibleUpdates = UPDATES.filter(({ startsAt }) => startsAt <= now && now < startsAt + WEEK_MS);

  useEffect(() => {
    const nextChange = Math.min(...UPDATES.flatMap(({ startsAt }) => [startsAt, startsAt + WEEK_MS])
      .filter((time) => time > now));
    if (!Number.isFinite(nextChange)) return;

    const delay = Math.max(0, Math.min(nextChange - Date.now(), 2_147_483_647));
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [now]);

  return <section className="update-notice-board" aria-labelledby="update-notice-title">
    <style>{`
      .update-notice-board { padding: 20px 24px; border: 1px solid #385e86; border-radius: 18px; background: linear-gradient(135deg, #122c46, #0b1b2e); color: #dceafa; }
      .update-notice-board h2 { margin: 0 0 12px; color: #bedcf5; font-size: 19px; letter-spacing: -.02em; }
      .update-notice-board ul { margin: 0; padding-left: 19px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px 30px; }
      .update-notice-board li { font-size: 12px; line-height: 1.7; padding-left: 3px; }
      .update-notice-board li::marker { color: #89b8df; }
      .update-notice-board time { color: #bedcf5; font-weight: 600; }
      .update-notice-board p { margin: 0; font-size: 12px; line-height: 1.7; }
      @media (max-width: 700px) { .update-notice-board { padding: 18px; } .update-notice-board ul { grid-template-columns: 1fr; } }
    `}</style>
    <h2 id="update-notice-title">Update board</h2>
    {visibleUpdates.length > 0 ? <ul>{visibleUpdates.map(({ publishedAt, startsAt, text }) => (
      <li key={`${publishedAt}-${text}`}><time dateTime={publishedAt}>{NOTICE_DATE.format(startsAt)}</time> — {text}</li>
    ))}</ul> : <p>No updates in the past seven days.</p>}
  </section>;
}
