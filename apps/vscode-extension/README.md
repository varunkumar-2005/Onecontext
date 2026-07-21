# OneContext Live for VS Code

OneContext Live connects VS Code to the shared project memory. It lets teammates join a Team Code, publish task intent, see active-file presence, receive overlap warnings, ask Codex with project context, and save structured handoffs.

## Install the current VSIX

The current packaged version is:

```text
onecontext-vscode-0.1.2.vsix
```

From VS Code:

1. Press `Ctrl+Shift+X` to open Extensions.
2. Click the `...` menu.
3. Choose **Install from VSIX...**.
4. Select `apps/vscode-extension/onecontext-vscode-0.1.2.vsix`.
5. Reload VS Code.

Install the same VSIX on each teammate's VS Code. The repository is not required for the extension-only live presence demo.

## Connect to a local OneContext server

Start these from the repository root:

```powershell
npm run dev
npm run realtime
```

Open the `/team` page, copy the Team Code, then in VS Code run:

- **OneContext: Join Team**
- **OneContext: Configure Gateway Key**
- **OneContext: Start Task**

The gateway key is stored in VS Code Secret Storage. It is not written to the extension settings file.

The extension view is available in the Explorer under **OneContext Team**. It can publish active-file and saved-file presence automatically when `onecontext.automaticPresence` is enabled. Presence expires after 15 minutes unless refreshed.

## Useful settings

```text
onecontext.apiBaseUrl = http://localhost:3000
onecontext.realtimeUrl = ws://localhost:8787/live
onecontext.automaticPresence = true
```

For a teammate's laptop, replace `localhost` with the host laptop's Wi-Fi IPv4 address, for example `192.168.31.79`.

## Available commands

- **OneContext: Join Team** - join a project using a Team Code.
- **OneContext: Start Task** - publish the file/area and intent you are starting.
- **OneContext: Complete Task and Save Handoff** - save a concise handoff for the next agent.
- **OneContext: Configure Gateway Key** - securely configure authenticated gateway access.
- **OneContext: Leave Team** - stop the current team session.
- **OneContext: Ask Codex with Team Context** - retrieve the shared project context and prepare a Codex prompt.

## Build from source

```powershell
cd apps/vscode-extension
npm install
npm run compile
npm run package
```

The `package` command creates a new versioned `.vsix` file. Install that newest file after rebuilding so VS Code does not continue using an older package.
