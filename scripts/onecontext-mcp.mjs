import fs from "node:fs";

if (fs.existsSync(".env.local")) for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const baseUrl = (process.env.ONECONTEXT_API_URL || "http://localhost:3000").replace(/\/$/, "");
const projectId = process.env.ONECONTEXT_PROJECT_ID || "atlas-project";
const headers = { "Content-Type": "application/json", ...(process.env.ONECONTEXT_GATEWAY_KEY ? { "X-OneContext-Key": process.env.ONECONTEXT_GATEWAY_KEY } : {}) };

function writeMessage(message, framed) {
  const json = JSON.stringify(message);
  if (framed) process.stdout.write(`Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`);
  else process.stdout.write(`${json}\n`);
}

function response(id, result, framed) { writeMessage({ jsonrpc: "2.0", id, result }, framed); }
function error(id, message, framed) { writeMessage({ jsonrpc: "2.0", id, error: { code: -32603, message } }, framed); }

async function callTool(name, input = {}) {
  if (name === "onecontext_get_context") {
    const prompt = String(input.prompt || "").trim();
    if (!prompt) throw new Error("prompt is required");
    const result = await fetch(`${baseUrl}/api/v1/gateway/codex/inject`, { method: "POST", headers, body: JSON.stringify({ project_id: input.project_id || projectId, raw_prompt: prompt }) });
    const data = await result.json();
    if (!result.ok) throw new Error(data.error?.message || "Context retrieval failed");
    return data.augmented_prompt;
  }
  if (name === "onecontext_publish_update") {
    const result = await fetch(`${baseUrl}/api/v1/gateway/agent-update`, { method: "POST", headers, body: JSON.stringify({ project_id: input.project_id || projectId, agent: input.agent || "codex", summary: input.summary, files: input.files || [], status: input.status || "in_progress" }) });
    const data = await result.json();
    if (!result.ok) throw new Error(data.error?.message || "Update could not be saved");
    return "Shared update saved to OneContext.";
  }
  if (name === "onecontext_save_handoff") {
    const result = await fetch(`${baseUrl}/api/v1/gateway/agent-update`, { method: "POST", headers, body: JSON.stringify({ project_id: input.project_id || projectId, agent: input.agent || "codex", summary: input.summary || "Completed agent handoff", files: input.files || [], status: "handoff", prompt: input.prompt, answer: input.answer, conversation_id: input.conversation_id || "mcp-handoff" }) });
    const data = await result.json();
    if (!result.ok) throw new Error(data.error?.message || "Handoff could not be saved");
    return "Handoff distilled into shared memory for the next teammate or agent.";
  }
  if (name === "onecontext_check_conflicts") {
    const result = await fetch(`${process.env.ONECONTEXT_REALTIME_HTTP_URL || "http://localhost:8787"}/presence?project_id=${encodeURIComponent(input.project_id || projectId)}`);
    const data = await result.json();
    return JSON.stringify(data.active_intents || [], null, 2);
  }
  throw new Error(`Unknown tool: ${name}`);
}

const tools = [
  { name: "onecontext_get_context", description: "Get relevant shared OneContext memory before planning or coding.", inputSchema: { type: "object", properties: { prompt: { type: "string" }, project_id: { type: "string" } }, required: ["prompt"] } },
  { name: "onecontext_publish_update", description: "Save a concise work update, decision, or current task for the team.", inputSchema: { type: "object", properties: { summary: { type: "string" }, files: { type: "array", items: { type: "string" } }, status: { type: "string", enum: ["in_progress", "completed"] } }, required: ["summary"] } },
  { name: "onecontext_save_handoff", description: "Save a completed agent turn and let OneContext distill durable project memory.", inputSchema: { type: "object", properties: { prompt: { type: "string" }, answer: { type: "string" }, summary: { type: "string" }, files: { type: "array", items: { type: "string" } } }, required: ["prompt", "answer"] } },
  { name: "onecontext_check_conflicts", description: "List active team intent before changing related files.", inputSchema: { type: "object", properties: { project_id: { type: "string" } } } }
];

async function handleRequest(raw, framed) {
  let request;
  try { request = JSON.parse(raw); } catch { return; }
  try {
    if (request.method === "initialize") {
      const requestedVersion = request.params?.protocolVersion;
      const protocolVersion = typeof requestedVersion === "string" ? requestedVersion : "2025-06-18";
      return response(request.id, { protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "onecontext", version: "0.1.2" } }, framed);
    }
    if (request.method === "notifications/initialized") return;
    if (request.method === "tools/list") return response(request.id, { tools }, framed);
    if (request.method === "tools/call") {
      const text = await callTool(request.params?.name, request.params?.arguments);
      return response(request.id, { content: [{ type: "text", text }] }, framed);
    }
    if (request.id !== undefined) error(request.id, "Method not found", framed);
  } catch (cause) {
    if (request.id !== undefined) error(request.id, cause instanceof Error ? cause.message : "MCP server error", framed);
  }
}

let inputBuffer = Buffer.alloc(0);
let queue = Promise.resolve();
function enqueue(raw, framed) { queue = queue.then(() => handleRequest(raw, framed)); }
function drainInput() {
  while (inputBuffer.length) {
    while (inputBuffer[0] === 10 || inputBuffer[0] === 13) inputBuffer = inputBuffer.subarray(1);
    if (!inputBuffer.length) return;
    const headerText = inputBuffer.subarray(0, Math.min(inputBuffer.length, 256)).toString("utf8");
    if (/^Content-Length:/i.test(headerText)) {
      const separator = inputBuffer.indexOf(Buffer.from("\r\n\r\n"));
      const separatorLength = separator >= 0 ? 4 : inputBuffer.indexOf(Buffer.from("\n\n")) >= 0 ? 2 : 0;
      const separatorIndex = separator >= 0 ? separator : inputBuffer.indexOf(Buffer.from("\n\n"));
      if (separatorIndex < 0) return;
      const lengthMatch = headerText.match(/^Content-Length:\s*(\d+)/i);
      if (!lengthMatch) { inputBuffer = inputBuffer.subarray(separatorIndex + separatorLength); continue; }
      const bodyStart = separatorIndex + separatorLength;
      const bodyLength = Number(lengthMatch[1]);
      if (inputBuffer.length < bodyStart + bodyLength) return;
      enqueue(inputBuffer.subarray(bodyStart, bodyStart + bodyLength).toString("utf8"), true);
      inputBuffer = inputBuffer.subarray(bodyStart + bodyLength);
      continue;
    }
    const newline = inputBuffer.indexOf(10);
    if (newline < 0) return;
    const line = inputBuffer.subarray(0, newline).toString("utf8").trim();
    inputBuffer = inputBuffer.subarray(newline + 1);
    if (line) enqueue(line, false);
  }
}

process.stdin.on("data", (chunk) => { inputBuffer = Buffer.concat([inputBuffer, chunk]); drainInput(); });
