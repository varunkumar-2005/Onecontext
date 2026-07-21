chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!["onecontext:inject", "onecontext:save-handoff", "onecontext:sync-turns"].includes(message.type)) return false;
  chrome.storage.local.get({ apiUrl: "http://localhost:3000", projectId: "atlas-project", gatewayKey: "" }, async (settings) => {
    try {
      const provider = message.provider || "chatgpt";
      const key = String(settings.gatewayKey || "").trim().replace(/^ONECONTEXT_GATEWAY_KEY=/, "").replace(/^['\"]|['\"]$/g, "");
      const isHandoff = message.type === "onecontext:save-handoff";
      const isSync = message.type === "onecontext:sync-turns";
      const endpoint = isHandoff ? "/api/v1/gateway/handoff" : isSync ? "/api/v1/gateway/conversations/turns" : `/api/v1/gateway/${provider}/inject`;
      const body = isHandoff ? { project_id: settings.projectId, provider, prompt: message.prompt, answer: message.answer } : isSync ? { project_id: settings.projectId, provider, conversation_id: message.conversationId, turns: message.turns } : { project_id: settings.projectId, raw_prompt: message.rawPrompt };
      const response = await fetch(`${settings.apiUrl.replace(/\/$/, "")}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { "X-OneContext-Key": key } : {}) }, body: JSON.stringify(body) });
      const data = await response.json();
      sendResponse(response.ok ? { ok: true, data } : { ok: false, error: data.error?.message || "Gateway request failed" });
    } catch (error) {
      sendResponse({ ok: false, error: "Could not connect to the OneContext API." });
    }
  });
  return true;
});
