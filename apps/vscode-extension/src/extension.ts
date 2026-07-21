import * as vscode from "vscode";
import WebSocket from "ws";
import * as path from "node:path";
import * as fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

type Intent = { userId: string; userName: string; filePath: string; summary: string; startedAt: string };
type LiveEvent = { type: string; active_intents?: Intent[]; conflicting_user?: string; file_path?: string; message?: string };
const execFileAsync = promisify(execFile);

let socket: WebSocket | undefined;
let extensionContext: vscode.ExtensionContext;
let status: vscode.StatusBarItem;
let presence: Intent[] = [];
let view: PresenceView;
let joinedProjectId = "";
let joinedTeamCode = "";
let manualTaskSummary = "";
let automaticIntentTimer: NodeJS.Timeout | undefined;

function apiBase() { return vscode.workspace.getConfiguration("onecontext").get<string>("apiBaseUrl", "http://localhost:3000").replace(/\/$/, ""); }
function realtimeBase() { return vscode.workspace.getConfiguration("onecontext").get<string>("realtimeUrl", "ws://localhost:8787/live"); }
function currentFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return "workspace";
  const documentPath = editor.document.uri.fsPath;
  const root = projectRoot();
  if (documentPath && root && documentPath.toLowerCase().startsWith(root.toLowerCase())) return path.relative(root, documentPath).replace(/\\/g, "/");
  return vscode.workspace.asRelativePath(editor.document.uri).replace(/\\/g, "/");
}
function send(type: string, payload: Record<string, string> = {}) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, ...payload })); }
function projectRoot() { const configured = vscode.workspace.getConfiguration("onecontext").get<string>("projectRoot", "").trim(); if (configured) return configured; const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath; if (workspace && fs.existsSync(path.join(workspace, "scripts", "onecontext-agent.mjs"))) return workspace; return path.resolve(extensionContext.extensionPath, "..", ".."); }

