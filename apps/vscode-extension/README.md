# OneContext Live for VS Code

Join a OneContext Team Code to share active-file presence, task intent, conflict warnings, and Codex-ready project context.

## Local setup

1. Start the OneContext web app with `npm run dev` from the project root.
2. Start realtime sync with `npm run realtime` from the project root.
3. Open the OneContext Team view in VS Code Explorer.
4. Run **OneContext: Join Team** and enter the Team Code from `/team`.
5. If the server has `ONECONTEXT_GATEWAY_KEY` configured, run **OneContext: Configure Gateway Key** once and enter the same key. It is stored in VS Code Secret Storage and used for saved handoffs.

Use **Ask Codex with Team Context** to prepare a Codex prompt containing the shared project brief, recent activity, live presence, decisions, and retrieved project memory.
