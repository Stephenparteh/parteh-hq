import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const Ctx = createContext(null);
export const useToast = () => useContext(Ctx);

// toast("Saved") for a short notice. toast("Moved", { undo }) adds an Undo button and stays longer.
export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const timer = useRef();
  const toast = useCallback((text, opts = {}) => {
    clearTimeout(timer.current);
    setT({ text, undo: opts.undo });
    timer.current = setTimeout(() => setT(null), opts.undo ? 7000 : 2600);
  }, []);
  const value = useMemo(() => toast, [toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {t && (
        <div className="toast" role="status">
          <span>{t.text}</span>
          {t.undo && <button onClick={async () => { setT(null); await t.undo(); }}>Undo</button>}
        </div>
      )}
    </Ctx.Provider>
  );
}
