# ============================================================================
#  NEON TERMINAL — PowerShell module
#  Futuristic prompt + extra commands. Type `neon` to list them all.
#  Customize it by adding your own functions to ~\.neonrc.ps1
# ============================================================================

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8; [Console]::InputEncoding = [Text.Encoding]::UTF8 } catch {}
$OutputEncoding = [Text.Encoding]::UTF8

$script:E = [char]27
$script:NeonCommands = [ordered]@{}
. (Join-Path $PSScriptRoot 'i18n.ps1')

# argument names in the help (<fitxer>, [filtre]…): Catalan → @(Spanish, English)
$script:ArgWords = @{
    carpeta = @('carpeta', 'folder'); ciutat = @('ciudad', 'city'); comanda = @('comando', 'command'); domini = @('dominio', 'domain')
    efecte = @('efecto', 'effect'); 'expressió' = @('expresión', 'expression'); filtre = @('filtro', 'filter'); fitxer = @('archivo', 'file')
    intensitat = @('intensidad', 'intensity'); nom = @('nombre', 'name'); 'patró' = @('patrón', 'pattern'); pregunta = @('pregunta', 'question')
    ruta = @('ruta', 'path'); seg = @('seg', 'sec'); servidor = @('servidor', 'server'); usuari = @('usuario', 'user'); 'comanda...' = @('comando...', 'command...')
}
function script:Reg($cat, $name, $desc) {
    $cat = L $cat
    if ($global:NeonLang -ne 'ca') {
        $i = if ($global:NeonLang -eq 'es') { 0 } else { 1 }
        $name = [regex]::Replace($name, '[<\[][^>\]]+[>\]]', { param($m) [regex]::Replace($m.Value, '\p{L}+', { param($w) $t = $script:ArgWords[$w.Value]; if ($t) { $t[$i] } else { $w.Value } }) })
    }
    if (-not $script:NeonCommands.Contains($cat)) { $script:NeonCommands[$cat] = @() }
    $script:NeonCommands[$cat] += [pscustomobject]@{ Name = $name; Desc = (L $desc) }
}

function global:Send-Neon([string]$Key, [string]$Value = '') {
    [Console]::Write("$([char]27)]7777;$Key=$Value$([char]7)")
}
# Base64 JSON (UTF-8) to send data with any character inside an OSC sequence
function global:Send-NeonJson([string]$Key, $Obj) {
    Send-Neon $Key ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($Obj | ConvertTo-Json -Compress))))
}

# ---------------------------------------------------------------- PSReadLine
try {
    Import-Module PSReadLine -ErrorAction Stop
    Set-PSReadLineOption -HistoryNoDuplicates -BellStyle None -EditMode Windows
    try { Set-PSReadLineOption -PredictionSource History -PredictionViewStyle ListView -ErrorAction Stop } catch {}
    try {
        Set-PSReadLineOption -Colors @{
            Command = "$E[96m"; Parameter = "$E[95m"; String = "$E[93m"; Operator = "$E[36m"
            Variable = "$E[92m"; Number = "$E[33m"; Comment = "$E[90m"; Keyword = "$E[35m"; Member = "$E[37m"
        }
    } catch {}
    Set-PSReadLineKeyHandler -Key Tab -Function MenuComplete
    Set-PSReadLineKeyHandler -Key UpArrow -Function HistorySearchBackward
    Set-PSReadLineKeyHandler -Key DownArrow -Function HistorySearchForward
} catch {}

# ---------------------------------------------------------------- prompt
function script:GitBranch {
    $d = (Get-Location).ProviderPath
    while ($d) {
        $head = Join-Path $d '.git\HEAD'
        if (Test-Path -LiteralPath $head) {
            $h = (Get-Content -LiteralPath $head -TotalCount 1)
            if ($h -match 'ref: refs/heads/(.+)') { return $Matches[1] }
            return $h.Substring(0, 7)
        }
        $p = Split-Path $d -Parent
        if ($p -eq $d) { break }
        $d = $p
    }
    return $null
}

