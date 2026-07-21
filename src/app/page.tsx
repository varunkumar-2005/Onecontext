"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Source = { id?: string; name: string; type: "Markdown" | "GitHub" | "Notes"; status: "Indexed" | "Syncing" | "Ready" | "Pending"; detail: string };
type WorkspaceProject = { id: string; name: string; description: string; createdAt: string };

const navItems = [
  { icon: "⌂", label: "Overview", href: "/" },
  { icon: "◇", label: "Sources", href: "/sources" },
  { icon: "✦", label: "Memory chat", href: "/chat" },
  { icon: "⌘", label: "Knowledge Graph", href: "/graph" },
  { icon: "◷", label: "Decision timeline", href: "/timeline" },
  { icon: "◎", label: "OneContext Live", href: "/team" },
  { icon: "↗", label: "Share Project Brief", href: "/brief" },
  { icon: "⚙", label: "Project Settings", href: "/settings" },
];

function sourceIcon(type: Source["type"]) { return type === "GitHub" ? "GH" : type === "Notes" ? "N" : "M"; }

export default function Home() {
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [activeProject, setActiveProject] = useState<WorkspaceProject>({ id: "atlas-project", name: "Atlas project", description: "", createdAt: "" });
  const [sources, setSources] = useState<Source[]>([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectGoal, setProjectGoal] = useState("");
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const sourceFileRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  function announce(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 3500); }
  function persistProject(project: WorkspaceProject) { window.localStorage.setItem("onecontext.activeProjectId", project.id); window.localStorage.setItem("onecontext.activeProjectName", project.name); window.dispatchEvent(new Event("onecontext:project-changed")); }

  useEffect(() => {
    fetch("/api/v1/projects").then((response) => response.json()).then((data) => {
      if (!Array.isArray(data.projects)) return;
      setProjects(data.projects);
      const saved = data.projects.find((project: WorkspaceProject) => project.id === window.localStorage.getItem("onecontext.activeProjectId"));
      const next = saved || data.projects[0];
      if (next) { setActiveProject(next); persistProject(next); }
    }).catch(() => announce("Could not load your projects."));
  }, []);

  useEffect(() => {
    fetch(`/api/v1/projects/${encodeURIComponent(activeProject.id)}/sources`).then((response) => response.json()).then((data) => {
      if (!Array.isArray(data.sources)) return;
      setSources(data.sources.map((source: { id: string; name: string; type: string; status: string; chunkCount: number; lastIndexedAt: string | null }) => ({
        id: source.id, name: source.name, type: source.type === "github" ? "GitHub" : source.type === "notes" ? "Notes" : "Markdown",
        status: source.status === "parsing" ? "Syncing" : source.status === "indexed" ? "Indexed" : "Pending",
        detail: `${source.chunkCount} chunk${source.chunkCount === 1 ? "" : "s"}${source.lastIndexedAt ? " · indexed" : " · waiting"}`,
      })));
    }).catch(() => announce("Could not load project sources."));
  }, [activeProject.id]);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setShowUserMenu(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, []);

  const indexedCount = useMemo(() => sources.filter((source) => source.status === "Indexed").length, [sources]);

  function switchProject(id: string) {
    const next = projects.find((project) => project.id === id); if (!next) return;
    setActiveProject(next); persistProject(next); announce(`Switched to ${next.name}.`);
  }

  async function uploadFile(projectId: string, file: File) {
    const form = new FormData(); form.append("file", file);
    const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectId)}/sources`, { method: "POST", body: form });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error?.message || "The file could not be indexed."); }
    return response.json();
  }

  async function createProject(event: FormEvent) {
    event.preventDefault(); if (!projectName.trim() || creating) return;
    setCreating(true);
    try {
      const response = await fetch("/api/v1/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: projectName.trim(), description: projectGoal.trim() }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "Could not create this project.");
      const project = data.project as WorkspaceProject;
      if (projectFile) await uploadFile(project.id, projectFile);
      setProjects((current) => [...current, project]); setActiveProject(project); persistProject(project);
      setProjectName(""); setProjectGoal(""); setProjectFile(null); setShowProjectModal(false);
      announce(`${project.name} is ready${projectFile ? " and its first file is indexed" : ""}. Open OneContext Live to invite teammates.`);
    } catch (error) { announce(error instanceof Error ? error.message : "Could not create this project."); }
    finally { setCreating(false); }
  }

  async function addSource(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try { const data = await uploadFile(activeProject.id, file); setSources((current) => [{ id: data.source.id, name: data.source.name, type: "Markdown", status: "Indexed", detail: `${data.source.chunkCount} chunks · indexed` }, ...current]); setShowSourceModal(false); announce(`${file.name} was added to ${activeProject.name}.`); }
    catch (error) { announce(error instanceof Error ? error.message : "The source could not be indexed."); }
    finally { event.target.value = ""; }
  }

  async function logOut() { await fetch("/api/v1/auth/logout", { method: "POST" }); window.location.assign("/login"); }
  function submitQuery(event: FormEvent) { event.preventDefault(); if (query.trim()) window.location.assign(`/chat?question=${encodeURIComponent(query.trim())}`); }

  return <main className="shell"><aside className="sidebar"><a className="brand" href="/"><span className="brand-mark">◒</span><span>OneContext</span></a><div className="workspace-label">WORKSPACE</div><div className="project-control"><label htmlFor="active-project">Active project</label><div className="project-select-row"><select id="active-project" value={activeProject.id} onChange={(event) => switchProject(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><button type="button" className="project-add-button" onClick={() => setShowProjectModal(true)} aria-label="Create a new project">+</button></div><button type="button" className="new-project-link" onClick={() => setShowProjectModal(true)}>+ New project</button></div><nav className="nav-list" aria-label="Project navigation">{navItems.map((item) => <a className={`nav-item ${item.label === "Overview" ? "active" : ""}`} href={item.href} key={item.label}><span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></a>)}</nav><div className="sidebar-bottom" ref={userMenuRef}><button type="button" className="user-card" onClick={() => setShowUserMenu((current) => !current)} aria-expanded={showUserMenu}><span className="avatar">SK</span><span className="user-card-copy"><strong>Suresh Kumar</strong><small>Owner · suresh@example.com</small></span><span className="more" aria-hidden="true">⋮</span></button>{showUserMenu && <div className="user-menu" role="menu"><div className="user-menu-profile"><span className="avatar">SK</span><div><strong>Suresh Kumar</strong><small>suresh@example.com</small><em>Project owner</em></div></div><a href="/settings" role="menuitem">Project settings</a><button className="logout-action" type="button" onClick={logOut} role="menuitem">Log out</button></div>}</div></aside><section className="content"><header className="topbar"><div className="breadcrumbs"><span>Projects</span><span className="crumb-separator">/</span><strong>{activeProject.name}</strong></div><div className="top-actions"><span className="sync-dot" /> Project memory online <button type="button" className="top-avatar" onClick={() => setShowUserMenu((current) => !current)} aria-label="Open account menu">SK</button></div></header><div className="page-wrap"><div className="hero-row"><div><div className="eyebrow">PROJECT OVERVIEW</div><h1>{activeProject.name}</h1><p className="subtitle">{activeProject.description || "A shared memory space for your team and AI tools."}</p></div><div className="hero-actions"><button className="secondary-button" onClick={() => setShowProjectModal(true)}>New project</button><button className="primary-button" onClick={() => setShowSourceModal(true)}><span>+</span> Add source</button></div></div>{notice && <div className="toast" role="status"><span className="toast-check">✓</span>{notice}</div>}<section className="stat-grid" aria-label="Project statistics"><article className="stat-card"><span className="stat-label">CONNECTED SOURCES</span><strong className="stat-value">{sources.length}</strong><span className="stat-foot">Available to every connected agent</span></article><article className="stat-card"><span className="stat-label">SOURCES INDEXED</span><strong className="stat-value">{indexedCount}</strong><span className="stat-foot"><i className="status-dot" /> Ready for retrieval</span></article><article className="stat-card"><span className="stat-label">TEAM COORDINATION</span><strong className="stat-value">Live</strong><a className="stat-link" href="/team">Open OneContext Live →</a></article><article className="stat-card"><span className="stat-label">SHARED DIRECTION</span><strong className="stat-value">Brief</strong><a className="stat-link" href="/brief">Edit project brief →</a></article></section><section className="ask-card"><div className="section-heading"><div><h2>Ask {activeProject.name}</h2><p>Search the project’s files, decisions, notes, and conversations.</p></div><a className="text-button" href="/chat">Open memory chat →</a></div><form className="query-box" onSubmit={submitQuery}><span className="sparkle" aria-hidden="true">✦</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask a question about this project…" aria-label="Ask your project" /><span className="shortcut">Enter</span><button aria-label="Search project memory" className="search-button">→</button></form></section><div className="lower-grid"><section className="panel sources-panel"><div className="panel-heading"><div><h2>Connected sources</h2><p>Files and repositories powering this project’s memory.</p></div><button className="icon-button" onClick={() => setShowSourceModal(true)} aria-label="Add a source">+</button></div><div className="source-list">{sources.length ? sources.slice(0, 5).map((source) => <article className="source-row" key={source.id || source.name}><span className={`source-symbol ${source.type.toLowerCase()}`}>{sourceIcon(source.type)}</span><div className="source-main"><strong>{source.name}</strong><small>{source.type} · {source.detail}</small></div><span className={`status ${source.status.toLowerCase()}`}><i />{source.status}</span></article>) : <div className="source-empty-dashboard"><strong>No sources yet</strong><span>Upload a project file to give your team and agents shared context.</span><button onClick={() => setShowSourceModal(true)}>Upload first file</button></div>}</div><a className="panel-link" href="/sources">Manage sources →</a></section><section className="panel project-next-panel"><div className="panel-heading"><div><h2>Keep the team aligned</h2><p>Complete these steps once for each project.</p></div></div><ol className="next-steps"><li><span>1</span><div><strong>Upload the project brief</strong><small>Add a Markdown or text file that describes the work.</small></div><button onClick={() => setShowSourceModal(true)}>Upload</button></li><li><span>2</span><div><strong>Set the shared direction</strong><small>Give people and agents a clear goal and sprint.</small></div><a href="/brief">Edit brief</a></li><li><span>3</span><div><strong>Invite teammates</strong><small>Share the unique Team Code for this project.</small></div><a href="/team">Open Live</a></li></ol></section></div></div></section>{showProjectModal && <div className="modal-backdrop" onMouseDown={() => setShowProjectModal(false)}><form className="modal project-modal" onSubmit={createProject} onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setShowProjectModal(false)} aria-label="Close">×</button><span className="eyebrow">CREATE PROJECT</span><h2>Start a separate project space</h2><p>Projects keep sources, AI memory, and live teammate coordination separate.</p><label className="form-field"><span>Project name</span><input autoFocus value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. Mobile app redesign" required maxLength={80} /></label><label className="form-field"><span>Project goal <em>optional</em></span><textarea value={projectGoal} onChange={(event) => setProjectGoal(event.target.value)} placeholder="What is this project trying to achieve?" rows={3} /></label><label className="file-field"><input type="file" accept=".md,.markdown,.txt" onChange={(event) => setProjectFile(event.target.files?.[0] || null)} /><span className="file-field-icon">↑</span><span><strong>{projectFile ? projectFile.name : "Add a project file"}</strong><small>Optional · Markdown or text · indexed after the project is created</small></span></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowProjectModal(false)}>Cancel</button><button type="submit" className="primary-button" disabled={creating}>{creating ? "Creating…" : "Create project"}</button></div></form></div>}{showSourceModal && <div className="modal-backdrop" onMouseDown={() => setShowSourceModal(false)}><section className="modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setShowSourceModal(false)} aria-label="Close">×</button><span className="eyebrow">ADD SOURCE</span><h2>Add shared project context</h2><p>Upload a Markdown or text file now, or manage GitHub repositories and notes on the Sources page.</p><button className="drop-zone" type="button" onClick={() => sourceFileRef.current?.click()}><span className="upload-icon">↑</span><strong>Choose a project file</strong><small>Markdown and text files are indexed into {activeProject.name}.</small></button><a className="github-button" href="/sources">Manage all source types →</a></section></div>}<input ref={sourceFileRef} type="file" accept=".md,.markdown,.txt" onChange={addSource} hidden /></main>;
}
