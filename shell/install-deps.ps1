# Installs Neon Terminal's missing dependencies with winget.
#   install-deps.ps1               → required ones (Claude Code, ffmpeg)
#   install-deps.ps1 -Optional     → also the optional ones (Git, PowerShell 7, Node.js, nmap)
#   install-deps.ps1 -Only <id>    → just one
param([switch]$Optional, [string]$Only = '')
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$deps = @(
    @{ id = 'Anthropic.ClaudeCode'; exe = 'claude.exe'; name = 'Claude Code'; required = $true }
    @{ id = 'Gyan.FFmpeg'; exe = 'ffmpeg.exe'; name = 'ffmpeg'; required = $true }
    @{ id = 'Git.Git'; exe = 'git.exe'; name = 'Git (+ Git Bash)'; required = $false }
    @{ id = 'Microsoft.PowerShell'; exe = 'pwsh.exe'; name = 'PowerShell 7'; required = $false }
    @{ id = 'OpenJS.NodeJS.LTS'; exe = 'node.exe'; name = 'Node.js'; required = $false }
    @{ id = 'Insecure.Nmap'; exe = 'nmap.exe'; name = 'Nmap'; required = $false }
)

function Test-Installed($exe) {
    if (Get-Command $exe -CommandType Application -ErrorAction SilentlyContinue) { return $true }
    $extra = @("$env:LOCALAPPDATA\Microsoft\WinGet\Links\$exe", "$env:USERPROFILE\.local\bin\$exe", "${env:ProgramFiles}\Git\cmd\$exe",
        "${env:ProgramFiles}\PowerShell\7\$exe", "${env:ProgramFiles}\nodejs\$exe", "${env:ProgramFiles(x86)}\Nmap\$exe")
    return [bool]($extra | Where-Object { Test-Path $_ } | Select-Object -First 1)
}

$winget = Get-Command winget.exe -ErrorAction SilentlyContinue
if (-not $winget) {
    Write-Output 'winget is not available: install "App Installer" from the Microsoft Store and try again.'
    exit 0
}

$todo = $deps | Where-Object { if ($Only) { $_.id -eq $Only } elseif ($Optional) { $true } else { $_.required } }
foreach ($d in $todo) {
    if (Test-Installed $d.exe) { Write-Output "✔ $($d.name): already installed"; continue }
    Write-Output "→ Installing $($d.name)…"
    & winget install --id $d.id -e --silent --accept-source-agreements --accept-package-agreements --disable-interactivity 2>&1 |
        Where-Object { $_ -match '\S' -and $_ -notmatch '^[\s\-\\|/█▒]+$' } | Select-Object -Last 3 | ForEach-Object { "   $_" }
    if (Test-Installed $d.exe) { Write-Output "✔ $($d.name): installed" } else { Write-Output "! $($d.name): could not be confirmed (you can install it later from the app)" }
}
exit 0
