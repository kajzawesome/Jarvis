<#
Creates a double-clickable "Jarvis.lnk" shortcut on your Desktop so you can
launch the app without opening a terminal - same launch command autostart
already uses under the hood (electron.exe run against the Jarvis root
folder, which Electron reads as "run this app").

Also converts dashboard/assets/tray-icon.png to a .ico (shortcuts need an
.ico/.exe/.dll for a custom icon, not a .png directly) so the shortcut
doesn't just show a generic Electron icon.

Safe to re-run any time - just recreates the shortcut.

  powershell -ExecutionPolicy Bypass -File dashboard\create-desktop-shortcut.ps1
#>

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$electronExe = Join-Path $root 'node_modules\electron\dist\electron.exe'
$pngPath = Join-Path $PSScriptRoot 'assets\tray-icon.png'
$icoPath = Join-Path $PSScriptRoot 'assets\tray-icon.ico'
$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'Jarvis.lnk'

if (-not (Test-Path $electronExe)) {
  Write-Output "electron.exe not found at $electronExe - run 'npm install' from the Jarvis root first."
  exit 1
}

if (Test-Path $pngPath) {
  $bmp = New-Object System.Drawing.Bitmap $pngPath
  $hIcon = $bmp.GetHicon()
  $icon = [System.Drawing.Icon]::FromHandle($hIcon)
  $fs = New-Object System.IO.FileStream $icoPath, ([System.IO.FileMode]::Create)
  $icon.Save($fs)
  $fs.Close()
  $icon.Dispose()
  $bmp.Dispose()
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)
$shortcut.TargetPath = $electronExe
$shortcut.Arguments = "`"$root`""
$shortcut.WorkingDirectory = $root
if (Test-Path $icoPath) { $shortcut.IconLocation = $icoPath }
$shortcut.Description = 'Launch J.A.R.V.I.S.'
$shortcut.Save()

Write-Output "Created: $lnkPath"
Write-Output "Double-click it (or pin it to Start/taskbar) to launch Jarvis without a terminal."