if ($null -eq $global:NeonErrCount) { $global:NeonErrCount = $Error.Count }
function global:prompt {
    $ok = $?
    $exit = $LASTEXITCODE
    $e = [char]27
    $loc = (Get-Location).ProviderPath
    Send-Neon 'cwd' $loc
    $short = $loc.Replace($HOME, '~')
    $last = Get-History -Count 1
    $dur = ''
    if ($last -and $last.Id -ne $global:NeonLastHistId) {
        $global:NeonLastHistId = $last.Id
        $ms = ($last.EndExecutionTime - $last.StartExecutionTime).TotalMilliseconds
        if ($ms -gt 1500) { $dur = " $e[33m" + [char]0x29D7 + " {0:N1}s" -f ($ms / 1000) }
        # notify the app: failed command ("Ask Claude" button) and finished long command
        $cmd = $last.CommandLine
        if (-not $ok -and $env:NEON_ERRHELP -eq '1' -and $cmd -notmatch '^\s*(cls|clear|exit)\s*$') {
            $err = if ($Error.Count -gt $global:NeonErrCount) { ($Error[0] | Out-String).Trim() } elseif ($exit) { "exit code $exit" } else { '' }
            Send-NeonJson 'cmdfail' @{ cmd = $cmd; err = $err.Substring(0, [Math]::Min(1500, $err.Length)) }
        }
        $limit = [int]("0$env:NEON_LONGCMD")
        if ($limit -gt 0 -and $ms / 1000 -ge $limit) { Send-NeonJson 'longdone' @{ cmd = $cmd; secs = [int]($ms / 1000); ok = [bool]$ok } }
    }
    $global:NeonErrCount = $Error.Count
    $branch = GitBranch
    $git = if ($branch) { " $e[35m" + [char]0xE0A0 + " $branch" } else { '' }
    $status = if ($ok) { "$e[36m" } else { "$e[31m" }
    $time = Get-Date -Format 'HH:mm:ss'
    $host.UI.RawUI.WindowTitle = (Split-Path $loc -Leaf)
    "`n$e[90m" + [char]0x256D + [char]0x2500 + "$e[0m $e[2m$time$e[0m $e[1;34m$short$e[0m$git$dur$e[0m`n$e[90m" + [char]0x2570 + [char]0x2500 + "$status" + [char]0x276F + "$e[0m "
}

# ---------------------------------------------------------------- terminal control
Reg 'Aparença' 'theme [nom]' 'Canvia la skin (sense nom: llista)'
function global:theme([string]$name) {
    if (-not $name) {
        "claude cyberpunk matrix tron synthwave bladerunner arctic void sith glass" -split ' ' | ForEach-Object { "  $E[96m$_$E[0m" }
        "  (+ els teus temes personalitzats)"; return
    }
    Send-Neon 'theme' $name
}
Reg 'Aparença' 'fx [efecte] [intensitat]' 'Fons animat (sense nom: llista)'
function global:fx([string]$name = '', [double]$intensity = -1) {
    if (-not $name) { 'none grid sunset particles matrix stars waves aurora hex circuit rain bokeh tunnel radar plasma snow fireflies dna scan' -split ' ' | ForEach-Object { "  $E[96m$_$E[0m" }; return }
    Send-Neon 'effect' $name; if ($intensity -ge 0) { Send-Neon 'intensity' $intensity }
}
Reg 'Aparença' 'opacity <0-1>' 'Transparència del fons'
function global:opacity([double]$v) { Send-Neon 'opacity' $v }
Reg 'Aparença' 'fontsize <n>' 'Mida del text'
function global:fontsize([int]$v) { Send-Neon 'fontsize' $v }
Reg 'Aparença' 'glow on|off' 'Resplendor neó del text'
function global:glow([string]$v = 'on') { Send-Neon 'glow' $v }
Reg 'Aparença' 'crt on|off' 'Scanlines de monitor retro'
function global:crt([string]$v = 'on') { Send-Neon 'scanlines' $v }
Reg 'Aparença' 'accent <#hex>' 'Color d''accent ("" = el del tema)'
function global:accent([string]$v = '') { Send-Neon 'accent' $v }
Reg 'Aparença' 'wallpaper <ruta|url>' 'Imatge de fons ("" per treure-la)'
function global:wallpaper([string]$p = '') { if ($p -and (Test-Path $p)) { $p = (Resolve-Path $p).Path }; Send-Neon 'bgimage' $p }
Reg 'Aparença' 'cursor bar|block|underline' 'Estil del cursor'
function global:cursor([string]$v = 'bar') { Send-Neon 'cursor' $v }
Reg 'Aparença' 'neon-set ''{json}''' 'Canvia qualsevol opció de settings.json'
function global:neon-set([string]$json) { Send-Neon 'set' $json }
Reg 'Aparença' 'settings / palette' 'Obre el panell de personalització / paleta'
function global:settings { Send-Neon 'settings' }
function global:palette { Send-Neon 'palette' }
Reg 'Aparença' 'split [right]' 'Divideix el panell (a sota o a la dreta)'
function global:split([string]$dir = 'down') { Send-Neon 'split' $dir }
Reg 'Aparença' 'pin on|off' 'Finestra sempre davant'
function global:pin([string]$v = 'on') { Send-Neon 'top' $v }
Reg 'Aparença' 'lang ca|es|en' 'Idioma de l''app: ca | es | en'
function global:lang([string]$l) { if ($l -in 'ca', 'es', 'en') { Send-Neon 'lang' $l } else { $global:NeonLang } }
Reg 'Aparença' 'focus on|off' 'Mode focus (amaga barres)'
function global:focus([string]$v = 'on') { Send-Neon 'focus' $v }
Reg 'Fitxers' 'preview / pv <fitxer>' 'Previsualitza un fitxer o carpeta (imatges, PDF, JSON, Markdown…)'
function global:preview([string]$p = '.') { $r = Resolve-Path -LiteralPath $p -ErrorAction SilentlyContinue; if ($r) { Send-Neon 'preview' $r.ProviderPath } else { Write-Host "  $p ?" } }
Set-Alias -Name pv -Value preview -Scope Global
Reg 'Aparença' 'notify <text>' 'Notificació de Windows'
function global:notify([string]$msg = (L 'Fet!')) { Send-Neon 'notify' $msg }

