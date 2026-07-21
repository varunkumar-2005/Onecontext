# OneContext Live — Real-Time Shared Team Memory
## Addendum to OneContext SRD — Feature Extension Plan

## 1. What This Adds

Currently, OneContext gives *one developer* a shared memory across *many AI tools*. OneContext Live extends this so that *a team of developers* — each possibly using a different coding agent (Codex, Cursor, Windsurf, Claude Code) — share **one live, continuously updating project memory** while they work, not just after they push to GitHub.

Core idea: every team member's VS Code extension broadcasts lightweight "intent" signals (what file/feature they're working on) to a shared session. These signals get written into the same knowledge graph everyone's coding agents already read from — so agents become aware of what teammates are doing in near real-time, and teammates get warned before they collide on the same code.

## 2. How Teams Connect

- A project owner generates a **Team Code** (short, e.g. `ONECTX-7F2K9`) from the OneContext dashboard.
- Each teammate installs the OneContext VS Code extension and enters the Team Code once.
- The extension authenticates the code against `POST /api/v1/teams/join`, which links that user's session to the shared `project_id`.
- From that point, all four members are in the same **live session** for that project.

## 3. New Components to Build

| Component | Purpose |
|---|---|
| **Realtime Sync Service** | WebSocket server (Socket.io on Node, or a lightweight Python `websockets` service) that all connected VS Code extensions maintain a persistent connection to |
| **Presence Store** | Redis-backed store of "who is doing what right now" — ephemeral, not persisted to Postgres |
| **Intent Broadcaster** | Extension-side logic that detects what a user is working on and sends a compact "intent event" |
| **Conflict Advisor** | Backend logic that checks new intent events against active teammates' intents + the knowledge graph, and flags overlaps |
| **VS Code Extension (Team Mode)** | New extension surface: sidebar showing live teammate activity + inline warnings |

## 4. Data Model Additions

**team_sessions** (Postgres)
| Column | Type |
|---|---|
| id | uuid PK |
| project_id | uuid FK |
| team_code | text unique |
| created_at | timestamptz |

**live_intents** (Redis, TTL-based — not permanent storage)
```json
{
  "user_id": "uuid",
  "project_id": "uuid",
  "file_path": "src/auth/auth.service.ts",
  "intent_summary": "Refactoring JWT token expiry logic",
  "related_graph_node_ids": ["Decision:use-jwt", "File:auth.service.ts"],
  "started_at": "iso8601",
  "expires_at": "iso8601"   // auto-clears after ~15 min of inactivity
}
```

Confirmed/merged work still flows into the **permanent** knowledge graph exactly as it does today (Section 20/21 of the main SRD) — `live_intents` is just the ephemeral "who's doing what right now" layer sitting on top of it.

## 5. Event Flow

```
1. Dev A opens auth.service.ts in VS Code
      → extension detects active file + (optionally) a short natural-language
        "what are you working on" prompt the user fills in once per task
      → sends intent event to Realtime Sync Service

2. Realtime Sync Service:
      → writes intent to Redis (live_intents)
      → queries the knowledge graph for nodes related to this file/decision
      → checks: is any OTHER active teammate's intent touching the same
        file, function, or related Decision node?
      → broadcasts updated presence to all connected extensions in the session

3. Dev B (different machine, different coding agent) opens the same file
      → their extension receives a presence update via WebSocket
      → VS Code shows an inline banner:
        "⚠ Priya is also actively working on auth.service.ts
         (started 12 min ago) — 'Refactoring JWT token expiry logic'"

4. Dev B's coding agent (say, Codex) queries OneContext for context as usual
      → the Context Builder now includes CURRENT team activity as part of
        the injected context: "Note: a teammate is currently modifying
        this file — coordinate before making structural changes here."

5. When Dev A commits/pushes, the intent is cleared and the change flows
   into the PERMANENT knowledge graph as a new Decision/File version,
   exactly as described in Section 21 of the main SRD.
```

## 6. VS Code Extension — New UI Surfaces

- **Team Presence Sidebar** — live list of teammates, what file/feature each is on, updated in real time via WebSocket.
- **Inline Conflict Banner** — appears at the top of a file if a teammate is actively working on it or a closely related graph node.
- **"Start Task" prompt** — a lightweight one-line input ("What are you about to work on?") that seeds the intent event; this text also gets embedded and graph-linked, so it's genuinely useful context, not just a notification.
- **Agent-Aware Context Injection** — whichever coding agent (Codex, Cursor, Windsurf) the user is running gets team-activity context injected automatically through the same AI Gateway pattern already built (Section 22 of the main SRD) — no separate integration needed per agent.

## 7. API Additions

**POST /api/v1/teams/join**
```json
{ "team_code": "ONECTX-7F2K9" }
```
→ `{ "project_id": "uuid", "websocket_url": "wss://.../live" }`

**WS /live** (per project_id, authenticated)
Client → Server: `{ "type": "intent", "file_path": "...", "summary": "..." }`
Server → Clients: `{ "type": "presence_update", "active_intents": [ ... ] }`
Server → Clients: `{ "type": "conflict_warning", "conflicting_users": [...], "shared_node": "..." }`

## 8. What This Does NOT Do (be upfront about this with your team/judges)

- It does **not** prevent Git merge conflicts at the text/diff level — that's Git's job.
- It does **not** require everyone to be online at the same time to still benefit — if Dev A's intent has expired (TTL passed) or they've pushed their change, the graph reflects it as permanent history instead, same as solo mode.
- It's an **early-warning and shared-context system**, not an automatic conflict resolver. Frame it in your demo as: "we can't stop conflicts, but we can make sure they never happen silently."

## 9. Build Order (fits after your current MVP, ~1–1.5 extra days)

1. Team Code + `team_sessions` table + join endpoint.
2. Realtime Sync Service (WebSocket server) + Redis presence store.
3. VS Code extension: connect to WebSocket, send intent on file focus + manual "start task" input.
4. Presence Sidebar UI + inline conflict banner.
5. Wire Conflict Advisor logic into the Context Builder so coding agents get team-activity context automatically.
6. Demo script addition: two people (or two browser windows) editing related files live, showing the warning appear in real time.
