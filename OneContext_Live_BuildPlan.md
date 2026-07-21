# OneContext Live — Final Build Plan
## VS Code Team Extension + Realtime Presence Layer

**Status baseline (what's already implemented, per current build):**
Shared project memory · Team Code generation · Live task intent API · Conflict-warning logic · Live context added to chat/gateway · Team presence page (web)

**What this plan completes:** VS Code extension, real WebSocket communication, Redis presence storage, automatic graph updates from VS Code, automatic commit-to-knowledge flow, Join Team Code UI, agent-specific context adapters.

**Cost: $0.** Everything below runs on local Postgres, local Redis, and a local WebSocket server. No new paid service is required. OpenAI credits are only spent on embeddings/entity-extraction/compression calls you're already making — Redis and WebSocket traffic never touch the OpenAI API. Public cloud hosting is optional and not needed for hackathon judging (local `docker-compose up` satisfies the Submission Requirements).

---

## 1. Scope of This Plan

| # | Deliverable | Depends on already-built |
|---|---|---|
| 1 | Realtime Sync Service (WebSocket server) | Team Code API, Live Intent API |
| 2 | Redis presence store | none new |
| 3 | VS Code extension shell + Join Team Code UI | Team Code API |
| 4 | Active-file / task detection → intent events | Live Intent API |
| 5 | Presence sidebar (Webview) | Team presence page (reuse its data logic) |
| 6 | Inline conflict banner | Conflict-Warning Logic |
| 7 | Auto graph updates on file save | Knowledge graph builder |
| 8 | Commit → permanent knowledge flow | GitHub ingestion pipeline |
| 9 | Agent-specific context adapters (Cursor/Windsurf/Codex) | AI Gateway, chat/gateway context injection |

---

## 2. Architecture Addition

```mermaid
flowchart TB
    subgraph VS Code (x4 developers)
        EXT[OneContext Extension]
        SIDEBAR[Presence Sidebar Webview]
        BANNER[Inline Conflict Banner]
        EXT --> SIDEBAR
        EXT --> BANNER
    end

    EXT <-->|WebSocket wss://.../live| WS[Realtime Sync Service]
    WS <--> REDIS[(Redis - live_intents)]
    WS --> API[Backend API - existing]
    API --> PG[(Postgres)]
    API --> NEO[(Neo4j knowledge graph)]
    API --> GATEWAY[AI Gateway - existing]
    GATEWAY --> CODEX[Codex CLI]
    GATEWAY --> CURSOR[Cursor rules file]
    GATEWAY --> WINDSURF[Windsurf rules file]
```

---

## 3. Realtime Sync Service

**New service:** `apps/realtime-sync/`
**Stack:** Node.js + Socket.io (fastest path given your existing NestJS/Node backend — reuse the same auth/JWT middleware).

### 3.1 Redis Schema — `live_intents`

Key pattern: `live_intent:{project_id}:{user_id}`
TTL: 15 minutes, refreshed on every heartbeat/edit event.

```json
{
  "user_id": "uuid",
  "user_name": "string",
  "project_id": "uuid",
  "file_path": "src/auth/auth.service.ts",
  "intent_summary": "Refactoring JWT token expiry logic",
  "related_graph_node_ids": ["Decision:use-jwt", "File:auth.service.ts"],
  "started_at": "iso8601",
  "last_active_at": "iso8601"
}
```

### 3.2 WebSocket Contract

**Connect:** `wss://<host>/live?token=<jwt>&project_id=<uuid>`

**Client → Server events**
| Event | Payload |
|---|---|
| `intent:start` | `{ file_path, intent_summary }` |
| `intent:file_change` | `{ file_path }` (auto, on active editor change) |
| `intent:heartbeat` | `{}` (every 60s while VS Code is focused, refreshes TTL) |
| `intent:end` | `{}` (on commit, or extension close) |

**Server → Client events**
| Event | Payload |
|---|---|
| `presence:update` | `{ active_intents: [ ...all current team intents... ] }` |
| `conflict:warning` | `{ conflicting_user, shared_node, file_path, message }` |

### 3.3 Server-side Handler Logic (`realtime-sync/handlers/intent.ts`)

```
on intent:start or intent:file_change:
    1. write/update Redis key live_intent:{project_id}:{user_id}
    2. call existing Conflict-Warning Logic:
         - find other active intents in same project
         - check file_path match OR overlapping related_graph_node_ids
           (query Neo4j for shared/adjacent nodes)
    3. if overlap found → emit conflict:warning to BOTH users involved
    4. broadcast presence:update to all sockets in project_id room
```

This reuses your existing Conflict-Warning Logic and knowledge graph — the WebSocket layer is just the transport that makes it live instead of poll-based.

---

## 4. VS Code Extension

**New package:** `apps/vscode-extension/`
**Scaffold:** `yo code` (TypeScript extension template)

### 4.1 `package.json` — Commands & Contribution Points

```json
{
  "contributes": {
    "commands": [
      { "command": "onecontext.joinTeam", "title": "OneContext: Join Team" },
      { "command": "onecontext.startTask", "title": "OneContext: Start Task" },
      { "command": "onecontext.leaveTeam", "title": "OneContext: Leave Team" }
    ],
    "views": {
      "explorer": [
        { "id": "onecontextPresence", "name": "OneContext Team", "type": "webview" }
      ]
    }
  }
}
```

### 4.2 Join Team Code Flow (`src/commands/joinTeam.ts`)

```
1. showInputBox({ prompt: "Enter your OneContext Team Code" })
2. POST /api/v1/teams/join { team_code }
3. store returned { project_id, jwt, websocket_url } in
   VS Code SecretStorage (never plain settings.json)
4. open WebSocket connection using websocket_url
5. show confirmation: "Connected to project: {project_name}"
6. activate presence sidebar
```

### 4.3 Active File Detection (`src/watchers/fileWatcher.ts`)

```
vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor && isTrackedWorkspace(editor.document.uri)) {
        socket.emit('intent:file_change', { file_path: relativePath(editor.document.uri) });
    }
});

vscode.workspace.onDidSaveTextDocument(doc => {
    // triggers Section 6 (auto graph update on save)
    socket.emit('file:saved', { file_path: relativePath(doc.uri) });
});
```

### 4.4 Start Task Command (`src/commands/startTask.ts`)

```
1. showInputBox({ prompt: "What are you about to work on?" })
2. socket.emit('intent:start', { file_path: currentActiveFile, intent_summary: input })
3. this summary is also sent to the backend for embedding + graph linking
   (so it's genuinely searchable later, not just a notification string)
```

### 4.5 Presence Sidebar (`src/views/presenceWebview.ts`)

A `WebviewView` rendering a simple list, updated on every `presence:update` socket event:

```
● Priya — auth.service.ts — "Refactoring JWT token expiry logic" (12 min ago)
● Daniel — db.module.ts — "Adding migration for users table" (3 min ago)
○ Mei — idle
```

### 4.6 Inline Conflict Banner (`src/notifications/conflictBanner.ts`)

```
socket.on('conflict:warning', (data) => {
    vscode.window.showWarningMessage(
      `⚠ ${data.conflicting_user} is also working on ${data.file_path} — "${data.message}"`,
      "View Details", "Dismiss"
    );
});
```

---

## 5. Automatic Graph Updates from VS Code

On `file:saved` event:
1. Realtime Sync Service forwards the event to the existing Parser/Embedding pipeline (`worker-embedding`), scoped to just the changed file (not a full re-index).
2. New chunk version created, `is_current` flag updated per the existing versioning design.
3. Knowledge Graph Builder re-runs entity extraction on just that file's new chunk, updates Neo4j edges.

This reuses 100% of your existing ingestion pipeline — the only new piece is triggering it from a VS Code save event instead of a GitHub webhook.

---

## 6. Commit → Permanent Knowledge Flow

**Hook:** VS Code's built-in Git extension API (`vscode.git` extension exposes a `Repository.state.onDidChange` and commit events).

```
on git commit detected:
    1. socket.emit('intent:end')  → clears Redis live_intent for this user
    2. POST /api/v1/decisions  { title: commit message summary,
                                   rationale: intent_summary from the task,
                                   source_chunk_id: latest chunk for changed files }
    3. Decision node written to Neo4j, linked to the File nodes touched
```

This is what makes the "temporary" live intent become "permanent" project memory — exactly the handoff described in the addon doc's Section 5, now wired to a real Git event instead of manually.

---

## 7. Agent-Specific Context Adapters

Your AI Gateway already injects live context into chat/web tools. Extend the same pattern for the remaining agents, each just a formatting adapter — no new retrieval logic needed:

| Agent | Adapter mechanism |
|---|---|
| **Codex CLI** | Extension writes current team-presence + relevant context to a temp file; CLI wrapper (`onecontext codex "..."`) reads it and prepends to the prompt before invoking Codex |
| **Cursor** | Extension writes to `.cursor/rules/onecontext-live.md`, refreshed on every presence update — Cursor already watches this file |
| **Windsurf** | Same pattern, Windsurf's equivalent config path |
| **Claude Code** | Extension writes to a `CLAUDE.md`-style context file in the workspace root that Claude Code reads automatically, refreshed on presence updates |

---

## 8. Build Order (4-person team, parallelizable)

| Day | Frontend/Extension Dev | Backend Dev | AI/Graph Dev | DevOps |
|---|---|---|---|---|
| 1 | Scaffold VS Code extension, Join Team Code UI | Realtime Sync Service + WebSocket auth | — | Add Redis to docker-compose |
| 2 | Active file detection, Start Task command | Intent handlers + Conflict-Warning wiring to Neo4j queries | Wire file-save → scoped re-embedding | — |
| 3 | Presence sidebar Webview, conflict banner | Commit-hook → Decisions API | Verify graph updates end-to-end | Test full stack via docker-compose |
| 4 | Polish extension UX, package `.vsix` | Agent adapters (Codex/Cursor/Windsurf files) | Validate context injection quality | Record demo: 2 VS Code windows live-conflicting |

---

## 9. Local Testing With 4 Friends (No Cost)

1. One person runs the full stack (`docker-compose up`, includes Postgres + Redis + WebSocket server + API).
2. That person shares their local IP (or a free tunnel like `ngrok`/`cloudflared` tunnel, both free tier) so the other 3 can point their VS Code extension's `websocket_url` / API base URL at it.
3. All four generate/join the same Team Code.
4. Demo: two people edit related files simultaneously → conflict banner fires live in both editors.

---

## 10. Definition of Done

- [ ] `docker-compose up` boots Postgres, Redis, Realtime Sync Service, API, and frontend together
- [ ] Extension installs locally via `.vsix`, no marketplace publish required for hackathon
- [ ] Join Team Code works end-to-end from a fresh VS Code install
- [ ] Active file + Start Task events visibly update the Presence sidebar on a teammate's machine within ~1 second
- [ ] Conflict banner fires when two active intents share a file or a linked graph node
- [ ] File save triggers a scoped re-embed + graph update, not a full project re-index
- [ ] Git commit clears the live intent and writes a permanent Decision node
- [ ] At least one non-web agent (Codex CLI or Cursor) demonstrably receives live team context

---

*End of Plan.*