# ---------------------------------------------------------------- Claude
Reg 'Claude' 'ask <pregunta>' 'Pregunta ràpida a Claude (sense sortir del shell)'
function global:ask { if (-not $args) { Write-Host (L 'Ús: ask com llisto els ports oberts?'); return }; claude -p (($args -join ' ') + ' ' + (L 'Respon breument en català.')) }
Reg 'Claude' 'explain <comanda>' 'Claude explica què fa una comanda'
function global:explain { claude -p ("Explain briefly what this PowerShell/Windows command does and whether it is safe: " + ($args -join ' ') + ' ' + (L 'Respon breument en català.')) }
Reg 'Claude' 'fixlast' 'Claude analitza l''últim error'
function global:fixlast {
    $err = $Error | Select-Object -First 1
    $cmd = (Get-History -Count 1).CommandLine
    if (-not $err) { Write-Host (L 'No hi ha errors recents.'); return }
    claude -p "I ran this in PowerShell: $cmd`nAnd got this error: $err`nExplain the cause and how to fix it. $(L 'Respon breument en català.')"
}
Reg 'Claude' 'cc [args]' 'Obre Claude Code a la carpeta actual'
function global:cc { claude @args }
# Claude opened from the shell also notifies Neon when it finishes or asks something (not for quick -p answers)
function global:claude {
    $exe = Get-Command claude -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $exe) { Write-Host "  'claude' ?"; return }
    if ($env:NEON_CLAUDE_SETTINGS -and -not ($args -match '^(-p|--print)$')) { & $exe --settings $env:NEON_CLAUDE_SETTINGS @args }
    else { & $exe @args }
}

