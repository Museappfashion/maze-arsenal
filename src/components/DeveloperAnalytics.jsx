// src/components/DeveloperAnalytics.jsx
import { useCallback, useState } from "react";

function formatMinutes(seconds) {
  return (Number(seconds || 0) / 60).toFixed(1);
}

function shortUserId(userId) {
  const value = String(userId ?? "");
  return value.length > 12
    ? `${value.slice(0, 8)}…${value.slice(-4)}`
    : value;
}

export function DeveloperAnalytics() {
  const [developerKey, setDeveloperKey] = useState("");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("Enter the developer dashboard key.");
  const [loading, setLoading] = useState(false);

  const loadAnalytics = useCallback(async () => {
    const key = developerKey.trim();

    if (!key) {
      setStatus("Developer key required.");
      return;
    }

    setLoading(true);
    setStatus("Loading…");

    try {
      const response = await fetch("/api/developer-analytics", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${key}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error || `Request failed with ${response.status}`,
        );
      }

      setData(payload);
      setStatus(`Updated ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      setData(null);
      setStatus(error.message || "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [developerKey]);

  return (
    <main className="developer-dashboard">
      <style>{`
        html, body, #root {
          margin: 0;
          min-height: 100%;
          background: #020617;
          color: #e2e8f0;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        .developer-dashboard {
          min-height: 100vh;
          padding: clamp(18px, 4vw, 48px);
          background:
            radial-gradient(circle at 20% 0%, rgba(56, 189, 248, 0.08), transparent 34%),
            #020617;
        }

        .developer-dashboard-inner {
          width: min(1180px, 100%);
          margin: 0 auto;
        }

        .developer-dashboard-header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          margin-bottom: 22px;
        }

        .developer-dashboard h1 {
          margin: 0;
          font-size: clamp(25px, 4vw, 38px);
        }

        .developer-dashboard-subtitle {
          margin: 7px 0 0;
          color: #94a3b8;
          font-size: 13px;
        }

        .developer-dashboard a {
          color: #67e8f9;
        }

        .developer-auth {
          display: grid;
          grid-template-columns: minmax(180px, 360px) auto;
          gap: 8px;
          margin-bottom: 10px;
        }

        .developer-auth input,
        .developer-auth button,
        .developer-refresh {
          min-height: 42px;
          border-radius: 10px;
          font: inherit;
        }

        .developer-auth input {
          width: 100%;
          padding: 8px 11px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: rgba(15, 23, 42, 0.92);
          color: #f8fafc;
        }

        .developer-auth button,
        .developer-refresh {
          padding: 8px 14px;
          border: 1px solid rgba(34, 211, 238, 0.42);
          background: rgba(8, 145, 178, 0.28);
          color: #ecfeff;
          font-weight: 800;
          cursor: pointer;
        }

        .developer-status {
          min-height: 20px;
          margin-bottom: 18px;
          color: #94a3b8;
          font-size: 12px;
        }

        .developer-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 18px;
        }

        .developer-card {
          padding: 14px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.82);
        }

        .developer-card strong {
          display: block;
          color: #94a3b8;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .developer-card span {
          display: block;
          margin-top: 7px;
          color: #f8fafc;
          font-size: 24px;
          font-weight: 900;
        }

        .developer-table-wrap {
          overflow-x: auto;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.76);
        }

        .developer-table {
          width: 100%;
          min-width: 930px;
          border-collapse: collapse;
          font-size: 12px;
        }

        .developer-table th,
        .developer-table td {
          padding: 10px 11px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
          text-align: right;
          white-space: nowrap;
        }

        .developer-table th:first-child,
        .developer-table td:first-child,
        .developer-table th:nth-child(2),
        .developer-table td:nth-child(2) {
          text-align: left;
        }

        .developer-table th {
          color: #94a3b8;
          font-size: 9px;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .developer-user-id {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          color: #bae6fd;
        }

        .developer-note {
          margin: 14px 0 0;
          color: #64748b;
          font-size: 11px;
          line-height: 1.5;
        }

        @media (max-width: 760px) {
          .developer-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .developer-auth {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="developer-dashboard-inner">
        <header className="developer-dashboard-header">
          <div>
            <h1>Mist Maze Developer Analytics</h1>
            <p className="developer-dashboard-subtitle">
              Private aggregate activity dashboard.
            </p>
          </div>
          <a href="/">← Back to Mist Maze</a>
        </header>

        <div className="developer-auth">
          <input
            type="password"
            autoComplete="off"
            placeholder="Developer dashboard key"
            value={developerKey}
            onChange={(event) => setDeveloperKey(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void loadAnalytics();
              }
            }}
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadAnalytics()}
          >
            {loading ? "LOADING…" : "OPEN DASHBOARD"}
          </button>
        </div>

        <div className="developer-status">{status}</div>

        {data && (
          <>
            <section className="developer-summary">
              <div className="developer-card">
                <strong>Tracked users</strong>
                <span>{data.totals.users}</span>
              </div>
              <div className="developer-card">
                <strong>Games started</strong>
                <span>{data.totals.gamesStarted}</span>
              </div>
              <div className="developer-card">
                <strong>Minutes played</strong>
                <span>{formatMinutes(data.totals.secondsPlayed)}</span>
              </div>
              <div className="developer-card">
                <strong>Donation clicks</strong>
                <span>{data.totals.donationAttempts}</span>
              </div>
            </section>

            <div className="developer-table-wrap">
              <table className="developer-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Latest name</th>
                    <th>Games</th>
                    <th>Finished</th>
                    <th>Minutes</th>
                    <th>$1 tries</th>
                    <th>$2 tries</th>
                    <th>$5 tries</th>
                    <th>Custom tries</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.userId}>
                      <td
                        className="developer-user-id"
                        title={user.userId}
                      >
                        {shortUserId(user.userId)}
                      </td>
                      <td>{user.playerName || "—"}</td>
                      <td>{user.gamesStarted}</td>
                      <td>{user.gamesFinished}</td>
                      <td>{formatMinutes(user.secondsPlayed)}</td>
                      <td>{user.donation1Attempts}</td>
                      <td>{user.donation2Attempts}</td>
                      <td>{user.donation5Attempts}</td>
                      <td>{user.donationCustomAttempts}</td>
                      <td>
                        {user.lastSeenAt
                          ? new Date(user.lastSeenAt).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="developer-note">
              Donation figures are support-button click attempts, not confirmed
              payments. User identifiers are anonymous Supabase account IDs.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
