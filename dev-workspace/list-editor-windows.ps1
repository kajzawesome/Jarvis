<#
Enumerates running editor/IDE windows Jarvis knows about (VS Code, Cursor,
Visual Studio, JetBrains IDEs, Sublime Text, Notepad++) that currently have
a visible top-level window, and prints them as JSON:

  [{ "pid": 1234, "processName": "Code", "title": "file - folder - Visual Studio Code" }, ...]

Used by dev-workspace/collector.js. Add more process names to
$editorProcessNames below if you use an editor not already listed here.
#>

$editorProcessNames = @(
  'Code', 'Code - Insiders', 'Cursor', 'devenv',
  'idea64', 'pycharm64', 'webstorm64', 'rider64',
  'sublime_text', 'notepad++'
)

$found = Get-Process | Where-Object {
  $editorProcessNames -contains $_.ProcessName -and $_.MainWindowTitle
} | ForEach-Object {
  [PSCustomObject]@{
    pid         = $_.Id
    processName = $_.ProcessName
    title       = $_.MainWindowTitle
  }
}

@($found) | ConvertTo-Json -Depth 3 -Compress