# ---------------------------------------------------------------- system
Reg 'Sistema' 'sysinfo' 'Resum del sistema estil neofetch'
function global:sysinfo {
    $os = Get-CimInstance Win32_OperatingSystem
    $cs = Get-CimInstance Win32_ComputerSystem
    $cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name.Trim()
    $gpu = (Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name) -join ', '
    $up = (Get-Date) - $os.LastBootUpTime
    $memT = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
    $memU = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1MB, 1)
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
    $dU = [math]::Round(($disk.Size - $disk.FreeSpace) / 1GB); $dT = [math]::Round($disk.Size / 1GB)
    $logo = @(
        "$E[96m    ___  ___ ", "$E[96m   / _ \/ _ \", "$E[95m  / / // // /", "$E[95m /_/ /_/\___/ ", "$E[94m  N E O N    ", "$E[94m             ", "$E[90m             ", "$E[90m             ", "             "
    )
    $info = @(
        "$E[1;96m$env:USERNAME$E[0m@$E[1;95m$env:COMPUTERNAME$E[0m",
        "$E[90m-------------------------$E[0m",
        "$E[96mOS$E[0m      $($os.Caption) ($($os.OSArchitecture))",
        "$E[96mKernel$E[0m  $($os.Version)",
        "$E[96mUptime$E[0m  $($up.Days)d $($up.Hours)h $($up.Minutes)m",
        "$E[96mCPU$E[0m     $cpu",
        "$E[96mGPU$E[0m     $gpu",
        "$E[96mRAM$E[0m     $memU / $memT GB",
        "$E[96m$((L 'Disc C').PadRight(7))$E[0m $dU / $dT GB"
    )
    for ($i = 0; $i -lt $info.Count; $i++) { "$($logo[$i])$E[0m  $($info[$i])" }
    ""; "  " + (((40..47) | ForEach-Object { "$E[${_}m   " }) -join '') + "$E[0m"
}
Reg 'Sistema' 'top [n]' 'Processos que més CPU/RAM consumeixen'
function global:top([int]$n = 15) {
    Get-Process | Sort-Object CPU -Descending | Select-Object -First $n Id, ProcessName,
    @{N = 'CPU(s)'; E = { [math]::Round($_.CPU, 1) } }, @{N = 'RAM(MB)'; E = { [math]::Round($_.WorkingSet64 / 1MB) } } | Format-Table -AutoSize
}
Reg 'Sistema' 'disks' 'Espai de tots els discos amb barres'
function global:disks {
    Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
        $pct = if ($_.Size) { ($_.Size - $_.FreeSpace) / $_.Size } else { 0 }
        $bar = ('#' * [int]($pct * 30)).PadRight(30, '.')
        $col = if ($pct -gt .9) { 31 } elseif ($pct -gt .7) { 33 } else { 32 }
        "{0}  $E[${col}m[{1}]$E[0m {2,5:P0}  {3:N0}/{4:N0} GB" -f $_.DeviceID, $bar, $pct, (($_.Size - $_.FreeSpace) / 1GB), ($_.Size / 1GB)
    }
}
Reg 'Sistema' 'uptime' 'Temps encès'
function global:uptime { $u = (Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime; "{0}d {1}h {2}m" -f $u.Days, $u.Hours, $u.Minutes }
Reg 'Sistema' 'battery' 'Estat de la bateria'
function global:battery { $b = Get-CimInstance Win32_Battery; if ($b) { "$($b.EstimatedChargeRemaining)% - $(L 'estat') $($b.BatteryStatus)" } else { L 'Sense bateria' } }
Reg 'Sistema' 'killp <nom>' 'Mata processos pel nom'
function global:killp([string]$name) { Get-Process -Name "*$name*" -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force; "$(L 'Tancat'): $($_.ProcessName) ($($_.Id))" } }
Reg 'Sistema' 'admin' 'Obre PowerShell com a administrador'
function global:admin { Start-Process powershell -Verb RunAs }
Reg 'Sistema' 'path' 'Mostra el PATH, una ruta per línia'
function global:path { $env:Path -split ';' | Where-Object { $_ } }
Reg 'Sistema' 'env [filtre]' 'Variables d''entorn'
function global:env([string]$f = '') { Get-ChildItem env: | Where-Object { $_.Name -like "*$f*" } | Format-Table -AutoSize }
Reg 'Sistema' 'reload' 'Recarrega aquest mòdul'
function global:reload { . "$env:NEON_SHELL_DIR\neon.ps1" }

