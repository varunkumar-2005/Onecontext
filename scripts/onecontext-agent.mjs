import fs from "node:fs";
const localEnv = ".env.local";
if (fs.existsSync(localEnv)) for (const line of fs.readFileSync(localEnv, "utf8").split(/\r?\n/)) { const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (match && !process.env[match[1]]) process.env[match[1]] = match[2]; }
const [agent = "generic", ...promptParts] = process.argv.slice(2);
const prompt = promptParts.join(" ").trim();
if (!prompt) { console.error("Usage: node scripts/onecontext-agent.mjs <agent> <prompt>"); process.exit(1); }
const baseUrl = (process.env.ONECONTEXT_API_URL || "http://localhost:3000").replace(/\/$/, "");
const response = await fetch(`${baseUrl}/api/v1/gateway/${encodeURIComponent(agent)}/inject`, { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.ONECONTEXT_GATEWAY_KEY ? { "X-OneContext-Key": process.env.ONECONTEXT_GATEWAY_KEY } : {}) }, body: JSON.stringify({ project_id: process.env.ONECONTEXT_PROJECT_ID || "atlas-project", raw_prompt: prompt }) });
const data = await response.json();
if (!response.ok) { console.error(data.error?.message || "OneContext gateway failed"); process.exit(1); }
const augmentedPrompt = data.augmented_prompt;
const command = process.env.ONECONTEXT_CODEX_COMMAND;
if (!command || agent !== "codex") { process.stdout.write(augmentedPrompt); process.exit(0); }
const { spawn } = await import("node:child_process");
const args = (process.env.ONECONTEXT_CODEX_ARGS || "exec").split(" ").filter(Boolean);
const child = spawn(command, [...args, augmentedPrompt], { shell: true, cwd: process.cwd(), env: process.env });
let answer = ""; child.stdout.on("data", (chunk) => { answer += chunk.toString(); process.stdout.write(chunk); }); child.stderr.on("data", (chunk) => process.stderr.write(chunk));
child.on("error", () => { console.error("Codex command could not be started. Set ONECONTEXT_CODEX_COMMAND or run this script without it to preview the augmented prompt."); process.exitCode = 1; });
child.on("close", async (code) => { if (code !== 0 || !answer.trim() || !process.env.ONECONTEXT_TEAM_CODE) return; await fetch(`${baseUrl}/api/v1/teams/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ team_code: process.env.ONECONTEXT_TEAM_CODE, project_id: process.env.ONECONTEXT_PROJECT_ID || "atlas-project", type: "answer_saved", agent: "codex", title: `Codex answer: ${prompt.slice(0, 140)}`, prompt, answer }) }).catch(() => undefined); });
