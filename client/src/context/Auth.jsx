import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken, setUnauthorizedHandler } from "../api.js";
import { useToast } from "./Toast.jsx";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const toast = useToast();
  const [token, setTokenState] = useState(getToken());
  const [user, setUser] = useState(null);

  const logout = useCallback(() => { setToken(null); setTokenState(null); setUser(null); }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { logout(); toast("Your login has expired. Please log in again."); });
    return () => setUnauthorizedHandler(() => {});
  }, [logout, toast]);

  const login = useCallback(async (email, password) => {
    const r = await api("/api/auth/login", { method: "POST", body: { email, password } });
    setToken(r.token); setTokenState(r.token); setUser(r.user);
  }, []);

  const value = useMemo(() => ({ token, user, login, logout }), [token, user, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