# ---------------------------------------------------------------- network
Reg 'Xarxa' 'myip' 'IP pública i ubicació'
function global:myip { try { $r = Invoke-RestMethod 'https://ipinfo.io/json' -TimeoutSec 6; "$E[96m$($r.ip)$E[0m  $($r.city), $($r.region), $($r.country)  $E[90m$($r.org)$E[0m" } catch { L 'Sense connexió' } }
Reg 'Xarxa' 'localip' 'IPs locals'
function global:localip { Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' } | Select-Object InterfaceAlias, IPAddress | Format-Table -AutoSize }
Reg 'Xarxa' 'ports' 'Ports en escolta i el procés'
function global:ports {
    Get-NetTCPConnection -State Listen | Sort-Object LocalPort | Select-Object LocalAddress, LocalPort,
    @{N = 'Procés'; E = { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName } }, OwningProcess | Format-Table -AutoSize
}
Reg 'Xarxa' 'killport <port>' 'Mata el procés que usa un port'
function global:killport([int]$port) {
    Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -Unique OwningProcess | ForEach-Object {
        $p = Get-Process -Id $_.OwningProcess; Stop-Process -Id $p.Id -Force; ((L 'Tancat {0} ({1}) al port {2}') -f $p.ProcessName, $p.Id, $port)
    }
}
Reg 'Xarxa' 'weather [ciutat]' 'El temps (wttr.in)'
function global:weather([string]$city = '') { (Invoke-WebRequest "https://wttr.in/$($city)?lang=ca&F" -UserAgent 'curl' -UseBasicParsing).Content }
Reg 'Xarxa' 'pingg <host>' 'Ping amb gràfic de latència'
function global:pingg([string]$h = '1.1.1.1', [int]$n = 20) {
    $p = New-Object System.Net.NetworkInformation.Ping
    1..$n | ForEach-Object {
        try { $r = $p.Send($h, 2000); $ms = $r.RoundtripTime; $ok = $r.Status -eq 'Success' } catch { $ok = $false }
        if ($ok) { $c = if ($ms -lt 40) { 32 } elseif ($ms -lt 100) { 33 } else { 31 }; "{0,5} ms $E[${c}m{1}$E[0m" -f $ms, ('|' * [math]::Min(60, [math]::Max(1, $ms / 3))) } else { "  --- $E[31mtimeout$E[0m" }
        Start-Sleep -Milliseconds 400
    }
}
Reg 'Xarxa' 'dns <domini>' 'Resolució DNS'
function global:dns([string]$d) { Resolve-DnsName $d | Format-Table -AutoSize }
Reg 'Xarxa' 'headers <url>' 'Capçaleres HTTP'
function global:headers([string]$u) { (Invoke-WebRequest $u -Method Head -UseBasicParsing).Headers }
Reg 'Xarxa' 'serve [port]' 'Servidor HTTP a la carpeta actual'
function global:serve([int]$port = 8000) { ((L 'Servint {0} a {1}') -f $PWD, "http://localhost:$port"); Start-Process "http://localhost:$port"; python -m http.server $port }

# ---------------------------------------------------------------- files
Reg 'Fitxers' 'll [ruta]' 'Llistat amb colors i mides'
function global:ll([string]$p = '.') {
    Get-ChildItem -Force $p | ForEach-Object {
        $isDir = $_.PSIsContainer
        $size = if ($isDir) { '<DIR>' } elseif ($_.Length -gt 1MB) { '{0:N1}M' -f ($_.Length / 1MB) } elseif ($_.Length -gt 1KB) { '{0:N0}K' -f ($_.Length / 1KB) } else { "$($_.Length)B" }
        $c = if ($isDir) { '1;94' } elseif ($_.Extension -match '\.(exe|bat|cmd|ps1|msi)$') { '92' } elseif ($_.Extension -match '\.(zip|rar|7z|tar|gz)$') { '91' } elseif ($_.Extension -match '\.(png|jpg|jpeg|gif|svg|webp|mp4|mp3)$') { '95' } elseif ($_.Name.StartsWith('.')) { '90' } else { '0' }
        "{0}  {1,8}  $E[${c}m{2}$E[0m" -f $_.LastWriteTime.ToString('yyyy-MM-dd HH:mm'), $size, $_.Name
    }
}
Reg 'Fitxers' 'mkcd <dir>' 'Crea una carpeta i hi entra'
function global:mkcd([string]$d) { New-Item -ItemType Directory -Force $d | Out-Null; Set-Location $d }
Reg 'Fitxers' 'touch <fitxer>' 'Crea fitxer o actualitza data'
function global:touch([string]$f) { if (Test-Path $f) { (Get-Item $f).LastWriteTime = Get-Date } else { New-Item -ItemType File $f | Out-Null } }
Reg 'Fitxers' 'which <cmd>' 'On és un executable'
function global:which([string]$c) { Get-Command $c -All | Select-Object CommandType, Name, Source | Format-Table -AutoSize }
Reg 'Fitxers' 'size [ruta]' 'Mida total d''una carpeta'
function global:size([string]$p = '.') { $s = (Get-ChildItem $p -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; '{0:N2} MB' -f ($s / 1MB) }
Reg 'Fitxers' 'bigfiles [n]' 'Els fitxers més grans d''aquí'
function global:bigfiles([int]$n = 15) { Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -First $n @{N = 'MB'; E = { [math]::Round($_.Length / 1MB, 1) } }, FullName | Format-Table -AutoSize }
Reg 'Fitxers' 'ff <patró>' 'Busca fitxers pel nom'
function global:ff([string]$pat) { Get-ChildItem -Recurse -Filter "*$pat*" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName }
Reg 'Fitxers' 'grep <text> [filtre]' 'Busca text dins fitxers'
function global:grep([string]$t, [string]$filter = '*') { Get-ChildItem -Recurse -File -Filter $filter -ErrorAction SilentlyContinue | Select-String -Pattern $t | ForEach-Object { "$E[95m$($_.Path)$E[0m:$E[32m$($_.LineNumber)$E[0m: $($_.Line.Trim())" } }
Reg 'Fitxers' 'extract <zip>' 'Descomprimeix'
function global:extract([string]$f) { Expand-Archive $f -DestinationPath ([IO.Path]::GetFileNameWithoutExtension($f)) -Force }
Reg 'Fitxers' 'zipit <ruta>' 'Comprimeix en zip'
function global:zipit([string]$p) { Compress-Archive $p "$((Get-Item $p).Name).zip" -Force }
Reg 'Fitxers' 'hash <fitxer> [alg]' 'Hash SHA256/MD5…'
function global:hash([string]$f, [string]$a = 'SHA256') { (Get-FileHash $f -Algorithm $a).Hash }
Reg 'Fitxers' 'open [ruta]' 'Obre amb l''app per defecte / Explorer'
function global:open([string]$p = '.') { Invoke-Item $p }
Reg 'Fitxers' 'mark <nom> / go <nom>' 'Marcadors de carpetes'
$script:MarksFile = Join-Path $HOME '.neon-marks.json'
function global:mark([string]$n) { $m = @{}; if (Test-Path $MarksFile) { (Get-Content $MarksFile -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $m[$_.Name] = $_.Value } }; $m[$n] = (Get-Location).Path; $m | ConvertTo-Json | Set-Content $MarksFile; ((L 'Marcat: {0}') -f $n) }
function global:go([string]$n) {
    if (-not (Test-Path $MarksFile)) { L 'Cap marcador'; return }
    $m = Get-Content $MarksFile -Raw | ConvertFrom-Json
    if (-not $n) { $m.PSObject.Properties | ForEach-Object { "  $E[96m$($_.Name)$E[0m -> $($_.Value)" }; return }
    Set-Location $m.$n
}
function global:.. { Set-Location .. }
function global:... { Set-Location ..\.. }
function global:~ { Set-Location $HOME }

# ---------------------------------------------------------------- dev
Reg 'Dev' 'gs / gl / gd / gp' 'git status / log gràfic / diff / pull'
function global:gs { git status -sb }
function global:gl { git log --oneline --graph --decorate -20 }
function global:gd { git diff @args }
function global:gp { git pull @args }
Reg 'Dev' 'json <fitxer|text>' 'Formata JSON'
function global:json([string]$x) { $t = if (Test-Path $x) { Get-Content $x -Raw } else { $x }; $t | ConvertFrom-Json | ConvertTo-Json -Depth 20 }
Reg 'Dev' 'uuid' 'Genera un UUID'
function global:uuid { [guid]::NewGuid().ToString() }
Reg 'Dev' 'pass [long]' 'Contrasenya aleatòria (copiada)'
function global:pass([int]$len = 20) {
    $chars = [char[]]'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*-_=+?'
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $b = New-Object byte[] $len; $rng.GetBytes($b)
    $p = -join ($b | ForEach-Object { $chars[$_ % $chars.Length] }); Set-Clipboard $p; "$p  $E[90m($(L 'copiada'))$E[0m"
}
Reg 'Dev' 'b64 / unb64 <text>' 'Base64'
function global:b64([string]$t) { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($t)) }
function global:unb64([string]$t) { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($t)) }
Reg 'Dev' 'calc <expressió>' 'Calculadora (sintaxi .NET/PowerShell)'
function global:calc { $x = $args -join ' '; Invoke-Expression ($x -replace '\^', '**' -replace '(\d+(?:\.\d+)?)\s*\*\*\s*(\d+(?:\.\d+)?)', '[math]::Pow($1,$2)') }
Reg 'Dev' 'epoch [n]' 'Timestamp Unix <-> data'
function global:epoch([long]$n = 0) { if ($n) { [DateTimeOffset]::FromUnixTimeSeconds($n).LocalDateTime } else { [DateTimeOffset]::Now.ToUnixTimeSeconds() } }
Reg 'Dev' 'cheat <cmd>' 'Chuleta de qualsevol comanda (cheat.sh)'
function global:cheat([string]$c) { (Invoke-WebRequest "https://cheat.sh/$c" -UserAgent 'curl' -UseBasicParsing).Content }
Reg 'Dev' 'qr <text>' 'Codi QR al terminal'
function global:qr { (Invoke-WebRequest ("https://qrenco.de/" + [uri]::EscapeDataString($args -join ' ')) -UserAgent 'curl' -UseBasicParsing).Content }
Reg 'Dev' 'timer <seg> [msg]' 'Compte enrere amb notificació'
function global:timer([int]$s = 60, [string]$msg = (L 'Temps!')) {
    for ($i = $s; $i -gt 0; $i--) { Write-Host -NoNewline "`r$E[96m  $([TimeSpan]::FromSeconds($i).ToString('mm\:ss'))$E[0m "; Start-Sleep 1 }
    Write-Host "`r$E[92m  $msg      $E[0m"; [Console]::Write([char]7); notify $msg
}
Reg 'Dev' 'edit <fitxer>' 'Obre a VS Code (o Notepad)'
function global:edit([string]$f = '.') { if (Get-Command code -ErrorAction SilentlyContinue) { code $f } else { notepad $f } }

