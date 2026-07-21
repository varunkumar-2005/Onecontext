"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const ws_1 = require("ws");
const presence_1 = require("./presence");
const port = Number(process.env.REALTIME_PORT || 8787);
const server = (0, node_http_1.createServer)(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    response.setHeader("Content-Type", "application/json");
    if (url.pathname === "/presence") {
        response.writeHead(200);
        response.end(JSON.stringify({ active_intents: await (0, presence_1.listIntents)(url.searchParams.get("project_id") || "atlas-project") }));
        return;
    }
    response.writeHead(200);
    response.end(JSON.stringify({ ok: true, service: "onecontext-realtime-sync", transport: "websocket" }));
});
const sockets = new Map();
const wss = new ws_1.WebSocketServer({ server, path: "/live" });
function send(socket, type, payload) { if (socket.readyState === ws_1.WebSocket.OPEN)
    socket.send(JSON.stringify({ type, ...payload })); }
async function broadcast(projectId) { const activeIntents = await (0, presence_1.listIntents)(projectId); for (const [socket, info] of sockets)
    if (info.projectId === projectId)
        send(socket, "presence:update", { active_intents: activeIntents }); }
function conflict(intent, active) { const words = new Set(intent.summary.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3)); return active.filter((other) => other.userId !== intent.userId && (other.filePath.toLowerCase() === intent.filePath.toLowerCase() || Array.from(words).some((word) => other.summary.toLowerCase().includes(word)))); }
wss.on("connection", (socket, request) => {
    const params = new URL(request.url || "/live", `http://${request.headers.host || "localhost"}`).searchParams;
    const projectId = params.get("project_id") || "atlas-project";
    const teamCode = params.get("team_code") || "";
    const userId = params.get("user_id") || `vscode-${Date.now()}`;
    const userName = params.get("user_name") || "VS Code teammate";
    if (!/^ONECTX-[A-Z0-9]{6}$/.test(teamCode)) {
        socket.close(1008, "A valid Team Code is required.");
        return;
    }
    sockets.set(socket, { projectId, userId, userName, teamCode });
    void (0, presence_1.listIntents)(projectId).then((activeIntents) => send(socket, "presence:update", { active_intents: activeIntents }));
    socket.on("message", async (raw) => {
        try {
            const event = JSON.parse(raw.toString());
            if (event.type === "intent:start" || event.type === "intent:file_change") {
                const now = new Date().toISOString();
                const active = await (0, presence_1.listIntents)(projectId);
                const prior = active.find((item) => item.userId === userId);
                const intent = { userId, userName, projectId, filePath: event.file_path?.trim() || prior?.filePath || "workspace", summary: event.intent_summary?.trim() || prior?.summary || "Working in this area", startedAt: prior?.startedAt || now, lastActiveAt: now, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
                await (0, presence_1.setIntent)(intent);
                const conflicts = conflict(intent, await (0, presence_1.listIntents)(projectId));
                void fetch(`${process.env.ONECONTEXT_API_URL || "http://localhost:3000"}/api/v1/teams/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ team_code: teamCode, project_id: projectId, type: "task_started", title: intent.summary, rationale: intent.filePath }) }).catch(() => undefined);
                for (const [peer, info] of sockets)
                    if (info.projectId === projectId && conflicts.some((item) => item.userId === info.userId))
                        send(peer, "conflict:warning", { conflicting_user: userName, shared_node: intent.filePath, file_path: intent.filePath, message: intent.summary });
                await broadcast(projectId);
            }
            else if (event.type === "file:saved") {
                void fetch(`${process.env.ONECONTEXT_API_URL || "http://localhost:3000"}/api/v1/teams/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ team_code: teamCode, project_id: projectId, type: "file_saved", title: `Saved ${event.file_path || "workspace file"}`, rationale: event.file_path || "" }) }).catch(() => undefined);
            }
            else if (event.type === "intent:complete") {
                const active = await (0, presence_1.listIntents)(projectId);
                const prior = active.find((item) => item.userId === userId);
                await (0, presence_1.deleteIntent)(projectId, userId);
                await broadcast(projectId);
                void fetch(`${process.env.ONECONTEXT_API_URL || "http://localhost:3000"}/api/v1/teams/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ team_code: teamCode, project_id: projectId, type: "task_completed", title: event.intent_summary || prior?.summary || "Completed live task", rationale: event.file_path || prior?.filePath || "workspace" }) }).catch(() => undefined);
            }
            else if (event.type === "intent:heartbeat") {
                const active = await (0, presence_1.listIntents)(projectId);
                const prior = active.find((item) => item.userId === userId);
                if (prior)
                    await (0, presence_1.setIntent)({ ...prior, lastActiveAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
                await broadcast(projectId);
            }
            else if (event.type === "intent:end") {
                await (0, presence_1.deleteIntent)(projectId, userId);
                await broadcast(projectId);
            }
            else if (event.type === "commit") {
                await (0, presence_1.deleteIntent)(projectId, userId);
                await broadcast(projectId);
                void fetch(`${process.env.ONECONTEXT_API_URL || "http://localhost:3000"}/api/v1/teams/events`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ team_code: teamCode, project_id: projectId, type: "commit", title: event.commit_message || "Committed live work", rationale: `Committed by ${userName} from VS Code.` })
                }).catch(() => undefined);
            }
        }
        catch {
            send(socket, "error", { message: "Invalid realtime event." });
        }
    });
    socket.on("close", () => { sockets.delete(socket); });
});
server.listen(port, () => console.log(`OneContext realtime sync listening on ws://localhost:${port}/live`));
