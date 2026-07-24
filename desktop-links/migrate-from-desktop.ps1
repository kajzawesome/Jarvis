<#
Imports shortcuts/folders from the real Windows Desktop (user + Public) plus
a chosen set of taskbar-pinned apps into links.json, extracting each
target's icon and recoloring it to the Jarvis green/black HUD theme.

Safe to re-run any time you add new desktop icons or want to add another
taskbar-pinned app - just add its name to $taskbarNamesToInclude below and
re-run. This MERGES into the existing links.json: entries already there
(including ones added from the dashboard's "+ ADD"/"+ URL" tiles) are kept,
only newly-discovered targets are appended. Anything removed via the
dashboard's tile "x" is recorded in excluded.json and skipped here too, so
a re-run won't resurrect it.
#>

Add-Type -AssemblyName System.Drawing

# Taskbar pins are matched by (partial, case-insensitive) name against
# %AppData%\...\User Pinned\TaskBar\*.lnk. Add more names here later as
# needed - everything else pinned to the taskbar is left alone.
$taskbarNamesToInclude = @('Docker Desktop', 'Streamlabs', 'OpenRGB', 'VividLEDDJ')

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$iconsDir = Join-Path $root 'icons'
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

$desktopPaths = @(
  [Environment]::GetFolderPath('Desktop'),
  (Join-Path $env:PUBLIC 'Desktop')
) | Where-Object { Test-Path $_ } | Select-Object -Unique

$taskbarPath = "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"
$linksPath = Join-Path $root 'links.json'
$excludedPath = Join-Path $root 'excluded.json'

$shellCom = New-Object -ComObject WScript.Shell
$skipped = New-Object System.Collections.ArrayList
$seenTargets = New-Object System.Collections.Generic.HashSet[string]

# Seed with whatever's already in links.json so re-running this merges
# instead of wiping out manual adds/edits.
$links = New-Object System.Collections.ArrayList
if (Test-Path $linksPath) {
  $existing = (Get-Content $linksPath -Raw | ConvertFrom-Json).links
  foreach ($item in $existing) {
    [void]$links.Add($item)
    [void]$seenTargets.Add($item.target.ToLowerInvariant())
  }
}

$excludedTargets = New-Object System.Collections.Generic.HashSet[string]
if (Test-Path $excludedPath) {
  $excludedList = (Get-Content $excludedPath -Raw | ConvertFrom-Json).targets
  foreach ($t in $excludedList) { [void]$excludedTargets.Add($t.ToLowerInvariant()) }
}

function Get-Slug([string]$name) {
  $slug = ($name -replace '[^a-zA-Z0-9]+', '-').Trim('-').ToLower()
  if (-not $slug) { $slug = 'item' }
  return $slug
}

function Save-RecoloredIcon([System.Drawing.Bitmap]$bitmap, [string]$outPath) {
  $w = $bitmap.Width
  $h = $bitmap.Height
  $out = New-Object System.Drawing.Bitmap $w, $h
  # theme duotone: dark HUD panel green -> bright HUD green
  $darkR = 2; $darkG = 10; $darkB = 6
  $lightR = 0; $lightG = 255; $lightB = 156
  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $p = $bitmap.GetPixel($x, $y)
      if ($p.A -eq 0) {
        $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        continue
      }
      $lum = (0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B) / 255.0
      $r = [int]($darkR + ($lightR - $darkR) * $lum)
      $g = [int]($darkG + ($lightG - $darkG) * $lum)
      $b = [int]($darkB + ($lightB - $darkB) * $lum)
      $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($p.A, $r, $g, $b))
    }
  }
  $out.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
}

function Try-ExtractIcon([string]$sourcePath, [string]$slug) {
  if (-not $sourcePath -or -not (Test-Path $sourcePath -PathType Leaf)) { return $null }
  try {
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($sourcePath)
    if (-not $icon) { return $null }
    $bmp = $icon.ToBitmap()
    $outPath = Join-Path $iconsDir "$slug.png"
    Save-RecoloredIcon $bmp $outPath
    $bmp.Dispose()
    $icon.Dispose()
    return "icons/$slug.png"
  } catch {
    return $null
  }
}

function Add-Link([string]$label, [string]$type, [string]$target, [string]$args_, [string]$icon) {
  $key = $target.ToLowerInvariant()
  if ($seenTargets.Contains($key)) { return }
  if ($excludedTargets.Contains($key)) { return }
  [void]$seenTargets.Add($key)
  [void]$links.Add([PSCustomObject]@{
    label  = $label
    type   = $type
    target = $target
    args   = $args_
    icon   = $icon
  })
}

function Add-FromShortcut([System.IO.FileInfo]$item) {
  $sc = $shellCom.CreateShortcut($item.FullName)
  $label = [IO.Path]::GetFileNameWithoutExtension($item.Name)
  $target = $sc.TargetPath
  if (-not $target) {
    [void]$skipped.Add("$label (no direct target - likely a Store/UWP app shortcut)")
    return
  }
  $slug = Get-Slug $label
  if (Test-Path $target -PathType Container) {
    Add-Link $label 'folder' $target $null $null
  } else {
    $icon = Try-ExtractIcon $target $slug
    $argsVal = $null
    if ($sc.Arguments) { $argsVal = $sc.Arguments }
    Add-Link $label 'app' $target $argsVal $icon
  }
}

foreach ($desktopPath in $desktopPaths) {
  Get-ChildItem -Path $desktopPath -Force | ForEach-Object {
    $item = $_
    if ($item.Name -eq 'desktop.ini') { return }

    if ($item.PSIsContainer) {
      Add-Link $item.Name 'folder' $item.FullName $null $null
    } elseif ($item.Extension -ieq '.lnk') {
      Add-FromShortcut $item
    } elseif ($item.Extension -ieq '.url') {
      $label = [IO.Path]::GetFileNameWithoutExtension($item.Name)
      $content = Get-Content $item.FullName -ErrorAction SilentlyContinue
      $urlLine = $content | Where-Object { $_ -match '^URL=' } | Select-Object -First 1
      if (-not $urlLine) { [void]$skipped.Add("$label (.url with no URL= line)"); return }
      $target = ($urlLine -replace '^URL=', '').Trim()
      $iconLine = $content | Where-Object { $_ -match '^IconFile=' } | Select-Object -First 1
      $icon = $null
      if ($iconLine) {
        $iconFile = ($iconLine -replace '^IconFile=', '').Trim()
        if (Test-Path $iconFile -PathType Leaf) { $icon = Try-ExtractIcon $iconFile (Get-Slug $label) }
      }
      Add-Link $label 'url' $target $null $icon
    }
    # else: skip loose non-shortcut files (docs, images, etc.)
  }
}

if (Test-Path $taskbarPath) {
  Get-ChildItem -Path $taskbarPath -Filter *.lnk | Where-Object {
    $name = $_.BaseName
    $taskbarNamesToInclude | Where-Object { $name -like "*$_*" }
  } | ForEach-Object {
    Add-FromShortcut $_
  }
}

$payload = [PSCustomObject]@{ links = $links }
$json = $payload | ConvertTo-Json -Depth 6
# Set-Content -Encoding utf8 writes a BOM on Windows PowerShell 5.1, which
# breaks JSON.parse in Node - write via .NET directly to avoid it.
[System.IO.File]::WriteAllText($linksPath, $json, (New-Object System.Text.UTF8Encoding $false))

Write-Output "links.json now has $($links.Count) item(s) total"
if ($skipped.Count -gt 0) {
  Write-Output "Skipped $($skipped.Count):"
  $skipped | ForEach-Object { Write-Output "  - $_" }
}