# ---------------------------------------------------------------- fun
Reg 'Diversió' 'matrix' 'Pluja Matrix (qualsevol tecla per sortir)'
function global:matrix {
    $w = $host.UI.RawUI.WindowSize.Width; $h = $host.UI.RawUI.WindowSize.Height
    $drops = @(0) * $w; for ($i = 0; $i -lt $w; $i++) { $drops[$i] = Get-Random -Max $h }
    $chars = [char[]]'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789'
    [Console]::Write("$E[?25l$E[2J")
    try {
        while (-not [Console]::KeyAvailable) {
            $sb = New-Object Text.StringBuilder
            for ($x = 0; $x -lt $w; $x += 2) {
                $y = $drops[$x]
                [void]$sb.Append("$E[$($y + 1);$($x + 1)H$E[97m$($chars | Get-Random)")
                if ($y -gt 0) { [void]$sb.Append("$E[$y;$($x + 1)H$E[32m$($chars | Get-Random)") }
                $t = $y - 12; if ($t -gt 0) { [void]$sb.Append("$E[$t;$($x + 1)H ") }
                $drops[$x] = if ($y -gt $h + 12) { 0 } else { $y + 1 }
            }
            [Console]::Write($sb.ToString()); Start-Sleep -Milliseconds 45
        }
        [void][Console]::ReadKey($true)
    } finally { [Console]::Write("$E[0m$E[2J$E[H$E[?25h") }
}
Reg 'Diversió' 'rainbow <text>' 'Text amb arc de Sant Martí'
function global:rainbow {
    $t = $args -join ' '; $i = 0
    -join ($t.ToCharArray() | ForEach-Object { $h = ($i++ * 12) % 360; $r = [int](127 * [math]::Sin($h * 0.0174) + 128); $g = [int](127 * [math]::Sin(($h + 120) * 0.0174) + 128); $b = [int](127 * [math]::Sin(($h + 240) * 0.0174) + 128); "$E[38;2;$r;$g;${b}m$_" }) + "$E[0m"
}
Reg 'Diversió' 'hack' 'Pantalla de "hacker" de pel·lícula'
function global:hack {
    $words = 'ACCESS', 'DECRYPT', 'BYPASS', 'TRACE', 'FIREWALL', 'NODE', 'KERNEL', 'PROXY', 'UPLINK', 'HANDSHAKE'
    1..40 | ForEach-Object {
        $hex = -join (1..8 | ForEach-Object { '{0:X2}' -f (Get-Random -Max 256) })
        "$E[32m[$(Get-Date -Format HH:mm:ss.fff)]$E[0m $E[92m$($words | Get-Random)$E[0m 0x$hex ... $E[96m$((Get-Random -Max 100))%$E[0m"
        Start-Sleep -Milliseconds (Get-Random -Min 20 -Max 120)
    }
    "$E[1;92m>>> ACCESS GRANTED <<<$E[0m"
}
Reg 'Diversió' 'fortune' 'Frase aleatòria'
function global:fortune {
    @('El codi que no existeix no té bugs.', 'Primer fes-ho funcionar, després fes-ho bonic, després fes-ho ràpid.', 'Hi ha 10 tipus de persones: les que entenen binari i les que no.',
        'Funciona a la meva màquina. -- Tothom', 'Un terminal ben configurat val més que mil clics.', 'La simplicitat és la màxima sofisticació. -- Leonardo da Vinci',
        'Talk is cheap. Show me the code. -- Linus Torvalds', 'Qualsevol tecnologia prou avançada és indistingible de la màgia. -- A. C. Clarke') | Get-Random
}
Reg 'Diversió' 'colors' 'Mostra la paleta de colors del tema'
function global:colors {
    ''; '  ' + (-join (0..7 | ForEach-Object { "$E[4${_}m      " })) + "$E[0m"; '  ' + (-join (0..7 | ForEach-Object { "$E[10${_}m      " })) + "$E[0m"
    '  ' + (-join (0..7 | ForEach-Object { "$E[3${_}m  ab  " })) + "$E[0m"; '  ' + (-join (0..7 | ForEach-Object { "$E[9${_}m  ab  " })) + "$E[0m"; ''
}