async function joinTeam() {
  const teamCode = await vscode.window.showInputBox({ prompt: "Enter your OneContext Team Code", placeHolder: "ONECTX-ABC123", ignoreFocusOut: true }); if (!teamCode) return;
  const userName = await vscode.window.showInputBox({ prompt: "What should teammates call you?", value: await extensionContext.secrets.get("onecontext.userName") || "Teammate", ignoreFocusOut: true }); if (!userName) return;
  const response = await fetch(`${apiBase()}/api/v1/teams/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ team_code: teamCode }) });
  if (!response.ok) { vscode.window.showErrorMessage("OneContext could not find that Team Code."); return; }
  const data = await response.json() as { project_id: string; team_code: string };
  joinedProjectId = data.project_id; joinedTeamCode = data.team_code;
  await extensionContext.secrets.store("onecontext.teamCode", data.team_code); await extensionContext.secrets.store("onecontext.projectId", data.project_id); await extensionContext.secrets.store("onecontext.userName", userName);
  connect(data.project_id, data.team_code, userName); vscode.window.showInformationMessage(`Connected to OneContext Live: ${data.project_id}`);
}

function queueAutomaticIntent(reason: "active file" | "saved file") {
  if (!vscode.workspace.getConfiguration("onecontext").get<boolean>("automaticPresence", true)) return;
  if (automaticIntentTimer) clearTimeout(automaticIntentTimer);
  automaticIntentTimer = setTimeout(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    send("intent:start", { file_path: currentFile(), intent_summary: manualTaskSummary || `Editing ${path.basename(currentFile())} (${reason})` });
  }, 1_200);
}

function connect(projectId: string, teamCode: string, userName: string) {
  socket?.close(); const userId = `vscode-${(extensionContext.extension.id + userName).replace(/[^a-z0-9]/gi, "-").toLowerCase()}`; const url = `${realtimeBase()}?project_id=${encodeURIComponent(projectId)}&team_code=${encodeURIComponent(teamCode)}&user_id=${encodeURIComponent(userId)}&user_name=${encodeURIComponent(userName)}`; socket = new WebSocket(url);
  socket.on("open", () => { status.text = "$(sparkle) Ask Codex with OneContext"; status.command = "onecontext.askCodex"; queueAutomaticIntent("active file"); });
  socket.on("message", (raw) => { const event = JSON.parse(raw.toString()) as LiveEvent; if (event.type === "presence:update") { presence = event.active_intents || []; view.refresh(presence, userId); void writeAgentContext(presence); } if (event.type === "conflict:warning") vscode.window.showWarningMessage(`OneContext Live: ${event.conflicting_user} is also working on ${event.file_path} — ${event.message}`); });
  socket.on("close", () => { status.text = "$(plug) Join OneContext Team"; status.command = "onecontext.joinTeam"; });
  socket.on("error", () => vscode.window.showWarningMessage("OneContext realtime service is unavailable. Start npm run realtime first."));
}

async function startTask() { if (!socket || socket.readyState !== WebSocket.OPEN) return vscode.window.showWarningMessage("Join a OneContext team first."); const summary = await vscode.window.showInputBox({ prompt: "What are you about to work on?", placeHolder: "Refactoring JWT token expiry logic", ignoreFocusOut: true }); if (summary) { manualTaskSummary = summary; send("intent:start", { file_path: currentFile(), intent_summary: summary }); } }
async function completeTask() { if (!socket || socket.readyState !== WebSocket.OPEN) return vscode.window.showWarningMessage("Join a OneContext team first."); const summary = await vscode.window.showInputBox({ prompt: "What did you complete? OneContext will save this as a shared handoff.", value: manualTaskSummary || "Completed work in this area", ignoreFocusOut: true }); if (!summary) return; send("intent:complete", { file_path: currentFile(), intent_summary: summary }); manualTaskSummary = ""; }
function leaveTeam() { send("intent:end"); socket?.close(); presence = []; manualTaskSummary = ""; view.refresh([], ""); status.text = "$(plug) Join OneContext Team"; status.command = "onecontext.joinTeam"; }

async function askCodex() {
  if (!joinedTeamCode) return vscode.window.showWarningMessage("Join a OneContext team before asking Codex.");
  const prompt = await vscode.window.showInputBox({ prompt: "Ask Codex with shared OneContext context", placeHolder: "How should I implement this task without conflicting with the team?", ignoreFocusOut: true }); if (!prompt) return;
  const root = projectRoot(); const wrapper = path.join(root, "scripts", "onecontext-agent.mjs");
  if (!fs.existsSync(wrapper)) return vscode.window.showErrorMessage("OneContext agent wrapper was not found. Set onecontext.projectRoot to the project root.");
  const config = vscode.workspace.getConfiguration("onecontext"); const codexCommand = config.get<string>("codexCommand", "").trim(); const codexArgs = config.get<string>("codexArgs", "exec").trim();
  status.text = "$(sync~spin) Asking Codex…";
  try {
    const result = await execFileAsync(process.execPath, [wrapper, "codex", prompt], { cwd: root, env: { ...process.env, ONECONTEXT_TEAM_CODE: joinedTeamCode, ONECONTEXT_PROJECT_ID: joinedProjectId || "atlas-project", ...(codexCommand ? { ONECONTEXT_CODEX_COMMAND: codexCommand, ONECONTEXT_CODEX_ARGS: codexArgs } : {}) }, maxBuffer: 1024 * 1024 * 8 });
    await showCodexDocument(codexCommand ? "Codex response — saved to OneContext" : "Codex context preview", result.stdout || result.stderr || "Codex returned no text.");
    if (codexCommand) vscode.window.showInformationMessage("Codex response captured and saved to shared OneContext memory."); else vscode.window.showInformationMessage("Context preview ready. Configure onecontext.codexCommand to execute Codex automatically.");
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown Codex execution error.";
    vscode.window.showErrorMessage(`OneContext could not run Codex: ${detail}`);
  } finally { status.text = "$(sparkle) Ask Codex with OneContext"; status.command = "onecontext.askCodex"; }
}

async function showCodexDocument(title: string, content: string) { const document = await vscode.workspace.openTextDocument({ language: "markdown", content: `# ${title}\n\n${content}` }); await vscode.window.showTextDocument(document, { preview: true }); }
async function writeAgentContext(items: Intent[]) { const root = vscode.workspace.workspaceFolders?.[0]?.uri; if (!root) return; const text = `# OneContext Live\n\nCurrent teammate activity (generated):\n${items.length ? items.map((item) => `- ${item.userName}: ${item.filePath} — ${item.summary}`).join("\n") : "- No active teammate tasks."}\n\nCoordinate before making structural changes in overlapping areas.`; const files = [".onecontext/live-context.md", ".cursor/rules/onecontext-live.md", ".windsurf/rules/onecontext-live.md", "CLAUDE.md"]; for (const file of files) { const target = vscode.Uri.joinPath(root, file); try { await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(root, path.dirname(file))); await vscode.workspace.fs.writeFile(target, Buffer.from(text, "utf8")); } catch { /* optional agent adapter path */ } } }
async function observeGitCommits() {
  const gitExtension = vscode.extensions.getExtension("vscode.git");
  if (!gitExtension) return;
  try {
    if (!gitExtension.isActive) await gitExtension.activate();
    const api = gitExtension.exports?.getAPI?.(1);
    if (!api) return;
    for (const repository of api.repositories || []) {
      let previous = repository.state.HEAD?.commit;
      repository.state.onDidChange(() => { const next = repository.state.HEAD?.commit; if (next && previous && next !== previous) send("commit", { commit_message: `Commit ${next.slice(0, 7)}` }); previous = next; });
    }
  } catch { /* Git integration is optional; live coordination still works without it. */ }
}

class PresenceView implements vscode.WebviewViewProvider {
  private webview?: vscode.Webview;
  resolveWebviewView(webviewView: vscode.WebviewView) { this.webview = webviewView.webview; this.webview.options = { enableScripts: true }; this.webview.onDidReceiveMessage((message) => { if (message.type === "join") void joinTeam(); if (message.type === "task") void startTask(); if (message.type === "askCodex") void askCodex(); }); this.refresh(presence, ""); }
  refresh(items: Intent[], ownId: string) { if (!this.webview) return; this.webview.html = `<html><body><h3>OneContext Team</h3><div class="actions"><button data-action="join">Join team</button><button data-action="task">Start task</button><button class="primary" data-action="askCodex">Ask Codex with context</button></div>${items.length ? items.map((item) => `<p>● <strong>${escapeHtml(item.userName)}</strong><br/><small>${escapeHtml(path.basename(item.filePath))}</small><br/><span>${escapeHtml(item.summary)}${item.userId === ownId ? " (you)" : ""}</span></p>`).join("") : "<p>No active teammates.</p>"}<script>const vscode=acquireVsCodeApi();document.querySelectorAll('button').forEach((button)=>button.addEventListener('click',()=>vscode.postMessage({type:button.dataset.action})));</script><style>body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);font-size:12px}.actions{display:grid;gap:6px;margin-bottom:12px}button{border:0;border-radius:4px;padding:7px;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}button.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}h3{font-size:13px}p{border-bottom:1px solid var(--vscode-panel-border);padding:8px 0}small,span{color:var(--vscode-descriptionForeground)}</style></body></html>`; }
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character)); }

