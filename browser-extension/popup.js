const apiUrl = document.getElementById("apiUrl");
const projectId = document.getElementById("projectId");
const gatewayKey = document.getElementById("gatewayKey");
const statusText = document.getElementById("statusText");

chrome.storage.sync.get({ apiUrl: "http://localhost:3000", projectId: "atlas-project", gatewayKey: "" }, (settings) => {
  apiUrl.value = settings.apiUrl;
  projectId.value = settings.projectId;
  gatewayKey.value = settings.gatewayKey;
});

function normalizedGatewayKey(value) {
  const trimmed = value.trim();
  const prefix = "ONECONTEXT_GATEWAY_KEY=";
  return trimmed.startsWith(prefix) ? trimmed.slice(prefix.length).trim().replace(/^['\"]|['\"]$/g, "") : trimmed;
}

document.getElementById("save").addEventListener("click", async () => {
  const settings = {
    apiUrl: apiUrl.value.replace(/\/$/, ""),
    projectId: projectId.value.trim(),
    gatewayKey: normalizedGatewayKey(gatewayKey.value),
  };
  gatewayKey.value = settings.gatewayKey;
  statusText.textContent = "Verifying…";
  await Promise.all([
    chrome.storage.sync.set(settings),
    chrome.storage.local.set(settings),
  ]);
  try {
    const response = await fetch(`${settings.apiUrl}/api/v1/gateway/verify`, {
      headers: settings.gatewayKey ? { "X-OneContext-Key": settings.gatewayKey } : {},
    });
    if (response.ok) statusText.textContent = "Connected — gateway key accepted";
    else statusText.textContent = "Gateway key was rejected — paste the value after =";
  } catch {
    statusText.textContent = "Cannot reach API — check the API URL and app server";
  }
});
