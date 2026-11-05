# CodePush (Chrome extension)

Pushes solved problems from GeeksforGeeks, HackerRank and CodeChef to GitHub.

## Files
- `manifest.json` — Manifest V3; content scripts run on the three coding platforms; clicking the toolbar icon opens the side panel.
- `background.js` — service worker: GitHub token validation, repo creation, file commits, side-panel-open-on-click behavior.
- `content.js` — detects problem title, difficulty, language and solution code; adds a floating "Push to GitHub" button.
- `popup.html` / `sidepanel.html` — the same UI in two shells (compact popup / full-height side panel); both load `popup.js`: connect GitHub (personal access token, `repo` scope), edit the solution, push manually, settings (repo name, private repo).

## Behaviour
- Token is stored in `chrome.storage.local` on the user's machine only.
- Commits go to `<repoName>/<Platform>/<problem-slug>.<ext>` (repo auto-created as `coding-solutions` if missing).
- Re-pushing the same problem updates the existing file (keeps git history).
