# dev-workspace

Work/IT-focused node: which editor windows are open right now, and the git status of your real projects — the "VS Code and stuff like that" node.

## Status: 🟢 active

## Open editors

Enumerates running windows for a fixed list of known editor/IDE processes (VS Code, VS Code Insiders, Cursor, Visual Studio, IntelliJ/PyCharm/WebStorm/Rider, Sublime Text, Notepad++ — see `$editorProcessNames` in `list-editor-windows.ps1`, add more there if you use one not listed) that currently have a visible window. Click a row to bring that window to the foreground (`focus-window.ps1`, via `WScript.Shell`'s `AppActivate` — a documented exception to Windows' normal foreground-lock restriction on background processes stealing focus).

## Project git status

VS Code no longer keeps a plain "recent folders" list in a file Jarvis can just read (that moved to a SQLite `state.vscdb` in newer versions) — but `%APPDATA%\Code\User\globalStorage\storage.json`'s `windowsState`/`backupWorkspaces` sections still expose the currently-open and most-recently-open folder paths, which is enough without a SQLite dependency. For each of those that's an actual git repo (has a `.git` folder), shows branch, dirty file count (or `clean`), and ahead/behind counts against its upstream (blank if no upstream is configured). A `●` marks a project that's also currently open in a detected editor window. Click a project row to open it in VS Code (`code.cmd <path>` — requires the `code` CLI on PATH, which the VS Code installer adds by default).

## Notes

- Only reflects VS Code's own record of recent/open folders — a project you've never opened in VS Code won't show up here even if it's a git repo on disk.
- `AppActivate`-based focus can still occasionally be ignored by Windows depending on what currently has focus — same caveat as any focus-stealing automation on this OS, not something to fully "fix."
