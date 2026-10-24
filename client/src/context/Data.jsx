import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "./Auth.jsx";
import { useToast } from "./Toast.jsx";
import { withDefaults } from "../lib/format.js";

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

// Projects and settings. Every save updates the screen at once, then asks the server.
// If the server says no, the change is rolled back and an error is shown.
export function DataProvider({ children }) {
  const { token } = useAuth();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [settingsDoc, setSettingsDoc] = useState({});
  const [docs, setDocs] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [loadError, setLoadError] = useState("");
  const settingsRef = useRef({});
  settingsRef.current = settingsDoc;
  const projectsRef = useRef([]);
  projectsRef.current = projects;

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [p, s, d] = await Promise.all([api("/api/projects"), api("/api/settings"), api("/api/documents")]);
      projectsRef.current = p; setProjects(p); setSettingsDoc(s); setDocs(d); setStatus("ready"); setLoadError("");
    } catch (e) {
      if (e.status === 401) return; // the auth provider logs us out
      setLoadError(e.message); setStatus("error");
    }
  }, []);

  useEffect(() => { if (token) load(); else { setProjects([]); setSettingsDoc({}); setDocs([]); setStatus("loading"); } }, [token, load]);

  const fail = (e, fallback) => { if (e.status !== 401) toast(e.message || fallback); };

  // body: the prepared project (no id). id: set when editing an existing project.
  const saveProject = useCallback(async (body, id) => {
    const now = new Date().toISOString();
    if (id) {
      let before;
      setProjects((ps) => ps.map((p) => { if (p.id !== id) return p; before = p; return { ...body, id, createdAt: p.createdAt, updatedAt: now }; }));
      try {
        const r = await api(`/api/projects/${id}`, { method: "PUT", body });
        setProjects((ps) => ps.map((p) => (p.id === id ? r : p)));
        return r;
      } catch (e) {
        setProjects((ps) => ps.map((p) => (p.id === id && before ? before : p)));
        fail(e, "Couldn't save. Check your connection and try again."); throw e;
      }
    }
    const tmp = "tmp_" + Math.random().toString(36).slice(2);
    setProjects((ps) => [{ ...body, id: tmp, createdAt: now, updatedAt: now }, ...ps]);
    try {
      const r = await api("/api/projects", { method: "POST", body });
      setProjects((ps) => ps.map((p) => (p.id === tmp ? r : p)));
      return r;
    } catch (e) {
      setProjects((ps) => ps.filter((p) => p.id !== tmp));
      fail(e, "Couldn't save. Check your connection and try again."); throw e;
    }
  }, [toast]);

  // Small change to one project (for example resetting the follow-up timer).
  const patchProject = useCallback(async (id, patch) => {
    let before;
    const now = new Date().toISOString();
    setProjects((ps) => ps.map((p) => { if (p.id !== id) return p; before = p; return { ...p, ...patch, updatedAt: now }; }));
    try {
      const r = await api(`/api/projects/${id}`, { method: "PATCH", body: patch });
      setProjects((ps) => ps.map((p) => (p.id === id ? r : p)));
    } catch (e) {
      setProjects((ps) => ps.map((p) => (p.id === id && before ? before : p)));
      fail(e, "Couldn't update. Try again."); throw e;
    }
  }, [toast]);

  const deleteProject = useCallback(async (id) => {
    let before, index = 0;
    setProjects((ps) => { index = ps.findIndex((p) => p.id === id); before = ps[index]; return ps.filter((p) => p.id !== id); });
    try { await api(`/api/projects/${id}`, { method: "DELETE" }); }
    catch (e) {
      setProjects((ps) => (before ? [...ps.slice(0, index), before, ...ps.slice(index)] : ps));
      fail(e, "Couldn't delete. Try again."); throw e;
    }
  }, [toast]);

  const saveSettings = useCallback(async (patch, quiet) => {
    const before = settingsRef.current, next = { ...before, ...patch };
    setSettingsDoc(next);
    try {
      await api("/api/settings", { method: "PUT", body: next });
      if (!quiet) toast("Settings saved");
    } catch (e) {
      setSettingsDoc(before);
      fail(e, "Couldn't save settings. Try again."); throw e;
    }
  }, [toast]);

  // Saving a receipt changes the project's payments on the server, so the projects are fetched again.
  const refreshProjects = useCallback(async () => {
    const p = await api("/api/projects");
    projectsRef.current = p; setProjects(p);
    return p;
  }, []);
  const getProject = useCallback((id) => projectsRef.current.find((p) => p.id === id), []);

  // cur: { id?, type, status, projectId, data }. The server gives the document its number.
  const saveDocument = useCallback(async (cur, total, client, date) => {
    const body = { type: cur.type, status: cur.status || "Draft", projectId: cur.projectId || "", client: (client || "").trim(), total, date: date || cur.data.date || "", data: cur.data };
    const r = cur.id ? await api(`/api/documents/${cur.id}`, { method: "PUT", body }) : await api("/api/documents", { method: "POST", body });
    setDocs((ds) => (ds.some((x) => x.id === r.id) ? ds.map((x) => (x.id === r.id ? r : x)) : [r, ...ds]));
    return r;
  }, []);
  const deleteDocument = useCallback(async (id) => {
    await api(`/api/documents/${id}`, { method: "DELETE" });
    setDocs((ds) => ds.filter((x) => x.id !== id));
  }, []);

  const settings = useMemo(() => withDefaults(settingsDoc), [settingsDoc]);
  const value = useMemo(() => ({ projects, docs, settings, settingsDoc, status, loadError, reload: load, saveProject, patchProject, deleteProject, saveSettings, refreshProjects, getProject, saveDocument, deleteDocument }),
    [projects, docs, settings, settingsDoc, status, loadError, load, saveProject, patchProject, deleteProject, saveSettings, refreshProjects, getProject, saveDocument, deleteDocument]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
