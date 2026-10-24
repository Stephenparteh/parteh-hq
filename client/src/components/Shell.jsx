import { useEffect } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../context/Auth.jsx";
import { useData } from "../context/Data.jsx";
import { usePop } from "../context/Pop.jsx";
import { liveProjects, waitDays } from "../lib/format.js";
import { settingsDialog } from "./SettingsDialog.jsx";
import Today from "../pages/Today.jsx";
import Projects from "../pages/Projects.jsx";
import Pricing from "../pages/Pricing.jsx";
import Docs from "../pages/Docs.jsx";
import Insights from "../pages/Insights.jsx";

const TABS = [["today", "Today"], ["projects", "Projects"], ["pricing", "Pricing"], ["docs", "Docs"], ["insights", "Insights"]];
const lastTab = () => { try { const v = localStorage.getItem("pv"); return TABS.some((t) => t[0] === v) ? v : "today"; } catch { return "today"; } };

export default function Shell() {
  const { token, logout } = useAuth();
  const { projects, settings, status, loadError, reload } = useData();
  const { openPop } = usePop();
  const { pathname } = useLocation();

  useEffect(() => {
    const t = pathname.split("/")[1];
    if (TABS.some((x) => x[0] === t)) { try { localStorage.setItem("pv", t); } catch { /* storage blocked */ } window.scrollTo(0, 0); }
  }, [pathname]);

  if (!token) return <Navigate to="/login" replace />;
  const due = liveProjects(projects).filter((p) => waitDays(p) >= 3).length;

  return (
    <div className="wrap">
      <header>
        <div>
          <span className="eyebrow">{settings.bizName} · {settings.tagline}</span>
          <h1>Parteh HQ</h1>
          <span className="note tagline">The Professor's Study</span>
        </div>
        <div className="hbtns">
          <button className="gear" onClick={() => openPop("Settings", settingsDialog())}>Settings</button>
          <button className="gear" onClick={logout}>Log out</button>
        </div>
      </header>
      <nav className="nav" aria-label="Views">
        {TABS.map(([k, n]) => (
          <NavLink key={k} to={`/${k}`}>{n}{k === "today" && due > 0 && <span className="badge">{due}</span>}</NavLink>
        ))}
      </nav>
      <main>
        {status === "loading" && <div className="empty">Loading your studio…</div>}
        {status === "error" && <div className="empty">{loadError}<br /><button className="btn sm" style={{ marginTop: 10 }} onClick={reload}>Try again</button></div>}
        {status === "ready" && (
          <Routes>
            <Route path="/" element={<Navigate to={`/${lastTab()}`} replace />} />
            <Route path="/today" element={<Today />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/docs/*" element={<Docs />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}
