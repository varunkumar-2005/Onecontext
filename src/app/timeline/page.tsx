"use client";

import "../structured.css";
import { useEffect, useState } from "react";
import { ProjectPageHeader, useActiveProject } from "@/components/project-ui";

type TimelineEvent = { id: string; type: string; title: string; detail: string; createdAt: string };
export default function TimelinePage() { const project = useActiveProject(); const [events, setEvents] = useState<TimelineEvent[]>([]); useEffect(() => { fetch(`/api/v1/projects/${encodeURIComponent(project.id)}/timeline`).then((response) => response.json()).then((data) => setEvents(data.events ?? [])); }, [project.id]); return <main className="structured-page"><ProjectPageHeader /><section className="structured-shell"><div className="structured-eyebrow">PROJECT TIMELINE</div><h1>What changed, and when.</h1><p>A chronological view of {project.name} memory as sources are indexed and decisions are recorded.</p><div className="timeline-list">{events.map((event) => <article className="timeline-item" key={event.id}><div className={`timeline-dot ${event.type}`} /><div className="timeline-content"><div className="decision-date">{new Date(event.createdAt).toLocaleString()}</div><h2>{event.title}</h2><p>{event.detail}</p></div></article>)}</div></section></main>; }
