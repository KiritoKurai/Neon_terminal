# Claude Code hook → notifies Neon Terminal (PowerShell version, for PCs without Node.js)
# Usage: claude-hook.ps1 <stop|notification|question>   (receives the hook JSON on stdin)
param([string]$Event = 'unknown')
$ErrorActionPreference = 'SilentlyContinue'
if (-not $env:NEON_PORT) { exit 0 }

$raw = [Console]::In.ReadToEnd()
try { $in = $raw | ConvertFrom-Json } catch { $in = $null }
$message = ''

if ($Event -eq 'stop') {
    $message = $in.last_assistant_message
    if (-not $message -and $in.transcript_path -and (Test-Path -LiteralPath $in.transcript_path)) {
        # assistant's last text in the transcript (JSONL)
        $lines = Get-Content -LiteralPath $in.transcript_path -Tail 300 -Encoding UTF8
        for ($i = $lines.Count - 1; $i -ge 0 -and -not $message; $i--) {
            try { $j = $lines[$i] | ConvertFrom-Json } catch { continue }
            if ($j.type -ne 'assistant' -or -not $j.message) { continue }
            $message = (@($j.message.content) | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text }) -join "`n"
        }
    }
} elseif ($Event -eq 'notification') {
    $message = $in.message
} elseif ($Event -eq 'question') {
    $q = @($in.tool_input.questions)[0]
    $message = if ($q) { $q.question } else { 'Claude' }
}

$msg = [string]$message
if ($msg.Length -gt 600) { $msg = $msg.Substring(0, 600) }
$body = @{ token = $env:NEON_TOKEN; ptyId = [int]$env:NEON_PTY_ID; event = $Event; message = $msg; cwd = [string]$in.cwd } | ConvertTo-Json -Compress
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:$($env:NEON_PORT)/claude" -Method Post -ContentType 'application/json; charset=utf-8' `
        -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 2 | Out-Null
} catch {}
exit 0
