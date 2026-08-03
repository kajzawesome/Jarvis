<#
Creates Windows Startup-folder shortcuts for background apps that Jarvis
nodes need running to actually connect (OpenRGB for rgb-control, Streamlabs
Desktop for the streamlabs node) - so they're already up by the time Jarvis
itself launches, instead of showing "NOT RUNNING" until you start them
manually.

Docker Desktop and Stream Deck are NOT in this list - they already autostart
on their own (installed that way by their own installers; confirmed via
HKCU\Software\Microsoft\Windows\CurrentVersion\Run). Only apps that weren't
already autostarting are added here.

Re-run any time you want to add another dependency app - add an entry to
$APPS below and run again. Safe to re-run; each shortcut is just recreated.

  powershell -ExecutionPolicy Bypass -File dashboard\node-dependencies-autostart.ps1
#>

$startupDir = [Environment]::GetFolderPath('Startup')
$shell = New-Object -ComObject WScript.Shell

$APPS = @(
  @{
    Name   = 'OpenRGB (Jarvis)'
    # EDIT THIS to your own OpenRGB.exe location (same path you set as
    # OPENRGB_EXE_PATH in .env) - portable/versioned downloads like this one
    # land in a different folder on every machine.
    Target = 'C:\Users\you\Downloads\OpenRGB_0.9_Windows_64\OpenRGB Windows 64-bit\OpenRGB.exe'
    # --server starts the SDK server rgb-control connects to; --startminimized
    # keeps it out of the way. If rgb-control still shows "not running" after
    # a reboot, open OpenRGB manually once and check the SDK Server tab has
    # its own "Start Server" checkbox saved on - that's a persisted app
    # setting independent of these CLI flags and is the more reliable path
    # if the flags turn out not to match this OpenRGB build.
    Args   = '--server --startminimized'
  },
  @{
    Name   = 'Streamlabs Desktop (Jarvis)'
    Target = 'C:\Program Files\Streamlabs OBS\Streamlabs OBS.exe'
    # No flag needed - Remote Control (what the streamlabs node connects to)
    # is a setting saved inside Streamlabs itself, not a launch flag. Just
    # needs to be enabled once in Settings > Remote Control (already done,
    # since the streamlabs node connected successfully before).
    Args   = ''
  }
)

foreach ($app in $APPS) {
  if (-not (Test-Path $app.Target)) {
    Write-Output "Skipped $($app.Name) - target not found: $($app.Target)"
    continue
  }
  $lnkPath = Join-Path $startupDir "$($app.Name).lnk"
  $shortcut = $shell.CreateShortcut($lnkPath)
  $shortcut.TargetPath = $app.Target
  $shortcut.Arguments = $app.Args
  $shortcut.WorkingDirectory = Split-Path $app.Target -Parent
  $shortcut.Save()
  Write-Output "Created: $lnkPath"
}

Write-Output ""
Write-Output "Startup folder: $startupDir"
Write-Output "(To remove one later, just delete its .lnk from that folder.)"