# ---------------------------------------------------------------- command not found → how to install it
# Neon makes "winget install ..." lines clickable so they run with one click
$global:NeonInstallHints = @{
    nmap = 'winget install Insecure.Nmap'; git = 'winget install Git.Git'; python = 'winget install Python.Python.3.13'; python3 = 'winget install Python.Python.3.13'
    node = 'winget install OpenJS.NodeJS.LTS'; npm = 'winget install OpenJS.NodeJS.LTS'; code = 'winget install Microsoft.VisualStudioCode'; pwsh = 'winget install Microsoft.PowerShell'
    docker = 'winget install Docker.DockerDesktop'; go = 'winget install GoLang.Go'; cargo = 'winget install Rustlang.Rustup'; rustc = 'winget install Rustlang.Rustup'
    java = 'winget install EclipseAdoptium.Temurin.21.JDK'; gh = 'winget install GitHub.cli'; ffmpeg = 'winget install Gyan.FFmpeg'; '7z' = 'winget install 7zip.7zip'
    wireshark = 'winget install WiresharkFoundation.Wireshark'; hashcat = 'winget install hashcat.hashcat'; openssl = 'winget install ShiningLight.OpenSSL.Light'
    sqlmap = 'pip install sqlmap'; httpie = 'pip install httpie'; http = 'pip install httpie'; yt = 'pip install yt-dlp'; 'yt-dlp' = 'winget install yt-dlp.yt-dlp'
    jq = 'winget install jqlang.jq'; rg = 'winget install BurntSushi.ripgrep.MSVC'; fzf = 'winget install junegunn.fzf'; bat = 'winget install sharkdp.bat'
    fd = 'winget install sharkdp.fd'; lazygit = 'winget install JesseDuffield.lazygit'; btop = 'winget install aristocratos.btop4win'; neofetch = 'winget install Fastfetch-cli.Fastfetch'
    fastfetch = 'winget install Fastfetch-cli.Fastfetch'; vim = 'winget install vim.vim'; nvim = 'winget install Neovim.Neovim'; curlie = 'winget install rs.curlie'
    terraform = 'winget install Hashicorp.Terraform'; kubectl = 'winget install Kubernetes.kubectl'; az = 'winget install Microsoft.AzureCLI'; aws = 'winget install Amazon.AWSCLI'
    ollama = 'winget install Ollama.Ollama'; procmon = 'winget install Microsoft.Sysinternals.ProcessMonitor'; tcpview = 'winget install Microsoft.Sysinternals.TCPView'
    autoruns64 = 'winget install Microsoft.Sysinternals.Autoruns'; ghidra = 'winget install NSA.Ghidra'; burpsuite = 'winget install PortSwigger.BurpSuite.Community'
}
$ExecutionContext.InvokeCommand.CommandNotFoundAction = {
    param($Name, $EventArgs)
    # only when the user types it (not when code looks commands up with Get-Command)
    if ($EventArgs.CommandOrigin -ne 'Runspace' -or $Name -match '[\\/:]' -or $Name -like 'get-*') { return }
    $hint = $global:NeonInstallHints[$Name.ToLower()]
    $e = [char]27
    if ($hint) { Write-Host "`n  $e[93m'$Name' $(L 'no està instal·lat.')$e[0m $(L 'Per instal·lar-lo (clic per executar):')`n  $e[96m$hint$e[0m`n" }
    elseif (Get-Command winget -ErrorAction SilentlyContinue) { Write-Host "`n  $e[90m'$Name' $(L 'no existeix. Per buscar-lo:') $e[96mwinget search $Name$e[0m`n" }
}

