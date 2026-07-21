import fs from "node:fs";
import readline from "node:readline";

if (fs.existsSync(".env.local")) for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (match && !process.env[match[1]]) process.env[match[1]] = match[2]; }
const baseUrl = (process.env.ONECONTEXT_API_URL || "http://localhost:3000").replace(/\/$/, "");
const projectId = process.env.ONECONTEXT_PROJECT_ID || "atlas-project";
const headers = { "Content-Type": "application/json", ...(process.env.ONECONTEXT_GATEWAY_KEY ? { "X-OneContext-Key": process.env.ONECONTEXT_GATEWAY_KEY } : {}) };
function response(id, result) { process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`); }
function error(id, message) { process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32603, message } })}\n`); }
async function callTool(name, input = {}) {
  if (name === "onecontext_get_context") {
    const prompt = String(input.prompt || "").trim(); if (!prompt) throw new Error("prompt is required");
    const result = await fetch(`${baseUrl}/api/v1/gateway/codex/inject`, { method: "POST", headers, body: JSON.stringify({ project_id: input.project_id || projectId, raw_prompt: prompt }) }); const data = await result.json(); if (!result.ok) throw new Error(data.error?.message || "Context retrieval failed"); return data.augmented_prompt;
  }
  if (name === "onecontext_publish_update") {
    const result = await fetch(`${baseUrl}/api/v1/gateway/agent-update`, { method: "POST", headers, body: JSON.stringify({ project_id: input.project_id || projectId, agent: input.agent || "codex", summary: input.summary, files: input.files || [], status: input.status || "in_progress" }) }); const data = await result.json(); if (!result.ok) throw new Error(data.error?.message || "Update could not be saved"); return "Shared update saved to OneContext.";
  }
  if (name === "onecontext_save_handoff") {
    const result = await fetch(`${baseUrl}/api/v1/gateway/agent-update`, { method: "POST", headers, body: JSON.stringify({ project_id: input.project_id || projectId, agent: input.agent || "codex", summary: input.summary || "Completed agent handoff", files: input.files || [], status: "handoff", prompt: input.prompt, answer: input.answer, conversation_id: input.conversation_id || "mcp-handoff" }) }); const data = await result.json(); if (!result.ok) throw new Error(data.error?.message || "Handoff could not be saved"); return "Handoff distilled into shared memory for the next teammate or agent.";
  }
  if (name === "onecontext_check_conflicts") { const result = await fetch(`${process.env.ONECONTEXT_REALTIME_HTTP_URL || "http://localhost:8787"}/presence?project_id=${encodeURIComponent(input.project_id || projectId)}`); const data = await result.json(); return JSON.stringify(data.active_intents || [], null, 2); }
  throw new Error(`Unknown tool: ${name}`);
}
const tools = [
  { name: "onecontext_get_context", description: "Get relevant shared OneContext memory before planning or coding.", inputSchema: { type: "object", properties: { prompt: { type: "string" }, project_id: { type: "string" } }, required: ["prompt"] } },
  { name: "onecontext_publish_update", description: "Save a concise work update, decision, or current task for the team.", inputSchema: { type: "object", properties: { summary: { type: "string" }, files: { type: "array", items: { type: "string" } }, status: { type: "string", enum: ["in_progress", "completed"] } }, required: ["summary"] } },
  { name: "onecontext_save_handoff", description: "Save a completed agent turn and let OneContext distill durable project memory.", inputSchema: { type: "object", properties: { prompt: { type: "string" }, answer: { type: "string" }, summary: { type: "string" }, files: { type: "array", items: { type: "string" } } }, required: ["prompt", "answer"] } },
  { name: "onecontext_check_conflicts", description: "List active team intent before changing related files.", inputSchema: { type: "object", properties: { project_id: { type: "string" } } } }
];
readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", async (line) => { try { const request = JSON.parse(line); if (request.method === "initialize") return response(request.id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "onecontext", version: "0.1.0" } }); if (request.method === "tools/list") return response(request.id, { tools }); if (request.method === "tools/call") { const text = await callTool(request.params?.name, request.params?.arguments); return response(request.id, { content: [{ type: "text", text }] }); } if (request.id !== undefined) error(request.id, "Method not found"); } catch (cause) { error(undefined, cause instanceof Error ? cause.message : "MCP server error"); } });
