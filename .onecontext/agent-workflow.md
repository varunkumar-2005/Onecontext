# OneContext shared-agent workflow

Every supported coding agent should use the OneContext MCP server as a shared project-memory layer.

- Before planning or editing: `onecontext_get_context`.
- Before touching related code: `onecontext_check_conflicts`.
- After a decision or meaningful change: `onecontext_publish_update` with concise text and affected files.
- At the end of a substantial task: `onecontext_save_handoff` with the prompt and outcome. OneContext uses its configured LLM to keep only durable decisions, tasks, constraints, and file references.

This is project-only memory. Do not store secrets, credentials, unrelated chats, or raw verbose transcripts.
