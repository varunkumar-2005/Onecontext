# OneContext

> Shared project memory for AI-assisted software teams.

**Category:** Developer tools

OneContext gives a team one shared, project-aware memory layer across the AI tools they already use: Codex, ChatGPT, Claude, and VS Code. Instead of every developer and every agent starting from a different understanding of the project, OneContext retrieves the relevant brief, sources, decisions, and live teammate activity before work begins.

## The problem

Four people can work on the same repository while using different coding assistants. Their prompts, plans, decisions, and active files are usually isolated. The result is duplicated work, conflicting assumptions, and avoidable merge conflicts.

## What OneContext does

- Stores a shared project brief, Markdown documents, team notes, decisions, and activity.
- Retrieves only the project memory relevant to a question.
- Adds that context to ChatGPT or Claude through a Chrome extension.
- Prepares Codex-ready prompts through a terminal command and can save Codex responses back as shared activity.
- Shows live teammate task intent in a VS Code extension and warns when work overlaps.
- Provides a dashboard for sources, project chat, decisions, timeline, knowledge graph, project settings, and the live team view.

```text
Sources + notes + decisions + live team intent
                    │
                    ▼
            OneContext memory layer
                    │
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
  ChatGPT         Codex        VS Code / Claude
```

## Demo workflow

The fastest way to see the project work end-to-end:

1. Open the dashboard and set the **Shared project brief**.
2. Add an architecture document or team note in **Sources**.
3. Ask a project question in **Memory Chat**.
4. In ChatGPT or Claude, write a project question and click **Add context**.
5. Open **OneContext Live**, share the Team Code, and start a task.
6. Join the same Team Code from the VS Code extension in a second VS Code window; start work in the same file to see an overlap warning.
7. Run the Codex wrapper from the terminal to generate a Codex-ready prompt containing the current shared memory.

## Tech stack

| Area | Implementation |
| --- | --- |
| Web app | Next.js 14, React, TypeScript |
| Storage | PostgreSQL with pgvector-ready schema |
| Retrieval | Markdown chunking, local embeddings by default, optional OpenAI embeddings and AI re-ranking |
| Realtime presence | WebSocket service with optional Redis persistence |
| Browser adapter | Manifest V3 Chrome extension for ChatGPT and Claude |
| Editor adapter | VS Code extension, packaged as a `.vsix` |
| Agent adapter | Codex-first terminal wrapper |

## Quick start

### Prerequisites

- Node.js 18 or newer
- PostgreSQL with the `pgvector` extension available
- Google Chrome for the browser extension demo
- VS Code for the live collaboration demo (optional)

### 1. Install dependencies

```powershell
git clone <YOUR_REPOSITORY_URL>
cd onecontext
npm install
```

### 2. Configure local environment

Create `.env.local` from the template:

```powershell
Copy-Item .env.example .env.local
```

Set `DATABASE_URL` to your local PostgreSQL database. Keep `.env.local` private; it is intentionally ignored by Git.

Minimum local configuration:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/onecontext
SESSION_SECRET=replace-with-a-long-random-value
ONECONTEXT_GATEWAY_KEY=choose-a-local-gateway-key
```

### 3. Initialize the database

```powershell
npm run db:init
```

### 4. Start OneContext

Use two terminals from the repository root.

```powershell
# Terminal 1 — web application
npm run dev
```

```powershell
# Terminal 2 — live team-presence service
npm run realtime
```

Open [http://localhost:3000/login](http://localhost:3000/login).

For the seeded local demo, sign in with:

```text
Email:    suresh@example.com
Password: demo1234
```

> Change or remove demo credentials before deploying publicly.

## Product surfaces

| URL | Purpose |
| --- | --- |
| `/` | Dashboard: source overview and entry point to project memory |
| `/sources` | Upload Markdown/text files and save shared team notes |
| `/brief` | Set the project goal and current sprint |
| `/chat` | Ask questions grounded in shared project memory |
| `/team` | Create/share a Team Code and broadcast live task intent |
| `/decisions` | Record project decisions and rationale |
| `/timeline` | Review source and decision events chronologically |
| `/graph` | Inspect the current knowledge-graph view |
| `/settings` | Control indexing settings and review provider status |

## Chrome extension: ChatGPT and Claude

The browser extension injects relevant OneContext context into a project-related prompt. It intentionally leaves casual prompts, such as `hi` or `thanks`, unchanged.

1. Ensure `npm run dev` is running.
2. In Chrome, open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select `browser-extension` from this repository.
5. Open the OneContext extension popup and set:
   - **API URL:** `http://localhost:3000`
   - **Project ID:** `atlas-project`
   - **Gateway key:** the value after `ONECONTEXT_GATEWAY_KEY=` in `.env.local`
6. Click **Save & verify**. It should report that the gateway key was accepted.
7. Refresh ChatGPT or Claude. Write a project question and click **Add context** beside the prompt.

Example prompt:

```text
What is the team currently working on, and what should I avoid changing?
```

## VS Code extension: live coordination

### Install from the packaged VSIX

The ready-to-install package is:

```text
apps/vscode-extension/onecontext-vscode-0.1.0.vsix
```

In VS Code, open **Extensions** → **…** → **Install from VSIX…**, then select that file.

### Run in extension-development mode

```powershell
npm run vscode:compile
```

Open `apps/vscode-extension` in VS Code and press `F5`. In the launched Extension Development Host:

