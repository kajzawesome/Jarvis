<#
Extracts one file's icon and recolors it to the Jarvis green/black theme.
Used by the app itself (desktop-links/collector.js) when you add a link
on-the-fly from the dashboard, so ad-hoc adds get themed icons too, same as
the bulk migration script.

Prints the relative icon path (e.g. "icons/foo.png") on success, or nothing
on failure.
#>
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Slug,
  [Parameter(Mandatory = $true)][string]$OutDir
)

Add-Type -AssemblyName System.Drawing

function Save-RecoloredIcon([System.Drawing.Bitmap]$bitmap, [string]$outPath) {
  $w = $bitmap.Width
  $h = $bitmap.Height
  $out = New-Object System.Drawing.Bitmap $w, $h
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

if (-not (Test-Path $Source -PathType Leaf)) { exit 0 }

try {
  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($Source)
  if (-not $icon) { exit 0 }
  $bmp = $icon.ToBitmap()
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  $outPath = Join-Path $OutDir "$Slug.png"
  Save-RecoloredIcon $bmp $outPath
  $bmp.Dispose()
  $icon.Dispose()
  Write-Output "icons/$Slug.png"
} catch {
  exit 0
}