export function activate(context: vscode.ExtensionContext) {
  extensionContext = context; status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50); status.text = "$(plug) Join OneContext Team"; status.command = "onecontext.joinTeam"; status.show(); view = new PresenceView();
  context.subscriptions.push(status, vscode.commands.registerCommand("onecontext.joinTeam", joinTeam), vscode.commands.registerCommand("onecontext.startTask", startTask), vscode.commands.registerCommand("onecontext.completeTask", completeTask), vscode.commands.registerCommand("onecontext.leaveTeam", leaveTeam), vscode.commands.registerCommand("onecontext.askCodex", askCodex), vscode.window.registerWebviewViewProvider("onecontextPresence", view), vscode.window.onDidChangeActiveTextEditor(() => queueAutomaticIntent("active file")), vscode.workspace.onDidSaveTextDocument((document) => { send("file:saved", { file_path: vscode.workspace.asRelativePath(document.uri) }); queueAutomaticIntent("saved file"); }));
  const teamCode = context.secrets.get("onecontext.teamCode"); const projectId = context.secrets.get("onecontext.projectId"); const userName = context.secrets.get("onecontext.userName"); Promise.all([teamCode, projectId, userName]).then(([storedCode, storedProject, storedName]) => { if (storedCode && storedProject && storedName) { joinedProjectId = storedProject; joinedTeamCode = storedCode; connect(storedProject, storedCode, storedName); } }); void observeGitCommits();
  const heartbeat = setInterval(() => send("intent:heartbeat"), 60_000); context.subscriptions.push({ dispose: () => { clearInterval(heartbeat); if (automaticIntentTimer) clearTimeout(automaticIntentTimer); } });
}
export function deactivate() { send("intent:end"); socket?.close(); }
