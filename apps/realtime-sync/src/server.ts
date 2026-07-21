import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { deleteIntent, listIntents, setIntent, type Intent } from "./presence";

const port = Number(process.env.REALTIME_PORT || 8787);
const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  response.setHeader("Content-Type", "application/json");
  if (url.pathname === "/presence") { response.writeHead(200); response.end(JSON.stringify({ active_intents: await listIntents(url.searchParams.get("project_id") || "atlas-project") })); return; }
  response.writeHead(200); response.end(JSON.stringify({ ok: true, service: "onecontext-realtime-sync", transport: "websocket" }));
});
const sockets = new Map<WebSocket, { projectId: string; userId: string; userName: string; teamCode: string }>();
const wss = new WebSocketServer({ server, path: "/live" });

function send(socket: WebSocket, type: string, payload: unknown) { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, ...payload as object })); }
async function broadcast(projectId: string) { const activeIntents = await listIntents(projectId); for (const [socket, info] of sockets) if (info.projectId === projectId) send(socket, "presence:update", { active_intents: activeIntents }); }
function conflict(intent: Intent, active: Intent[]) { const words = new Set(intent.summary.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3)); return active.filter((other) => other.userId !== intent.userId && (other.filePath.toLowerCase() === intent.filePath.toLowerCase() || Array.from(words).some((word) => other.summary.toLowerCase().includes(word)))); }

wss.on("connection", (socket, request) => {
  const params = new URL(request.url || "/live", `http://${request.headers.host || "localhost"}`).searchParams;
  const projectId = params.get("project_id") || "atlas-project"; const teamCode = params.get("team_code") || ""; const userId = params.get("user_id") || `vscode-${Date.now()}`; const userName = params.get("user_name") || "VS Code teammate";
  if (!/^ONECTX-[A-Z0-9]{6}$/.test(teamCode)) { socket.close(1008, "A valid Team Code is required."); return; }
  sockets.set(socket, { projectId, userId, userName, teamCode });
  void listIntents(projectId).then((activeIntents) => send(socket, "presence:update", { active_intents: activeIntents }));
  socket.on("message", async (raw) => {
    try {
      const event = JSON.parse(raw.toString()) as { type?: string; file_path?: string; intent_summary?: string; commit_message?: string };
      if (event.type === "intent:start" || event.type === "intent:file_change") {
        const now = new Date().toISOString(); const active = await listIntents(projectId); const prior = active.find((item) => item.userId === userId);
        const intent: Intent = { userId, userName, projectId, filePath: event.file_path?.trim() || prior?.filePath || "workspace", summary: event.intent_summary?.trim() || prior?.summary || "Working in this area", startedAt: prior?.startedAt || now, lastActiveAt: now, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
        await setIntent(intent); const conflicts = conflict(intent, await listIntents(projectId));
        void fetch(`${process.env.ONECONTEXT_API_URL || "http://localhost:3000"}/api/v1/teams/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ team_code: teamCode, project_id: projectId, type: "task_started", title: intent.summary, rationale: intent.filePath }) }).catch(() => undefined);
        for (const [peer, info] of sockets) if (info.projectId === projectId && conflicts.some((item) => item.userId === info.userId)) send(peer, "conflict:warning", { conflicting_user: userName, shared_node: intent.filePath, file_path: intent.filePath, message: intent.summary });
        await broadcast(projectId);
      } else if (event.type === "file:saved") {
        void fetch(`${process.env.ONECONTEXT_API_URL || "http://localhost:3000"}/api/v1/teams/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ team_code: teamCode, project_id: projectId, type: "file_saved", title: `Saved ${event.file_path || "workspace file"}`, rationale: event.file_path || "" }) }).catch(() => undefined);
      } else if (event.type === "intent:complete") {
        const active = await listIntents(projectId); const prior = active.find((item) => item.userId === userId);
        await deleteIntent(projectId, userId); await broadcast(projectId);
        void fetch(`${process.env.ONECONTEXT_API_URL || "http://localhost:3000"}/api/v1/teams/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ team_code: teamCode, project_id: projectId, type: "task_completed", title: event.intent_summary || prior?.summary || "Completed live task", rationale: event.file_path || prior?.filePath || "workspace" }) }).catch(() => undefined);
      } else if (event.type === "intent:heartbeat") {
        const active = await listIntents(projectId); const prior = active.find((item) => item.userId === userId); if (prior) await setIntent({ ...prior, lastActiveAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() }); await broadcast(projectId);
      } else if (event.type === "intent:end") { await deleteIntent(projectId, userId); await broadcast(projectId); }
      else if (event.type === "commit") {
        await deleteIntent(projectId, userId); await broadcast(projectId);
        void fetch(`${process.env.ONECONTEXT_API_URL || "http://localhost:3000"}/api/v1/teams/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ team_code: teamCode, project_id: projectId, type: "commit", title: event.commit_message || "Committed live work", rationale: `Committed by ${userName} from VS Code.` })
        }).catch(() => undefined);
      }
    } catch { send(socket, "error", { message: "Invalid realtime event." }); }
  });
  socket.on("close", () => { sockets.delete(socket); });
});
server.listen(port, () => console.log(`OneContext realtime sync listening on ws://localhost:${port}/live`));
