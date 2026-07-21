"use client";

import "../structured.css";
import { FormEvent, useEffect, useState } from "react";
import { ProjectPageHeader, useActiveProject } from "@/components/project-ui";

type Decision = { id: string; title: string; rationale: string; createdAt: string };
export default function DecisionsPage() {
  const project = useActiveProject(); const [decisions, setDecisions] = useState<Decision[]>([]); const [title, setTitle] = useState(""); const [rationale, setRationale] = useState("");
  useEffect(() => { fetch(`/api/v1/projects/${encodeURIComponent(project.id)}/decisions`).then((response) => response.json()).then((data) => setDecisions(data.decisions ?? [])); }, [project.id]);
  async function save(event: FormEvent) { event.preventDefault(); if (!title.trim() || !rationale.trim()) return; const response = await fetch(`/api/v1/projects/${encodeURIComponent(project.id)}/decisions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, rationale }) }); const data = await response.json(); if (response.ok) { setDecisions((current) => [data.decision, ...current]); setTitle(""); setRationale(""); } }
  return <main className="structured-page"><ProjectPageHeader /><section className="structured-shell"><div className="structured-eyebrow">DECISION HISTORY</div><h1>Why the project works this way.</h1><p>Capture the reasoning behind architecture choices so every assistant can find it later.</p><form className="decision-form" onSubmit={save}><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Decision title" /><textarea value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="What did the team decide, and why?" /><button type="submit">Record decision</button></form><div className="decision-list">{decisions.map((decision) => <article className="decision-card" key={decision.id}><div className="decision-marker">✓</div><div><div className="decision-date">{new Date(decision.createdAt).toLocaleDateString()}</div><h2>{decision.title}</h2><p>{decision.rationale}</p></div></article>)}</div></section></main>;
}
