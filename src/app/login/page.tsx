"use client";
import "../structured.css";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("suresh@example.com"); const [password, setPassword] = useState("demo1234"); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); try { const response = await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }); if (!response.ok) { const data = await response.json(); throw new Error(data.error?.message || "Unable to sign in"); } window.location.href = "/"; } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to sign in"); } finally { setLoading(false); } }
  return <main className="auth-page"><div className="auth-card"><div className="auth-brand"><span>◒</span> OneContext</div><div className="structured-eyebrow">PROJECT MEMORY</div><h1>Welcome back.</h1><p>Sign in to continue to your project workspace.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div className="auth-error">{error}</div>}<button disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button></form><div className="demo-hint">Demo account: <strong>suresh@example.com</strong> / <strong>demo1234</strong></div></div></main>;
}