# ---------------------------------------------------------------- security and pentest
. (Join-Path $PSScriptRoot 'neon-sec.ps1')

# ---------------------------------------------------------------- server audit and updates
. (Join-Path $PSScriptRoot 'neon-audit.ps1')

# ---------------------------------------------------------------- help
function global:neon([string]$filter = '') {
    ""
    "  $E[1;96mN E O N$E[0m  $E[90m·  $(L 'comandes disponibles')  ·  $(L 'personalitza a ~\.neonrc.ps1')$E[0m"
    foreach ($cat in $script:NeonCommands.Keys) {
        $items = $script:NeonCommands[$cat] | Where-Object { -not $filter -or $_.Name -like "*$filter*" -or $_.Desc -like "*$filter*" -or $cat -like "*$filter*" }
        if (-not $items) { continue }
        ""; "  $E[1;95m$cat$E[0m"
        foreach ($c in $items) { "    $E[96m{0,-28}$E[0m $E[37m{1}$E[0m" -f $c.Name, $c.Desc }
    }
    ""
    "  $E[90m$(L 'Dreceres: Ctrl+Shift+P paleta · Ctrl+, personalitzar · Ctrl+` shell<->Claude · Ctrl+Shift+D/E dividir · Ctrl+R historial')$E[0m"
    ""
}
Set-Alias -Name help-neon -Value neon -Scope Global

# ---------------------------------------------------------------- startup
$rc = Join-Path $HOME '.neonrc.ps1'
if (Test-Path $rc) { . $rc }
# NEON_QUIET: loaded from CMD just to run one command
if ($env:NEON_QUIET) { return }
if ($env:NEON_STARTUP) { foreach ($c in ($env:NEON_STARTUP -split ';')) { if ($c.Trim()) { Invoke-Expression $c } } }

Clear-Host
Write-Host ""
Write-Host "  $E[1;96m" -NoNewline; Write-Host ([char]0x2733) -NoNewline; Write-Host " NEON$E[0m$E[90m  ·  PowerShell $($PSVersionTable.PSVersion.Major).$($PSVersionTable.PSVersion.Minor)  ·  $(L 'escriu') $E[96mneon$E[90m $(L 'per veure les comandes') · $E[96mask$E[90m $(L 'per preguntar a Claude')$E[0m"
