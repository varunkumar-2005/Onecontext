import WebSocket from "ws";

const [teamCode, userName = "Priya", filePath = "apps/vscode-extension/package.json", summary = "Refactoring extension configuration"] = process.argv.slice(2);
if (!teamCode) { console.error("Usage: npm run demo:teammate -- <TEAM_CODE> [name] [file] [task summary]"); process.exit(1); }

const realtimeUrl = process.env.ONECONTEXT_REALTIME_URL || "ws://localhost:8787/live";
const userId = `demo-${userName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
const url = `${realtimeUrl}?project_id=atlas-project&team_code=${encodeURIComponent(teamCode)}&user_id=${encodeURIComponent(userId)}&user_name=${encodeURIComponent(userName)}`;
const socket = new WebSocket(url);

socket.on("open", () => {
  socket.send(JSON.stringify({ type: "intent:start", file_path: filePath, intent_summary: summary }));
  console.log(`${userName} joined OneContext Live on ${filePath}. Keep this terminal open; press Ctrl+C to leave.`);
});
socket.on("message", (raw) => {
  const event = JSON.parse(raw.toString());
  if (event.type === "conflict:warning") console.log(`Conflict warning: ${event.conflicting_user} is working on ${event.file_path}`);
});
socket.on("error", () => { console.error("Could not reach the realtime server. Run npm run realtime first."); process.exit(1); });
process.on("SIGINT", () => { socket.send(JSON.stringify({ type: "intent:end" })); socket.close(); process.exit(0); });
