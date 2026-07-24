<#
Enumerates every app Jarvis can detect - Start Menu shortcuts (per-user +
all-users) and everything pinned to the taskbar - and prints them as JSON.
Used by the dashboard's "+ ADD APP" picker (desktop-links/collector.js),
and directly useful on its own to see everything available:

  powershell -ExecutionPolicy Bypass -File desktop-links\list-apps.ps1
#>

$shellCom = New-Object -ComObject WScript.Shell
$apps = New-Object System.Collections.ArrayList
$seenTargets = New-Object System.Collections.Generic.HashSet[string]

$startMenuPaths = @(
  (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs'),
  (Join-Path $env:AppData 'Microsoft\Windows\Start Menu\Programs')
) | Where-Object { Test-Path $_ }

$taskbarPath = "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"

function Add-App([string]$name, [string]$target, [string]$argsVal, [string]$source) {
  if (-not $target) { return }
  $key = $target.ToLowerInvariant()
  if ($seenTargets.Contains($key)) { return }
  [void]$seenTargets.Add($key)
  [void]$apps.Add([PSCustomObject]@{
    name   = $name
    target = $target
    args   = $argsVal
    source = $source
  })
}

foreach ($startMenuPath in $startMenuPaths) {
  Get-ChildItem -Path $startMenuPath -Filter *.lnk -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $sc = $shellCom.CreateShortcut($_.FullName)
    if ($sc.TargetPath -and (Test-Path $sc.TargetPath -PathType Leaf)) {
      Add-App ([IO.Path]::GetFileNameWithoutExtension($_.Name)) $sc.TargetPath $sc.Arguments 'start-menu'
    }
  }
}

if (Test-Path $taskbarPath) {
  Get-ChildItem -Path $taskbarPath -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
    $sc = $shellCom.CreateShortcut($_.FullName)
    if ($sc.TargetPath -and (Test-Path $sc.TargetPath -PathType Leaf)) {
      Add-App ([IO.Path]::GetFileNameWithoutExtension($_.Name)) $sc.TargetPath $sc.Arguments 'taskbar'
    }
  }
}

$sorted = $apps | Sort-Object name
$sorted | ConvertTo-Json -Depth 4 -Compress
