import { useEffect, useState } from "react";
import { api } from "./api.js";

// Render's free plan sleeps, so the first request can take up to a minute.
export default function App() {
  const [state, setState] = useState({ status: "loading" });
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(() => setSlow(true), 3000);
    api("/api/health", { signal: ctl.signal })
      .then((h) => setState({ status: "ok", health: h }))
      .catch((e) => !ctl.signal.aborted && setState({ status: "error", message: e.message }))
      .finally(() => clearTimeout(t));
    return () => { ctl.abort(); clearTimeout(t); };
  }, []);

  return (
    <div className="wrap">
      <header>
        <div>
          <span className="eyebrow">Stephen Parteh · Web Developer</span>
          <h1>Parteh HQ</h1>
          <span className="note tagline">The Professor's Study</span>
        </div>
      </header>
      <main>
        {state.status === "loading" && (
          <div className="empty">{slow ? "Waking up the server… this can take up to a minute." : "Connecting…"}</div>
        )}
        {state.status === "ok" && (
          <div className="card">
            <strong>Server is up.</strong>
            <span className="note">Database: {state.health.db}</span>
          </div>
        )}
        {state.status === "error" && <div className="empty">{state.message}</div>}
      </main>
    </div>
  );
}
