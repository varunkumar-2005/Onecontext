"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import "../structured.css";

type Intent = { id: string; userId: string; userName: string; filePath: string; summary: string; startedAt: string };
type Team = { teamCode: string };
const templates = [{ label: "Implement", text: "Implementing the next feature" }, { label: "Review", text: "Reviewing changes and tests" }, { label: "Debug", text: "Investigating and fixing a bug" }, { label: "Document", text: "Updating documentation and project notes" }];

function overlaps(filePath: string, summary: string, intent: Intent) {
  const sameFile = filePath.trim().toLowerCase() === intent.filePath.toLowerCase();
  const sameFolder = filePath.includes("/") && filePath.split("/").slice(0, -1).join("/").toLowerCase() === intent.filePath.split("/").slice(0, -1).join("/").toLowerCase();
  const words = summary.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 4);
  return sameFile || sameFolder || words.some((word) => intent.summary.toLowerCase().includes(word));
}

export default function TeamPage() {
  const [team, setTeam] = useState<Team>();
  const [intents, setIntents] = useState<Intent[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [projectId, setProjectId] = useState("atlas-project");
  const [projectName, setProjectName] = useState("Atlas project");
  const [filePath, setFilePath] = useState("src/auth/auth.service.ts");
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");
  const [conflicts, setConflicts] = useState<Intent[]>([]);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    const id = encodeURIComponent(projectId);
    const [teamResponse, presenceResponse] = await Promise.all([fetch(`/api/v1/teams?project_id=${id}`), fetch(`/api/v1/teams/presence?project_id=${id}`)]);
    if (teamResponse.ok) setTeam((await teamResponse.json()).team);
    if (presenceResponse.ok) { const data = await presenceResponse.json(); setIntents(data.active_intents); setCurrentUserId(data.connected_user_id || ""); }
  }

  useEffect(() => {
    setProjectId(window.localStorage.getItem("onecontext.activeProjectId") || "atlas-project");
    setProjectName(window.localStorage.getItem("onecontext.activeProjectName") || "Atlas project");
  }, []);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 5000); return () => window.clearInterval(timer); }, [projectId]);

  const myIntent = intents.find((intent) => intent.userId === currentUserId);
  const teammates = intents.filter((intent) => intent.userId !== currentUserId);
  const preview = useMemo(() => filePath.trim() && summary.trim() ? teammates.filter((intent) => overlaps(filePath, summary, intent)) : [], [filePath, summary, teammates]);

  async function copyCode() { await navigator.clipboard?.writeText(team?.teamCode || ""); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  async function startTask(event: FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/v1/teams/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, file_path: filePath, summary }) });
    const data = await response.json(); if (!response.ok) return setMessage(data.error?.message || "Unable to start task");
    setConflicts(data.conflicts || []); setSummary(""); setIntents(data.active_intents);
    setMessage(data.conflicts?.length ? "Overlap detected — coordinate before making structural changes." : "Live task started. Your intent is visible to the team and Conflict Radar.");
  }
  async function stopTask() { await fetch(`/api/v1/teams/presence?project_id=${encodeURIComponent(projectId)}`, { method: "DELETE" }); setConflicts([]); setMessage("Your live task was cleared."); await refresh(); }

  return <main className="structured-page"><header className="structured-header"><a href="/">Back to overview</a><span>OneContext</span><strong>{projectName}</strong></header><section className="structured-shell team-shell"><div className="structured-eyebrow">ONECONTEXT LIVE</div><h1>Work together without colliding silently.</h1><p>Broadcast lightweight task intent. OneContext turns it into shared agent context and warns the team before work overlaps.</p><section className="team-code-card"><div><span className="team-label">TEAM CODE</span><strong>{team?.teamCode || "Loading..."}</strong><small>Share this once; teammates use it to enter {projectName}&apos;s live coordination space.</small></div><button onClick={copyCode}>{copied ? "Copied" : "Copy code"}</button></section><section className="live-status-grid"><article><span className="live-stat-icon purple">◌</span><div><strong>{teammates.length}</strong><small>active teammate{teammates.length === 1 ? "" : "s"}</small></div></article><article><span className={`live-stat-icon ${myIntent ? "green" : "gray"}`}>{myIntent ? "✓" : "—"}</span><div><strong>{myIntent ? "Visible" : "Not broadcasting"}</strong><small>your live status</small></div></article><article><span className={`live-stat-icon ${conflicts.length ? "orange" : "green"}`}>{conflicts.length ? "!" : "✓"}</span><div><strong>{conflicts.length ? "Check overlap" : "Clear"}</strong><small>collision signal</small></div></article></section>{myIntent && <section className="my-live-task"><span>YOU ARE LIVE</span><div><strong>{myIntent.filePath}</strong><p>{myIntent.summary}</p></div><button onClick={stopTask}>End task</button></section>}<section className="live-workspace"><form className="decision-form live-task-form" onSubmit={startTask}><div className="settings-card-heading"><div><span className="team-label">STEP 1 · CLAIM YOUR INTENT</span><h2>{myIntent ? "Update your live task" : "Start a live task"}</h2><span>Tell teammates and AI agents what area you are about to change.</span></div></div><label className="live-field"><span>FILE OR WORK AREA</span><input value={filePath} onChange={(event) => setFilePath(event.target.value)} placeholder="src/auth/auth.service.ts" /></label><label className="live-field"><span>WHAT ARE YOU DOING?</span><input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="e.g. Refactoring token validation and adding tests" required /></label><div className="task-templates"><span>QUICK START</span>{templates.map((template) => <button type="button" key={template.label} onClick={() => setSummary(template.text)}>{template.label}</button>)}</div>{preview.length > 0 && <div className="live-preview-warning"><strong>Potential overlap with {preview.map((intent) => intent.userName).join(", ")}</strong><span>They are active in a related file or task. You can still broadcast, but coordinate first.</span></div>}<div className="team-actions"><button type="submit">{myIntent ? "Update intent" : "Broadcast intent"}</button><button type="button" className="clear-task" onClick={stopTask} disabled={!myIntent}>Clear my task</button></div></form><aside className="live-guide"><span>HOW LIVE PROTECTS WORK</span><ol><li><b>1</b><div><strong>Broadcast</strong><small>Your task is visible for 15 minutes.</small></div></li><li><b>2</b><div><strong>Detect</strong><small>OneContext compares files, folders, and intent.</small></div></li><li><b>3</b><div><strong>Coordinate</strong><small>Conflict Radar and VS Code show overlap early.</small></div></li></ol><a href="/graph">Open Conflict Radar →</a></aside></section>{message && <div className={`live-message ${conflicts.length ? "warning" : ""}`}>{message}</div>}<section className="presence-card"><div className="settings-card-heading"><div><h2>Live team presence</h2><span>Updates every 5 seconds · automatically expires after 15 minutes</span></div><em>{intents.length} active</em></div>{intents.length ? intents.map((intent) => <article className={`presence-row ${intent.userId === currentUserId ? "is-me" : ""}`} key={intent.id}><span className="presence-dot" /><div><strong>{intent.userName}{intent.userId === currentUserId ? " · You" : ""}</strong><span>{intent.filePath}</span><p>{intent.summary}</p></div><time>{new Date(intent.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></article>) : <div className="empty-presence"><span>◌</span><strong>No active work yet</strong><p>Start a live task to make your work visible and activate the Conflict Radar.</p></div>}</section></section></main>;
}
