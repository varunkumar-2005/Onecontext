# OneContext - Devpost submission copy

Use the following content when completing the Devpost form. Replace the repository URL, public demo URL, and Codex `/feedback` session ID with the final values before submitting.

## Category

Developer tools

## Project description

OneContext is a shared project memory and coordination layer for teams using different AI coding assistants. Four developers can work on the same repository with ChatGPT, Claude, Codex, GitHub Copilot, Cursor, or VS Code while sharing the same project brief, decisions, useful source material, task handoffs, and live work intent.

The project combines a Next.js dashboard, PostgreSQL memory, a Chrome extension for ChatGPT and Claude, a VS Code extension for live team presence, and an MCP server for AI coding agents. A teammate can create a Team Code, publish the file or area they are working on, and let others see active work before they edit the same area. The conflict radar is a coordination warning, while Git remains responsible for source control and merging.

The Chrome extension demonstrates continuity between AI assistants: a user asks a project question in ChatGPT, clicks **Add context**, then opens Claude and clicks **Add context** again. Claude receives the relevant project memory without requiring the user to manually copy the full previous conversation.

The VS Code and MCP demonstrations show the team workflow: one laptop saves a structured handoff, and another laptop's MCP-enabled agent retrieves that shared project context using the same project ID.

## How it works

1. Add a project goal, sprint brief, notes, Markdown files, decisions, or a GitHub source.
2. OneContext stores project-scoped information in PostgreSQL and retrieves relevant context for each question.
3. The dashboard, Chrome extension, VS Code extension, Codex wrapper, or MCP server provides the compact context block to the selected AI tool.
4. The VS Code extension publishes active-file and task intent, shows presence, and warns when teammates appear to overlap.
5. Handoffs and important decisions become reusable shared memory for the next person or agent.

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

## Demo and testing

The repository includes complete setup instructions in [README.md](README.md). Judges can test the project by:

- Running the Next.js app and PostgreSQL locally.
- Adding a Markdown source and asking a question in Memory Chat.
- Loading `browser-extension` as an unpacked Chrome extension and testing **Add context** in ChatGPT and Claude.
- Installing `apps/vscode-extension/onecontext-vscode-0.1.2.vsix` in VS Code.
- Creating a Team Code and publishing live task intent.
- Starting the included MCP server and asking an agent to call `onecontext_get_context`.

## Submission fields to complete

- **Repository:** `https://github.com/varunkumar-2005/Onecontext`
- **Demo video:** add the final public YouTube URL, under three minutes.
- **Codex feedback:** run `/feedback` in the Codex session containing most of the core implementation and paste the returned session ID.
- **Test account:** provide a demo account only if it is enabled in the submitted build; rotate or remove it before public deployment.
