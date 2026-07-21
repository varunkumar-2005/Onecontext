# OneContext

> A shared project memory and coordination layer for teams using different AI coding agents.

**Submission category:** Developer tools

OneContext helps a team of developers keep ChatGPT, Claude, Codex, GitHub Copilot, Cursor, and VS Code aligned around the same project. It stores useful project knowledge, retrieves only relevant context, shows live teammate intent, and warns when parallel work may overlap.

## Demo video

[Watch the OneContext demo on YouTube](https://www.youtube.com/watch?v=u8SC5cXMLcU)

## The problem

When four developers work on one repository with different AI assistants, each assistant sees a different conversation history. Important decisions stay trapped in one chat, teammates repeat work, and two people can unknowingly edit the same area.

OneContext creates a shared project layer between the team and their AI tools:

```text
Project sources, decisions, tasks, and live intent
                         |
                         v
              OneContext memory and gateway
                 /          |          \
                v           v           v
        Web dashboard   Chrome add-context   MCP / VS Code
        Memory Chat     ChatGPT + Claude     Codex + Copilot
```

The assistants remain independent. OneContext does not replace them or require the whole team to use the same provider.

## What is included

- **Project workspace:** Create/select projects and maintain a project goal and sprint brief.
- **Connected sources:** Upload Markdown/text notes and add a GitHub repository URL for indexing.
- **Memory Chat:** Ask questions about architecture, decisions, files, tasks, and project history.
- **Structured memory:** Keep concise decisions, handoffs, tasks, and project activity instead of blindly copying every conversation.
- **Knowledge Graph:** Visualize relationships between files, concepts, and decisions.
- **Decision timeline:** Review why important project choices were made.
- **Chrome extension:** Add relevant project context to ChatGPT and Claude with one button.
- **OneContext Live:** Create a Team Code, publish task intent, see active teammates, and detect overlapping work.
- **VS Code extension:** Join a team, automatically publish active-file/saved-file presence, ask Codex with team context, and save handoffs.
- **MCP server:** Give compatible coding agents a common interface for context, conflict checks, progress updates, and handoffs.
- **Codex-first CLI:** Print a context-enriched prompt for a terminal-callable Codex workflow.

## Architecture

| Layer | Implementation |
| --- | --- |
| Web application | Next.js 14, React, TypeScript |
| Persistent storage | PostgreSQL; the schema is in `infra/db/schema.sql` |
| Retrieval | Project-aware source chunking, local embeddings, optional OpenAI embeddings, and optional AI reranking |
| AI features | Optional OpenAI-powered routing, memory selection, answers, and conversation distillation |
| Live collaboration | Node/TypeScript WebSocket service; optional Redis-backed persistence |
| Browser adapter | Manifest V3 Chrome extension for ChatGPT and Claude |
| Editor adapter | VS Code extension packaged as `onecontext-vscode-0.1.2.vsix` |
| Agent adapter | MCP server plus Codex context wrapper |

### Runtime behavior

1. A user adds project sources, notes, decisions, or live intent.
2. OneContext stores project-scoped information in PostgreSQL.
3. A question is routed to the active project and relevant memories are retrieved.
4. The dashboard, Chrome extension, MCP server, or Codex wrapper receives a compact context block.
5. A teammate or AI agent can continue from the same decisions and active work.

The application works without an OpenAI API key by using local routing and retrieval fallbacks. OpenAI-powered features are optional and configured only on the server.

## Prerequisites

Install these before running the project:

- Node.js 18 or newer (Node.js 20 or 22 LTS is recommended)
- npm
- PostgreSQL 14 or newer
- Git
- Google Chrome, for the browser extension demo
- VS Code, for the live team and MCP demos
- Optional: Docker Desktop for Redis-backed realtime presence
- Optional: an OpenAI API key for AI routing, reranking, answers, or memory distillation

## Quick start: run the web app locally

### 1. Clone and install

```powershell
git clone https://github.com/varunkumar-2005/Onecontext.git
cd Onecontext
npm install
```

### 2. Create PostgreSQL

Create a database named `onecontext` in PostgreSQL. The database user must have permission to create tables and extensions used by the schema.

For a local PostgreSQL installation, a connection string looks like this:

```text
postgresql://postgres:<YOUR_PASSWORD>@localhost:5432/onecontext
```

Do not put a real password in this README or commit it to Git.

### 3. Create `.env.local`

Copy the template:

```powershell
Copy-Item .env.example .env.local
```

Then edit `.env.local`. A safe local example is:

```env
DATABASE_URL=postgresql://postgres:<YOUR_PASSWORD>@localhost:5432/onecontext
SESSION_SECRET=replace-with-a-long-random-secret

# Shared gateway authentication. Keep this private.
ONECONTEXT_GATEWAY_KEY=replace-with-a-local-gateway-key

# The project used by the demo.
ONECONTEXT_PROJECT_ID=atlas-project

# Optional AI features. Leave OPENAI_API_KEY empty to use local fallbacks.
OPENAI_API_KEY=
ONECONTEXT_USE_OPENAI_EMBEDDINGS=false
ONECONTEXT_USE_AI_ROUTING=true
ONECONTEXT_CONTEXT_ROUTER_MODEL=gpt-4o-mini
ONECONTEXT_USE_AI_RETRIEVAL=false
ONECONTEXT_USE_AI_ANSWERS=true
ONECONTEXT_USE_AI_CONVERSATION_MEMORY=false
ONECONTEXT_AI_MODEL=gpt-4o-mini

# Realtime service.
REALTIME_PORT=8787
ONECONTEXT_REALTIME_URL=ws://localhost:8787/live
REDIS_URL=redis://localhost:6379
```

The exact values in your `.env.local` are private. Never commit database passwords, OpenAI keys, session secrets, or gateway keys.

### 4. Initialize the schema

Run this once after PostgreSQL is available:

```powershell
npm run db:init
```

The initializer reads `DATABASE_URL`, creates the configured database if needed, and applies `infra/db/schema.sql`.

### 5. Start the app and realtime service

Use two PowerShell terminals from the repository root.

Terminal 1 - web application:

```powershell
npm run dev
```

Terminal 2 - live team presence:

```powershell
npm run realtime
```

Open:

- Dashboard: [http://localhost:3000](http://localhost:3000)
- Login: [http://localhost:3000/login](http://localhost:3000/login)
- Live team page: [http://localhost:3000/team](http://localhost:3000/team)

If the local seed is present, the demo account is:

```text
Email:    suresh@example.com
Password: demo1234
```

Change or remove demo credentials before deploying the project publicly.

## Dashboard walkthrough

After signing in, use the project navigation as follows:

| Page | Use |
| --- | --- |
| `/` | Project overview, memory metrics, connected sources, recent activity, and a quick project question |
| `/sources` | Upload Markdown/text files, add team notes, and connect a GitHub repository URL |
| `/brief` | Set the shared project goal and current sprint focus |
| `/chat` | Ask a grounded question about the active project memory |
| `/graph` | Explore relationships between files, concepts, and decisions |
| `/decisions` | Record decisions and their rationale |
| `/timeline` | Review project events in chronological order |
| `/team` | Create/share a Team Code, publish live intent, and see active teammates |
| `/settings` | Review project and provider configuration |

### Sample source data

For a first demo, upload or add notes containing content such as:

```markdown
# Sprint planning

Goal: Build one shared memory for a four-person AI-assisted team.
Current sprint: Capture activity and align the team's AI coding agents.

Decision: Keep retrieval provider-agnostic so each developer can keep using
their preferred coding assistant.
```

Then ask Memory Chat:

```text
What is the current project goal, what decision has the team made about retrieval, and what should a new teammate know before editing the code?
```

## Chrome extension: continue ChatGPT work in Claude

The browser extension is a local Manifest V3 extension. It adds an **Add context** action beside supported ChatGPT and Claude prompts.

### Install the extension

1. Start the web app with `npm run dev`.
2. Open Chrome and visit `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this folder:

   ```text
   C:\Users\<YOU>\Desktop\onecontext\browser-extension
   ```

6. Click the OneContext extension icon and configure:
   - **API URL:** `http://localhost:3000`
   - **Project ID:** `atlas-project`
   - **Gateway key:** the value of `ONECONTEXT_GATEWAY_KEY` from `.env.local`
7. Click **Save & verify**.
8. Refresh ChatGPT or Claude after saving.

For a second laptop, use the host laptop's reachable address instead of `localhost`, for example:

```text
API URL: http://192.168.31.79:3000
Project ID: atlas-project
Gateway key: the same private gateway key
```

The IP address above is only an example from the local demo. Replace it with the host laptop's current Wi-Fi IPv4 address.

### Chrome demo

In ChatGPT, ask a project question such as:

```text
We are building OneContext. What is the team's current goal and what should I consider before planning the next feature?
```

Click **Add context**. The extension retrieves relevant project memory and places a block like this into the prompt:

```text
[PROJECT CONTEXT - OneContext]
Project: Atlas project
Relevant context: ...
[END CONTEXT]
```

Now switch to Claude, ask:

```text
Continue this project work. Based on the shared context, propose the next implementation step and explain which files are relevant.
```

Click **Add context** in Claude as well. Claude receives the same project memory without requiring you to copy the entire ChatGPT conversation.

Casual prompts such as `Hi, how are you?` are intentionally not treated as project questions, so the extension reports that no project context was added.

## VS Code extension: OneContext Live

The current packaged version is:

```text
apps/vscode-extension/onecontext-vscode-0.1.2.vsix
```

### Install the VSIX

1. Open VS Code.
2. Open the Extensions view with `Ctrl+Shift+X`.
3. Click the `...` menu in the Extensions panel.
4. Choose **Install from VSIX...**.
5. Select `apps/vscode-extension/onecontext-vscode-0.1.2.vsix` from the cloned repository.
6. Reload VS Code when prompted.

The VSIX can be installed on each teammate's VS Code. The source repository is not required on a teammate's laptop just to install the extension, but the local repository is required for the MCP server workflow described below.

### Configure and join a team

1. Start the web app and realtime service.
2. Open `/team` in the browser and copy the Team Code.
3. In VS Code, open the Command Palette with `Ctrl+Shift+P`.
4. Run **OneContext: Join Team**.
5. Enter the Team Code and your display name.
6. Run **OneContext: Configure Gateway Key** once and enter the same gateway key used by the server. The extension stores it in VS Code Secret Storage.
7. Open the **OneContext Team** view in the Explorer sidebar.
8. Run **OneContext: Start Task**, enter the file/area and task description, and broadcast the intent.

The extension can also publish presence automatically when the active editor changes or a file is saved. Presence expires automatically after 15 minutes unless refreshed.

### VS Code development mode

This is only needed when developing the extension itself:

```powershell
cd apps\vscode-extension
npm install
npm run compile
```

Open `apps/vscode-extension` as its own VS Code window and press `F5`. This opens a separate **Extension Development Host** window. In that new window, open a project folder and use the OneContext Team view. Do not press `F5` from the normal repository window if you are trying to test the packaged extension.

To rebuild the installable package:

```powershell
cd apps\vscode-extension
npm run package
```

The package script compiles the extension and creates a versioned `.vsix` file. Install the newest version after rebuilding; VS Code can otherwise continue running an older installed package.

## MCP: shared context for Codex, Copilot, and other agents

The MCP server is the agent-facing bridge. It exposes four tools:

| Tool | Purpose |
| --- | --- |
| `onecontext_get_context` | Retrieve relevant project brief, decisions, sources, live activity, and handoffs |
| `onecontext_check_conflicts` | Check active teammate intent before changing an overlapping area |
| `onecontext_publish_update` | Publish a concise decision, task, or progress update |
| `onecontext_save_handoff` | Save a completed task summary for the next teammate or agent |

The server is launched by Node from `scripts/onecontext-mcp.mjs`. It uses the workspace `.env.local` to reach the OneContext gateway; it does not store an API key in the MCP configuration file.

### VS Code MCP configuration

This repository includes `.vscode/mcp.json`:

```json
{
  "servers": {
    "onecontext": {
      "type": "stdio",
      "command": "node",
      "args": ["scripts/onecontext-mcp.mjs"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

In VS Code with an MCP-capable chat/agent:

1. Open the repository folder.
2. Open the Command Palette with `Ctrl+Shift+P`.
3. Run **MCP: List Servers**.
4. Start or restart `onecontext`.
5. In the agent's **Configure Tools** menu, enable the OneContext tools.
6. Ask:

   ```text
   Use the OneContext MCP tool onecontext_get_context before answering.
   What is the team currently working on, and which files should I avoid changing?
   ```

The expected result is a context block containing the same project goal, recent team activity, decisions, and source information visible to other connected agents.

If the server reports `fetch failed`, confirm that the host web app is running, the gateway URL in `.env.local` is reachable, and the gateway key is the same on both devices. If it reports `Unexpected end of JSON input`, restart the MCP server and verify that the repository contains the latest `scripts/onecontext-mcp.mjs`.

### Codex terminal wrapper

From the repository root:

```powershell
npm run onecontext:agent -- codex "What is our current project goal and sprint focus?"
```

This prints a context-enriched prompt. The safe default is a preview, so you can review the context before sending it to an agent.

## Two-laptop demonstration

This demonstrates that two devices use the same project memory.

### Laptop 1: host the services

Find the Wi-Fi IPv4 address with `ipconfig`. In the original local demo it was `192.168.31.79`; use your current address if it has changed.

From the repository root, run:

```powershell
npm run dev -- -H 0.0.0.0
```

In a second terminal:

```powershell
npm run realtime
```

Allow Node.js through Windows Firewall on private networks if Windows asks. Keep both terminals running.

### Laptop 2: connect remotely

Clone the repository or copy the project folder, install Node.js 18+ and run:

```powershell
cd C:\path\to\Onecontext
npm install
```

Laptop 2 should not run `npm run dev` or `npm run realtime` for this test. Its `.env.local` should point to Laptop 1:

```env
ONECONTEXT_API_URL=http://192.168.31.79:3000
ONECONTEXT_REALTIME_HTTP_URL=http://192.168.31.79:8787
ONECONTEXT_PROJECT_ID=atlas-project
ONECONTEXT_GATEWAY_KEY=<the-same-private-key-as-laptop-1>
```

Also set the VS Code extension settings on Laptop 2:

```text
onecontext.apiBaseUrl = http://192.168.31.79:3000
onecontext.realtimeUrl = ws://192.168.31.79:8787/live
```

Both laptops must use the same project ID and Team Code. On Laptop 2, install the VSIX and join the Team Code. To prove shared memory, publish a handoff or task on Laptop 1, then ask the MCP-enabled Copilot/agent on Laptop 2 to retrieve it with `project_id` set to `atlas-project`.

If Laptop 2 cannot open the dashboard, test the connection from Laptop 2:

```powershell
Test-NetConnection 192.168.31.79 -Port 3000
Test-NetConnection 192.168.31.79 -Port 8787
```

Both tests should show `TcpTestSucceeded : True`. Make sure both devices are on the same private Wi-Fi network and that the host firewall permits ports 3000 and 8787.

## Privacy and security

OneContext is designed to store useful project knowledge, not indiscriminately copy private chats.

- Keep memory project-scoped.
- Do not store API keys, passwords, JWTs, OAuth tokens, private keys, or `.env` contents.
- Do not store unrelated personal conversations.
- Prefer concise decisions, tasks, summaries, and file references over raw verbose transcripts.
- Keep `DATABASE_URL`, `OPENAI_API_KEY`, `SESSION_SECRET`, and `ONECONTEXT_GATEWAY_KEY` in `.env.local` only.
- The Chrome extension stores its connection settings locally and does not receive the server's database credentials.
- The VS Code extension stores the gateway key in VS Code Secret Storage.
- Team Codes are suitable for a demo, not a complete production authorization system.

Before a public deployment, add production authentication/authorization, rotate all demo credentials, use HTTPS/WSS, deploy the realtime service, and use Redis or another durable presence store.

## Optional AI configuration

OpenAI-powered routing and answers are optional. If enabled, the key stays on the server:

```env
OPENAI_API_KEY=<your-key>
ONECONTEXT_USE_AI_ROUTING=true
ONECONTEXT_USE_AI_RETRIEVAL=true
ONECONTEXT_USE_AI_ANSWERS=true
ONECONTEXT_USE_AI_CONVERSATION_MEMORY=true
ONECONTEXT_AI_MODEL=<your-supported-model>
```

If an AI request fails, the application falls back to local routing and retrieval. The project can therefore be demonstrated without additional API usage or cost by leaving the key empty.

## Optional Redis realtime persistence

Local presence works in memory. For a Redis-backed realtime setup, use the included compose file if Docker Desktop is installed:

```powershell
docker compose -f docker-compose.live.yml up
```

Then set `REDIS_URL` in `.env.local` to the Redis connection string you are using.

## Verification and useful commands

From the repository root:

```powershell
npm test
npm run build
npm run vscode:compile
```

From `apps/vscode-extension`:

```powershell
npm run compile
npm run package
```

The repository test suite covers retrieval and context behavior. `npm run package` creates the installable VSIX.

## Demo prompts

### Dashboard or MCP

```text
What is the team's current goal, which decisions are already recorded, and which files should I avoid changing?
```

### Handoff from Laptop 1

Use **OneContext: Complete Task and Save Handoff**:

```text
Title: Shared memory privacy decision
Summary: Keep project memory project-only. Store concise decisions, handoffs, tasks, and file references, but never store secrets, credentials, unrelated chats, or raw verbose transcripts.
Next task: Verify that the MCP-enabled agent on Laptop 2 can retrieve this handoff with project_id atlas-project.
```

### Laptop 2 retrieval

```text
Use the OneContext MCP tool onecontext_get_context before answering.
What privacy decision did my teammate save, and what is the next task?
```

### ChatGPT to Claude continuation

ChatGPT:

```text
We are building a shared project memory for a four-person AI-assisted team. Propose the next feature and identify the important project decisions that should be shared with another AI assistant.
```

Click **Add context**, then open Claude and ask:

```text
Continue the OneContext project from the shared memory. Turn the previous planning into a concrete implementation checklist and mention the relevant files.
```

Click **Add context** in Claude. The result demonstrates provider-independent project continuity.

## How Codex and GPT-5.6 Accelerated the Build

Codex with GPT-5.6 was used throughout the development of OneContext as the primary coding and reasoning partner. It helped transform the initial product specification into a working architecture, generate the Next.js and PostgreSQL implementation, build the Chrome and VS Code extensions, create the realtime team-presence service, and implement the MCP integration for AI coding agents.

Codex also accelerated debugging and iteration. It helped diagnose local-network issues between two laptops, VS Code extension activation problems, stale VSIX packages, MCP initialization failures, and authenticated handoff errors. It also helped create tests, improve the dashboard UI, write documentation, and prepare the final demo workflow.

Key technical decisions made during development included:

- Use provider-agnostic shared memory instead of directly synchronizing ChatGPT, Claude, or Codex conversations.
- Use PostgreSQL for persistent project memory and activity history.
- Use MCP as the bridge between OneContext and AI coding assistants.
- Use Team Codes and realtime presence for multi-device collaboration.
- Store concise project decisions, handoffs, and tasks instead of raw private chats.
- Add privacy protection so secrets, credentials, and unrelated conversations are not stored.
- Use conflict warnings as coordination signals rather than hard file locks.

The final system combines a web dashboard, Chrome extension, VS Code extension, realtime collaboration, persistent memory, and MCP-based context retrieval.

## Devpost submission checklist

Use this repository as the code URL and select **Developer tools** as the category. The submission should include:

1. A concise description of the shared-memory problem and the OneContext solution.
2. A public demo video shorter than three minutes with audio explaining the product, Codex, and GPT-5.6 usage.
3. This repository URL and the setup instructions above.
4. The packaged VSIX path: `apps/vscode-extension/onecontext-vscode-0.1.2.vsix`.
5. Chrome extension installation instructions from this README.
6. A test path: local dashboard, demo account if retained, Team Code demo, and MCP retrieval prompt.
7. The Codex session ID returned by `/feedback` for the session where most core functionality was built.
8. The exact section **How Codex and GPT-5.6 Accelerated the Build** pasted into the Devpost submission.

The local repository cannot submit the external Devpost form automatically. Copy that section from this README, or use the ready-to-paste file [DEVPOST_SUBMISSION.md](DEVPOST_SUBMISSION.md).

## Repository map

```text
src/app/                    Next.js pages and API routes
src/lib/                    Storage, retrieval, AI, auth, and live helpers
infra/db/schema.sql         PostgreSQL schema
browser-extension/          Chrome extension for ChatGPT and Claude
apps/vscode-extension/      VS Code source, README, and packaged VSIX
apps/realtime-sync/         WebSocket presence service
scripts/                    DB setup, Codex wrapper, MCP server, demo helpers
.vscode/mcp.json            VS Code MCP server configuration
```

## Current scope

This is a working local MVP intended for evaluation and demonstration.

- GitHub indexing is suitable for the demo and may need production hardening for large/private repositories.
- Team Codes and gateway keys need stronger multi-tenant authorization for a public service.
- Localhost works on one computer; teammates on another network need a deployment or secure tunnel.
- The conflict radar warns about overlap; it does not replace Git branches, code review, or merge tooling.

## License

OneContext is released under the MIT License. See [LICENSE](LICENSE) for the full terms.
