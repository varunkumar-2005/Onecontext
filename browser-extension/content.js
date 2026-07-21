(() => {
  const INPUT_SELECTORS = ["textarea", "[contenteditable='true']"];
  const PROJECT_CONVERSATION_KEY = "onecontext.projectConversationId";
  let input; let contextButton; let handoffButton; let syncTimer;

  function provider() { return location.hostname.includes("claude") ? "claude" : "chatgpt"; }
  function readInput(element) { return element.value ?? element.innerText ?? element.textContent ?? ""; }
  function findInput() {
    const candidates = INPUT_SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    const visible = candidates.filter((element) => { const rect = element.getBoundingClientRect(); const style = window.getComputedStyle(element); return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none"; });
    return visible.find((element) => readInput(element).trim()) || visible[visible.length - 1] || candidates[candidates.length - 1];
  }
  function writeInput(element, value) {
    if ("value" in element) { const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set; setter?.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); }
    else { element.innerText = value; element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value })); }
  }
  function showToast(title, message) { document.querySelector(".onecontext-toast")?.remove(); const toast = document.createElement("div"); toast.className = "onecontext-toast"; toast.innerHTML = `<strong>${title}</strong><span>${message}</span>`; document.body.appendChild(toast); window.setTimeout(() => toast.remove(), 4500); }
  function latestText(selectors) { for (const selector of selectors) { const values = Array.from(document.querySelectorAll(selector)).map((element) => element.innerText?.trim()).filter(Boolean); if (values.length) return values[values.length - 1]; } return ""; }
  function conversationElements(role) {
    if (provider() === "claude") return Array.from(document.querySelectorAll(role === "user" ? '[data-testid="user-message"], [data-testid*="user-message"]' : '[data-testid="assistant-message"], [data-testid*="assistant-message"]'));
    return Array.from(document.querySelectorAll(`[data-message-author-role="${role}"]`));
  }
  function cleanPrompt(value) { return value.replace(/\[PROJECT CONTEXT[\s\S]*?\[END CONTEXT\]\s*/i, "").trim(); }
  function conversationTurns() {
    const prompts = conversationElements("user").map((element) => cleanPrompt(element.innerText || "")).filter(Boolean);
    const answers = conversationElements("assistant").map((element) => (element.innerText || "").trim()).filter(Boolean);
    const id = sessionStorage.getItem(PROJECT_CONVERSATION_KEY); if (!id) return [];
    return Array.from({ length: Math.min(prompts.length, answers.length) }, (_, index) => ({ turn_key: `${id}:${index}`, prompt: prompts[index], answer: answers[index] })).filter((turn) => turn.prompt && turn.answer);
  }
  function markProjectConversation() {
    if (!sessionStorage.getItem(PROJECT_CONVERSATION_KEY)) sessionStorage.setItem(PROJECT_CONVERSATION_KEY, `${provider()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    scheduleSync();
  }
  function scheduleSync() {
    if (!sessionStorage.getItem(PROJECT_CONVERSATION_KEY)) return;
    window.clearTimeout(syncTimer); syncTimer = window.setTimeout(syncConversation, 1800);
  }
  async function syncConversation() {
    const conversationId = sessionStorage.getItem(PROJECT_CONVERSATION_KEY); const turns = conversationTurns();
    if (!conversationId || !turns.length) return;
    try { await chrome.runtime.sendMessage({ type: "onecontext:sync-turns", provider: provider(), conversationId, turns }); } catch { /* Sync is retried after the next page update. */ }
  }
  function latestConversation() { const turns = conversationTurns(); if (turns.length) return turns[turns.length - 1]; return { prompt: latestText(provider() === "claude" ? ['[data-testid="user-message"]', '[data-testid*="user-message"]'] : ['[data-message-author-role="user"]']), answer: latestText(provider() === "claude" ? ['[data-testid="assistant-message"]', '[data-testid*="assistant-message"]'] : ['[data-message-author-role="assistant"]']) }; }
  async function injectContext() {
    input = findInput(); const rawPrompt = input && readInput(input).trim();
    if (!input || !rawPrompt) return showToast("OneContext", "Write a prompt first, then add project context.");
    contextButton.classList.add("loading"); contextButton.textContent = "Searching memory...";
    try {
      const result = await chrome.runtime.sendMessage({ type: "onecontext:inject", provider: provider(), rawPrompt });
      if (!result?.ok) throw new Error(result?.error || "Gateway request failed");
      writeInput(input, result.data.augmented_prompt);
      if (result.data.routing?.shouldInject === false) showToast("No project context added", "This prompt does not appear to be about the active project.");
      else { markProjectConversation(); showToast("Project sync enabled", "This project conversation will now sync to OneContext automatically."); }
    } catch (error) { showToast("OneContext unavailable", error instanceof Error ? error.message : "Check the API URL, gateway key, and app server."); }
    finally { contextButton.classList.remove("loading"); contextButton.textContent = "Add context"; }
  }
  async function saveHandoff() {
    const { prompt, answer } = latestConversation();
    if (!prompt || !answer) return showToast("Nothing to save", "Open a conversation with at least one user prompt and assistant answer first.");
    handoffButton.classList.add("loading"); handoffButton.textContent = "Saving...";
    try { const result = await chrome.runtime.sendMessage({ type: "onecontext:save-handoff", provider: provider(), prompt, answer }); if (!result?.ok) throw new Error(result?.error || "Could not save the handoff"); showToast("Handoff saved", "The latest turn is saved as a durable project memory item."); }
    catch (error) { showToast("Handoff unavailable", error instanceof Error ? error.message : "Check OneContext settings and try again."); }
    finally { handoffButton.classList.remove("loading"); handoffButton.textContent = "Save handoff"; }
  }
  function mount() {
    input = findInput(); if (!input || document.querySelector(".onecontext-context-button")) return;
    const parent = input.closest("form") || input.parentElement; if (!parent) return;
    contextButton = document.createElement("button"); contextButton.type = "button"; contextButton.className = "onecontext-context-button"; contextButton.textContent = "Add context"; contextButton.addEventListener("click", injectContext);
    handoffButton = document.createElement("button"); handoffButton.type = "button"; handoffButton.className = "onecontext-handoff-button"; handoffButton.textContent = "Save handoff"; handoffButton.title = "Save the latest question and answer to OneContext"; handoffButton.addEventListener("click", saveHandoff);
    parent.append(contextButton, handoffButton);
  }
  new MutationObserver(() => { mount(); scheduleSync(); }).observe(document.body, { childList: true, subtree: true });
  window.setTimeout(mount, 1500); window.setTimeout(scheduleSync, 2500);
})();