1. Open the **OneContext Team** view in the Explorer sidebar.
2. Choose **Join team** and paste the Team Code from [http://localhost:3000/team](http://localhost:3000/team).
3. Choose **Start task** and describe the file/area you are changing.
4. Use **Ask Codex with context** to prepare a Codex prompt from the shared project state.

The extension tracks the active file, presents live teammate intent, and warns when another teammate announces work in the same area. Presence has a 15-minute TTL and is refreshed by the realtime service.

## Codex CLI workflow

Run this from the repository root:

```powershell
npm run onecontext:agent -- codex "What is our current project goal and sprint focus?"
```

OneContext prints an augmented prompt containing the relevant project brief, sources, decisions, and recent activity:

```text
[PROJECT CONTEXT — OneContext]
...
[END CONTEXT]
```

By default, this is a safe preview flow: copy the context into Codex manually. To run a terminal-callable Codex command automatically and save its response back into shared activity, configure these server-side variables:

```env
ONECONTEXT_CODEX_COMMAND=codex
ONECONTEXT_CODEX_ARGS=exec
ONECONTEXT_TEAM_CODE=ONECTX-XXXXXX
```

## Shared agent memory with MCP

OneContext includes a local MCP server so supported coding agents can use the same project memory without copying a shared file by hand. It provides four tools:

- `onecontext_get_context` — retrieve relevant project context before planning or editing.
- `onecontext_check_conflicts` — inspect live teammate intent before touching related code.
- `onecontext_publish_update` — save a concise decision, task, or work update.
- `onecontext_save_handoff` — save a completed agent turn; OneContext distills durable memory for the next agent.

The repository includes ready-to-use local configuration for Codex (`.codex/config.toml`), Claude Code (`.mcp.json`), and Cursor (`.cursor/mcp.json`). Restart the relevant agent after starting OneContext:

```powershell
npm run dev
npm run realtime
```

The MCP server reads the local OneContext configuration and sends only the context required for each tool call. The OpenAI key stays server-side.

## Optional OpenAI-powered decisions

OneContext works without an OpenAI API key using local deterministic embeddings and routing. To enable AI-based intent classification, semantic memory re-ranking, and grounded dashboard answers, add the following to `.env.local`:

```env
OPENAI_API_KEY=your_api_key
ONECONTEXT_USE_AI_ROUTING=true
ONECONTEXT_USE_AI_RETRIEVAL=true
ONECONTEXT_USE_AI_ANSWERS=true
ONECONTEXT_AI_MODEL=gpt-4o-mini
```

The API key remains on the server; it is never stored in the Chrome extension. If an AI call fails, OneContext falls back to local routing and retrieval.

## Realtime persistence with Redis (optional)

The local realtime server uses in-memory presence by default. For Redis-backed presence, start the included local services:

```powershell
docker compose -f docker-compose.live.yml up
```

Then set `REDIS_URL` in `.env.local` if it differs from the default.

## Verification

```powershell
npx tsc --noEmit
npm test
```

The test suite covers Markdown chunking, context token budgets, smart routing, deterministic embeddings, and similarity ordering.

## How Codex and GPT-5.6 accelerated this project

OneContext was developed iteratively with Codex using GPT-5.6. Codex accelerated the implementation by helping turn the shared-memory idea into working slices:

- Designed the Next.js, PostgreSQL, extension, CLI, and realtime-service architecture.
- Built the context gateway and smart routing flow for ChatGPT, Claude, and Codex prompts.
- Implemented the VS Code live-presence workflow, conflict warnings, and agent-readable context files.
- Added optional AI routing, retrieval re-ranking, and grounded answer generation with safe fallbacks.
- Packaged the VS Code extension, improved the dashboard routing, and created the judge-friendly Sources workspace.
- Ran TypeScript checks and automated tests throughout the build.

The key product decision was to keep OneContext **provider-agnostic**: it owns shared memory and coordination, while developers can keep using the AI coding assistant they prefer.

## Judge checklist

For a fast evaluation, a judge can:

1. Follow **Quick start** and sign in with the local demo account.
2. Add a note in `/sources`.
3. Ask a question in `/chat`.
4. Load the Chrome extension and verify **Add context** on ChatGPT or Claude.
5. Open `/team`, start a task, and use a second VS Code window/extension host to join the same Team Code.
6. Run the Codex CLI wrapper command above.

## Current scope and known limitations

This repository is a working local MVP. It is designed for demo and evaluation, not yet as a hosted multi-tenant production service.

- GitHub repository sync is currently a placeholder; upload Markdown/text files or add notes through the Sources UI.
- Team Codes are a collaboration convenience, not production-grade authorization.
- Deploy the web app and realtime service, use Redis, and add production authentication/authorization before sharing it publicly.
- Different-network teammate testing requires a deployment or secure tunnel; localhost is only reachable on the host machine.

## Security notes

- Never commit `.env.local`, API keys, database passwords, or gateway keys.
- Use a new `SESSION_SECRET` and gateway key outside local development.
- Review the demo account and Team Code access model before any public deployment.

## Repository map

```text
src/app/                    Next.js dashboard and API routes
src/lib/                    Retrieval, storage, auth, and AI-decision logic
browser-extension/          Chrome extension for ChatGPT and Claude
apps/vscode-extension/      VS Code extension and packaged VSIX
apps/realtime-sync/         WebSocket live-presence service
infra/db/schema.sql          PostgreSQL / pgvector schema
scripts/                    Database initializer and Codex wrapper
```

## License

Add a license file before making this repository public. The MIT License is a practical default for a hackathon submission unless you need different terms.
