# OneContext Chrome extension

OneContext is a Manifest V3 Chrome extension for ChatGPT and Claude. It adds an **Add context** action beside supported prompts and inserts relevant memory from the active OneContext project.

## What it demonstrates

1. Ask a project question in ChatGPT.
2. Click **Add context**.
3. OneContext retrieves the project's brief, sources, decisions, and recent activity.
4. The prompt is updated with a `[PROJECT CONTEXT - OneContext]` block.
5. Open Claude and click **Add context** there to continue with the same project memory.

Casual prompts such as `Hi, how are you?` are intentionally not treated as project prompts, so no project context is added.

## Local installation

1. Start the web application from the repository root with `npm run dev`.
2. Open Chrome and visit `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `browser-extension` folder.
6. Open the OneContext extension popup and set:

   ```text
   API URL: http://localhost:3000
   Project ID: atlas-project
   Gateway key: the value of ONECONTEXT_GATEWAY_KEY from .env.local
   ```

7. Click **Save & verify**.
8. Refresh ChatGPT or Claude.

For a second laptop on the same Wi-Fi network, replace `localhost` with the host laptop's reachable IPv4 address, for example:

```text
API URL: http://192.168.31.79:3000
Project ID: atlas-project
Gateway key: the same private gateway key as the host
```

The IP address is only an example. Find the host's current Wi-Fi IPv4 address with `ipconfig`.

## Supported pages

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://claude.ai/*`

If the button is missing, make sure the extension is enabled, the page was refreshed after loading the unpacked extension, and the prompt is project-related.
