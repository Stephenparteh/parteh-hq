import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useToast } from "./Toast.jsx";

const Ctx = createContext(null);
export const usePop = () => useContext(Ctx);

// One popup at a time (settings, images, the copy box). openPop(title, node) shows it.
export function PopProvider({ children }) {
  const [pop, setPop] = useState(null);
  const openPop = useCallback((title, content) => setPop({ title, content }), []);
  const closePop = useCallback(() => setPop(null), []);
  const value = useMemo(() => ({ openPop, closePop }), [openPop, closePop]);

  useEffect(() => {
    if (!pop) return;
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); setPop(null); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [pop]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {pop && (
        <div className="scrim pop" onClick={(e) => e.target === e.currentTarget && setPop(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="popTitle">
            <div className="sheet-head"><h2 id="popTitle">{pop.title}</h2><button className="x" aria-label="Close" onClick={() => setPop(null)}>×</button></div>
            <div className="sbody">{pop.content}</div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

function CopyBox({ text }) {
  return (
    <>
      <p className="note">Select all and copy, then paste in WhatsApp.</p>
      <textarea className="copybox" readOnly defaultValue={text} autoFocus onFocus={(e) => e.target.select()} aria-label="Message to copy" />
    </>
  );
}

// copy(text, "Follow-up"): uses the clipboard, or shows a box to copy from.
export function useCopy() {
  const toast = useToast();
  const { openPop } = usePop();
  return useCallback(async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label || "Message"} copied. Paste it in WhatsApp.`);
    } catch {
      openPop("Copy this message", <CopyBox text={text} />);
    }
  }, [toast, openPop]);
}
