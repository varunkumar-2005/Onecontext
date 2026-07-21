# OneContext browser extension

This Manifest V3 proof of concept adds a `✦ Add context` button to ChatGPT and Claude. The button calls the OneContext Gateway and replaces the current prompt with the original question wrapped in retrieved project context.

## Load locally

1. Start the OneContext app on `http://localhost:3000`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this folder.
5. Open the extension popup and save the API URL and project ID.
6. Refresh ChatGPT or Claude and use the purple button beside the prompt.
