import { useState } from "react";
import { LAST } from "../constants.js";
import { useData } from "../context/Data.jsx";
import { useSheet } from "../components/ProjectSheet.jsx";
import ProjectCard from "../components/ProjectCard.jsx";
import { stageOf } from "../lib/format.js";

const FILTERS = [["all", "All"], ["lead", "Leads"], ["deal", "Deal"], ["build", "Building"], ["done", "Launched"]];

export default function Projects() {
  const { projects } = useData();
  const { openSheet } = useSheet();
  const [filter, setFilterState] = useState(() => { try { return localStorage.getItem("pf") || "all"; } catch { return "all"; } });
  const setFilter = (f) => { setFilterState(f); try { localStorage.setItem("pf", f); } catch { /* storage blocked */ } };

  let list = projects.slice();
  if (filter === "done") list = list.filter((p) => p.phase === LAST);
  else if (filter === "build") list = list.filter((p) => p.phase < LAST && (stageOf(p) === "build" || stageOf(p) === "launch"));
  else if (filter !== "all") list = list.filter((p) => p.phase < LAST && stageOf(p) === filter);
  list.sort((a, b) => (a.status === "lost") - (b.status === "lost") || (a.phase === LAST) - (b.phase === LAST) || (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  return (
    <div className="list">
      <div className="toolbar">
        <div className="tabs" role="group" aria-label="Filter">
          {FILTERS.map(([f, n]) => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{n}</button>)}
        </div>
        <button className="btn" onClick={() => openSheet(null)}>+ New project</button>
      </div>
      {!projects.length
        ? <div className="empty"><strong>No projects yet.</strong><br />Tap “+ New project” when the next person messages you about a website.</div>
        : list.length ? list.map((p) => <ProjectCard key={p.id} p={p} onOpen={openSheet} />) : <div className="empty">Nothing in this view yet.</div>}
    </div>
  );
}
