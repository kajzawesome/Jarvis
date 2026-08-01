<#
Brings a window to the foreground by process id, used when you click an
"open editors" row in the dev-workspace tile. Uses WScript.Shell's
AppActivate rather than raw user32 SetForegroundWindow - Windows' foreground
lock heuristics normally block a background process from stealing focus
from whatever the user is currently looking at, but AppActivate is a
documented COM automation exception to that.
#>
param(
  [Parameter(Mandatory = $true)][int]$ProcId
)

$shell = New-Object -ComObject WScript.Shell
[void]$shell.AppActivate($ProcId)
