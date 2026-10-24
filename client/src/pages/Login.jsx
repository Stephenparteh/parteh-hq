import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/Auth.jsx";

export default function Login() {
  const { token, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (token) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try { await login(email.trim(), password); }
    catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <div className="login">
      <form onSubmit={submit}>
        <div className="brand">
          <span className="eyebrow">Stephen Parteh · Web Developer</span>
          <h1>Parteh HQ</h1>
          <span className="note tagline">The Professor's Study</span>
        </div>
        <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <div className="err" role="alert">{error}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
      </form>
    </div>
  );
}
