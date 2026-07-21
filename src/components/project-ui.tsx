"use client";

import { useEffect, useState } from "react";

export type ActiveProject = { id: string; name: string };
const fallbackProject: ActiveProject = { id: "atlas-project", name: "Atlas project" };

export function useActiveProject() {
  const [project, setProject] = useState<ActiveProject>(fallbackProject);
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      const sharedId = params.get("project"); const sharedName = params.get("projectName");
      const next = sharedId ? { id: sharedId, name: sharedName || "Shared project" } : { id: window.localStorage.getItem("onecontext.activeProjectId") || fallbackProject.id, name: window.localStorage.getItem("onecontext.activeProjectName") || fallbackProject.name };
      if (sharedId) { window.localStorage.setItem("onecontext.activeProjectId", next.id); window.localStorage.setItem("onecontext.activeProjectName", next.name); }
      setProject(next);
    };
    sync();
    window.addEventListener("onecontext:project-changed", sync);
    return () => window.removeEventListener("onecontext:project-changed", sync);
  }, []);
  return project;
}

export function ProjectPageHeader() {
  const project = useActiveProject();
  return <header className="structured-header"><a href="/" className="back-navigation"><span aria-hidden="true">←</span> Back to overview</a><a href="/" className="project-header-brand">OneContext</a><strong>{project.name}</strong></header>;
}
