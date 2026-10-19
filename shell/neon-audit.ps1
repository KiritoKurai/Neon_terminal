# ============================================================================
#  NEON TERMINAL — company server audit and software updates
#  Linux servers are audited over SSH, Windows servers over WinRM (PowerShell remoting).
#  Responsible use: only audit servers you administer or are authorized to test.
#  Uses the helpers from neon-sec.ps1 (Title, Warn, IsAdmin, Get-OpenPorts, $Services, $RiskyPorts…)
# ============================================================================

$script:SrvFile = Join-Path $HOME '.neon-servers.json'
$script:AuditDir = Join-Path $HOME 'NeonAudits'
$script:SrvCreds = @{}

# ---------------------------------------------------------------- server inventory
function script:Get-Srvs {
    if (-not (Test-Path -LiteralPath $SrvFile)) { return @() }
    # (PowerShell 5.1's ConvertFrom-Json emits the whole array as one object: foreach unrolls it)
    try { $data = Get-Content -LiteralPath $SrvFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch { Warn "${SrvFile}: $($_.Exception.Message)"; return @() }
    foreach ($x in $data) { if ($x) { $x } }
}
function script:Save-Srvs($List) { ConvertTo-Json -InputObject @($List) -Depth 4 | Set-Content -LiteralPath $SrvFile -Encoding UTF8 }

function script:Test-Port([string]$H, [int]$Port, [int]$Ms = 1500) {
    $c = New-Object Net.Sockets.TcpClient
    try { $c.ConnectAsync($H, $Port).Wait($Ms) -and $c.Connected } catch { $false } finally { $c.Close() }
}
function script:Is-Local([string]$H) { $H -in 'localhost', '.', '127.0.0.1', '::1', $env:COMPUTERNAME }

# A saved server by name, or an ad-hoc one: host, user@host (Linux). The OS is detected from its ports.
function script:Resolve-Srv([string]$Target, [string]$Os = '', [switch]$NoProbe) {
    $s = Get-Srvs | Where-Object { $_.name -eq $Target } | Select-Object -First 1
    if ($s) { return $s }
    $user = ''; $h = $Target
    if ($Target -match '^(.+)@(.+)$') { $user = $Matches[1]; $h = $Matches[2]; if (-not $Os) { $Os = 'linux' } }
    if (-not $Os -and (Is-Local $h)) { $Os = 'windows' }
    if (-not $Os -and -not $NoProbe) { $Os = if (Test-Port $h 5985) { 'windows' } elseif (Test-Port $h 22) { 'linux' } else { '' } }
    [pscustomobject]@{ name = $h; host = $h; os = $Os; user = $user; port = 22; key = '' }
}

Reg 'Auditoria · servidors' 'servers' 'Servidors de l''empresa desats (~\.neon-servers.json)'
function global:servers {
    $list = @(Get-Srvs)
    if (-not $list.Count) { "  $(L 'Encara no hi ha cap servidor. Afegeix-ne un amb:') $E[96msrvadd web01 admin@10.0.0.10$E[0m · $E[96msrvadd dc01 10.0.0.5 -Os windows$E[0m"; return }
    Title 'Servidors'
    foreach ($s in $list) {
        $os = if ($s.os -eq 'windows') { "$E[94mwindows$E[0m" } else { "$E[92mlinux  $E[0m" }
        $addr = "$(if ($s.user) { "$($s.user)@" })$($s.host)$(if ($s.os -ne 'windows' -and $s.port -and [int]$s.port -ne 22) { ":$($s.port)" })"
        "  $E[96m{0,-16}$E[0m {1}  {2}" -f $s.name, $os, $addr
    }
    ""; "  $E[90msrvaudit <$(L 'servidor')> · netaudit <$(L 'servidor')> · srvupdates <$(L 'servidor')> · auditall$E[0m"
}

Reg 'Auditoria · servidors' 'srvadd <nom> <[usuari@]host> [-Os ...]' 'Desa un servidor (detecta el SO pels ports)'
function global:srvadd {
    param([Parameter(Mandatory = $true)][string]$Name, [Parameter(Mandatory = $true)][string]$HostName, [ValidateSet('', 'linux', 'windows')][string]$Os = '',
        [string]$User = '', [int]$Port = 22, [string]$Key = '')
    if ($HostName -match '^(.+)@(.+)$') { $User = $Matches[1]; $HostName = $Matches[2]; if (-not $Os) { $Os = 'linux' } }
    if (-not $Os) {
        $Os = if (Test-Port $HostName 5985) { 'windows' } elseif (Test-Port $HostName $Port) { 'linux' } else { '' }
        if (-not $Os) { Warn 'No he pogut detectar el sistema (ni WinRM 5985 ni SSH obert). Indica -Os linux o -Os windows'; return }
    }
    if ($Key) { $k = Resolve-Path -LiteralPath $Key -ErrorAction SilentlyContinue; if ($k) { $Key = $k.Path } }
    $list = @(Get-Srvs | Where-Object { $_.name -ne $Name })
    $list += [pscustomobject]@{ name = $Name; host = $HostName; os = $Os; user = $User; port = $Port; key = "$Key" }
    Save-Srvs $list
    "  $E[92m✔$E[0m $Name ($Os) $(L 'desat')"
}

Reg 'Auditoria · servidors' 'srvrm <servidor>' 'Treu un servidor de la llista'
function global:srvrm([Parameter(Mandatory = $true)][string]$Target) {
    $list = @(Get-Srvs)
    if (-not ($list | Where-Object { $_.name -eq $Target })) { Warn ((L 'No hi ha cap servidor anomenat {0}') -f $Target); return }
    Save-Srvs @($list | Where-Object { $_.name -ne $Target })
    "  $Target $(L 'tret')"
}

Reg 'Auditoria · servidors' 'srvimport' 'Importa els servidors SSH desats a l''app (com a Linux)'
function global:srvimport {
    $f = Join-Path $env:APPDATA 'Neon Terminal\settings.json'
    try { $hosts = @((Get-Content -LiteralPath $f -Raw -Encoding UTF8 | ConvertFrom-Json).sshHosts) | Where-Object { $_ } } catch { $hosts = @() }
    $list = @(Get-Srvs); $n = 0
    foreach ($h in $hosts) {
        if (-not $h.name -or ($list | Where-Object { $_.name -eq $h.name })) { continue }
        $list += [pscustomobject]@{ name = $h.name; host = $h.host; os = 'linux'; user = "$($h.user)"; port = $(if ($h.port) { [int]$h.port } else { 22 }); key = "$($h.key)" }; $n++
    }
    Save-Srvs $list
    "  $((L '{0} servidors importats') -f $n)"
}

Reg 'Auditoria · servidors' 'srvssh <servidor>' 'Obre una sessió al servidor (SSH o PowerShell remot)'
function global:srvssh([Parameter(Mandatory = $true)][string]$Target) {
    $s = Resolve-Srv $Target
    if ($s.os -eq 'windows') { $p = @{ ComputerName = $s.host }; $c = Get-SrvCred $s; if ($c) { $p.Credential = $c }; Enter-PSSession @p }
    else { & ssh.exe @(Ssh-Args $s) }
}

# server names complete with Tab
$script:SrvCompleter = {
    param($cmd, $param, $word)
    $f = Join-Path $HOME '.neon-servers.json'
    if (Test-Path $f) { foreach ($x in (Get-Content $f -Raw -Encoding UTF8 | ConvertFrom-Json)) { if ($x.name -like "$word*") { [Management.Automation.CompletionResult]::new($x.name) } } }
}
try { Register-ArgumentCompleter -CommandName srvaudit, netaudit, srvupdates, srvupgrade, srvrm, srvssh, srvlynis -ParameterName Target -ScriptBlock $SrvCompleter } catch {}

# ---------------------------------------------------------------- remote execution
function script:Ssh-Args($s, [switch]$Tty) {
    $a = @('-o', 'ConnectTimeout=10')
    if ($Tty) { $a += '-t' }
    if ($s.port -and [int]$s.port -ne 22) { $a += '-p', "$($s.port)" }
    if ($s.key) { $a += '-i', "$($s.key)" }
    $a += $(if ($s.user) { "$($s.user)@$($s.host)" } else { "$($s.host)" })
    $a
}

# Runs a bash script on the server. It travels as base64 inside the command line (no quotes, which
# PowerShell 5.1 mangles) and runs from a temporary file, so stdin stays free for sudo/ssh prompts.
function script:Invoke-SshScript($s, [string]$Script, [switch]$Tty) {
    if (-not (Get-Command ssh.exe -ErrorAction SilentlyContinue)) { Warn 'Falta el client SSH: winget install Microsoft.OpenSSH.Beta'; return }
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($Script -replace "`r", '')))
    $remote = 'f=$(mktemp);echo ' + $b64 + '|base64 -d>$f;bash $f;r=$?;rm -f $f;exit $r'
    & ssh.exe @(Ssh-Args $s -Tty:$Tty) $remote
    if ($LASTEXITCODE -eq 255) { Warn ((L 'No s''ha pogut connectar per SSH a {0}') -f $s.host) }
}

function script:Get-SrvCred($s) {
    if (-not $s.user -or (Is-Local $s.host)) { return $null }
    if (-not $SrvCreds.ContainsKey($s.host)) { $SrvCreds[$s.host] = Get-Credential -UserName $s.user -Message "WinRM · $($s.host)" }
    $SrvCreds[$s.host]
}
function script:WinRmHint { "  $E[90m$(L 'Cal WinRM actiu al servidor (Enable-PSRemoting). Fora de domini:') Set-Item WSMan:\localhost\Client\TrustedHosts <host> -Concatenate$E[0m" }
function script:New-WinSession($s) {
    $p = @{ ComputerName = $s.host; ErrorAction = 'Stop' }
    $c = Get-SrvCred $s; if ($c) { $p.Credential = $c }
    try { New-PSSession @p } catch { Warn "WinRM: $($_.Exception.Message)"; WinRmHint; $null }
}
# Runs a script block on a Windows server (or right here if it's this PC)
function script:Invoke-Win($s, [scriptblock]$Block, [object[]]$ArgList = @()) {
    if (Is-Local $s.host) { return & $Block @ArgList }
    $ps = New-WinSession $s
    if (-not $ps) { return }
    try { Invoke-Command -Session $ps -ScriptBlock $Block -ArgumentList $ArgList } catch { Warn "WinRM: $($_.Exception.Message)" } finally { Remove-PSSession $ps }
}

# ---------------------------------------------------------------- scoring and output
$script:AuditScore = @{ ok = 0; warn = 0; bad = 0 }
$script:LastScore = $null
function script:Start-Score { $script:AuditScore = @{ ok = 0; warn = 0; bad = 0 } }
function script:AChk([string]$State, [string]$Name, [string]$Detail = '') {
    $sym = @{ ok = "$E[92m✔"; warn = "$E[93m!"; bad = "$E[91m✘"; info = "$E[96m·" }[$State]
    if (-not $sym) { $sym = "$E[90m·" }
    "  $sym$E[0m {0,-42} $E[90m{1}$E[0m" -f (L $Name), (L $Detail)
    if ($AuditScore.ContainsKey($State)) { $AuditScore[$State]++ }
}
function script:End-Score {
    $total = $AuditScore.ok + $AuditScore.warn + $AuditScore.bad
    if (-not $total) { $script:LastScore = $null; return }
    $pct = [int](100 * ($AuditScore.ok + $AuditScore.warn * 0.5) / $total)
    $script:LastScore = $pct
    $col = if ($pct -ge 80) { 92 } elseif ($pct -ge 60) { 93 } else { 91 }
    ""; "  $E[1;${col}m$(L 'Puntuació'): $pct/100$E[0m   $E[92m$($AuditScore.ok) $(L 'correctes')$E[0m · $E[93m$($AuditScore.warn) $(L 'avisos')$E[0m · $E[91m$($AuditScore.bad) $(L 'problemes')$E[0m"
}

# Lines from the server scripts: C|state|name|detail (check) · I|name|detail (info) · O|proto|port (listening port)
function script:Show-AuditLines($Lines) {
    $ports = @()
    foreach ($l in @($Lines)) {
        $p = "$l" -split '\|', 4
        switch ($p[0]) {
            'C' { AChk $p[1] $p[2] $p[3] }
            'I' { "  $E[96m·$E[0m {0,-42} $E[90m{1}$E[0m" -f (L $p[1]), (L (($p[2..3] | Where-Object { $_ -ne $null }) -join '|')) }
            'O' { $ports += [int]$p[2] }
            default { if ("$l".Trim()) { "  $E[90m$l$E[0m" } }
        }
    }
    if ($ports) {
        $ports = $ports | Sort-Object -Unique
        "  $E[96m·$E[0m {0,-42} $E[90m{1}$E[0m" -f (L 'Ports en escolta (xarxa)'), (($ports | ForEach-Object { if ($Services.ContainsKey($_)) { "$_/$($Services[$_])" } else { "$_" } }) -join ' ')
        $risky = $ports | Where-Object { $RiskyPorts -contains $_ }
        AChk $(if ($risky) { 'warn' } else { 'ok' }) 'Ports sensibles exposats a la xarxa' $(if ($risky) { ($risky | ForEach-Object { "$_/$($Services[$_])" }) -join ', ' } else { 'cap' })
    }
}

function script:Save-Report([string]$File, $Lines) {
    New-Item -ItemType Directory -Force (Split-Path $File) | Out-Null
    @($Lines) | ForEach-Object { "$_" -replace "$([char]27)\[[0-9;?]*[A-Za-z]", '' } | Set-Content -LiteralPath $File -Encoding UTF8
}

# ---------------------------------------------------------------- Linux (bash over SSH)
# MODE=audit → checks · MODE=updates → pending packages (P|name|from|to|sec)
$script:LinuxScript = @'
export LC_ALL=C
if [ "$(id -u)" = 0 ]; then S=; ROOT=1; elif sudo -n true 2>/dev/null; then S="sudo -n"; ROOT=1; else S=; ROOT=0; fi
c(){ printf 'C|%s|%s|%s\n' "$1" "$2" "$3"; }
i(){ printf 'I|%s|%s\n' "$1" "$2"; }
has(){ command -v "$1" >/dev/null 2>&1; }
[ -r /etc/os-release ] && . /etc/os-release
PM=; for p in apt-get dnf yum zypper apk pacman; do has $p && { PM=$p; break; }; done

pkgs(){
  case $PM in
    apt-get) [ $ROOT = 1 ] && $S apt-get update -qq >/dev/null 2>&1
      apt list --upgradable 2>/dev/null | awk -F'[/ ]' '/upgradable/{v=$NF; sub(/\]$/,"",v); s=($2 ~ /security/)?"sec":""; print "P|"$1"|"v"|"$3"|"s}' ;;
    dnf|yum)
      if [ $PM = yum ]; then SL=$(yum -q updateinfo list security 2>/dev/null); else SL=$(dnf -q updateinfo list --security 2>/dev/null); fi
      SN=$(printf '%s\n' "$SL" | awk 'NF>=3{print $3}' | sed -E 's/-[^-]+-[^-]+$//' | sort -u)
      $PM -q check-update 2>/dev/null | awk -v sec="$SN" 'BEGIN{n=split(sec,a,"\n"); for(k=1;k<=n;k++) S[a[k]]=1} NF==3 && $1 ~ /\./ {p=$1; sub(/\.[^.]+$/,"",p); print "P|"p"||"$2"|"((p in S)?"sec":"")}' ;;
    zypper) zypper -q lu 2>/dev/null | awk -F'|' '/^v /{for(k=3;k<=5;k++) gsub(/ /,"",$k); print "P|"$3"|"$4"|"$5"|"}' ;;
    apk) apk -u list 2>/dev/null | sed -n 's/^\([^ ]*\) .*upgradable from: \([^]]*\)\]/P|\1|\2||/p' ;;
    pacman) has checkupdates && checkupdates 2>/dev/null | awk '{print "P|"$1"|"$2"|"$4"|"}' ;;
  esac
}
reboot_needed(){
  [ -f /var/run/reboot-required ] && return 0
  has needs-restarting && needs-restarting -r 2>/dev/null | grep -qi 'reboot is required' && return 0
  return 1
}

if [ "$MODE" = updates ]; then
  i 'Gestor de paquets' "${PM:-?}"
  pkgs
  reboot_needed && c warn 'Reinici pendent' 'sí'
  exit 0
fi

i 'Sistema' "${PRETTY_NAME:-$(uname -s)} · kernel $(uname -r)"
i 'Encès' "$(uptime -p 2>/dev/null | sed 's/^up //')"
[ $ROOT = 1 ] || c warn 'Privilegis' "sense sudo sense contrasenya: algunes comprovacions s'ometen"

# updates
P=$(pkgs); N=$(printf '%s\n' "$P" | grep -c '^P|'); SN=$(printf '%s\n' "$P" | grep -c '|sec$')
if [ -z "$PM" ]; then c info 'Actualitzacions pendents' 'gestor de paquets desconegut'
elif [ "$SN" -gt 0 ]; then c bad 'Actualitzacions pendents' "$N ($SN de seguretat)"
elif [ "$N" -gt 0 ]; then c warn 'Actualitzacions pendents' "$N"
else c ok 'Actualitzacions pendents' "0 ($PM)"; fi
if reboot_needed; then c warn 'Reinici pendent' 'sí (kernel o llibreries noves)'; else c ok 'Reinici pendent' 'no'; fi
AU=no
grep -qs 'Unattended-Upgrade "1"' /etc/apt/apt.conf.d/20auto-upgrades && AU=yes
if has systemctl; then for t in dnf-automatic.timer dnf-automatic-install.timer dnf5-automatic.timer yum-cron.service; do systemctl is-enabled "$t" >/dev/null 2>&1 && AU=yes; done; fi
[ $AU = yes ] && c ok 'Actualitzacions automàtiques' 'activades' || c warn 'Actualitzacions automàtiques' 'no configurades'

# SSH
if [ -f /etc/ssh/sshd_config ]; then
  CFG=$($S sshd -T 2>/dev/null)
  [ -z "$CFG" ] && CFG=$(cat /etc/ssh/sshd_config.d/*.conf /etc/ssh/sshd_config 2>/dev/null | grep -Ev '^[[:space:]]*(#|$)')
  get(){ printf '%s\n' "$CFG" | awk -v k="$1" 'tolower($1)==k{print tolower($2); exit}'; }
  PRL=$(get permitrootlogin); PA=$(get passwordauthentication); X11=$(get x11forwarding); MAT=$(get maxauthtries)
  case "$PRL" in yes) c bad 'SSH: login de root' 'permès amb contrasenya';; *) c ok 'SSH: login de root' "${PRL:-prohibit-password}";; esac
  [ "$PA" = no ] && c ok 'SSH: autenticació amb contrasenya' 'desactivada (només claus)' || c warn 'SSH: autenticació amb contrasenya' 'permesa (millor només claus)'
  [ "$X11" = yes ] && c warn 'SSH: reenviament X11' 'activat' || c ok 'SSH: reenviament X11' 'desactivat'
  [ "${MAT:-6}" -gt 6 ] 2>/dev/null && c warn "SSH: intents d'autenticació" "$MAT" || c ok "SSH: intents d'autenticació" "${MAT:-6}"
  i 'OpenSSH' "$(ssh -V 2>&1 | head -1)"
fi

# firewall
FW=
if has ufw && $S ufw status 2>/dev/null | grep -q 'Status: active'; then FW=ufw
elif has firewall-cmd && firewall-cmd --state 2>/dev/null | grep -q running; then FW=firewalld
elif has nft && [ "$($S nft list ruleset 2>/dev/null | grep -c 'hook input')" -gt 0 ]; then FW=nftables
elif has iptables && $S iptables -S INPUT 2>/dev/null | grep -Eq '^-A|^-P INPUT (DROP|REJECT)'; then FW=iptables
fi
if [ -n "$FW" ]; then c ok 'Tallafocs' "$FW"; elif [ $ROOT = 1 ]; then c bad 'Tallafocs' 'cap tallafocs actiu'; else c warn 'Tallafocs' 'no detectat (sense sudo)'; fi

# accounts
U0=$(awk -F: '$3==0 && $1!="root"{printf "%s ",$1}' /etc/passwd)
[ -n "$U0" ] && c bad 'Comptes amb UID 0 (a part de root)' "$U0" || c ok 'Comptes amb UID 0 (a part de root)' 'cap'
SP=$(stat -c %a /etc/shadow 2>/dev/null)
case "$SP" in *[1-7]) c bad 'Permisos de /etc/shadow' "$SP (llegible per tothom)";; '') ;; *) c ok 'Permisos de /etc/shadow' "$SP";; esac
if [ $ROOT = 1 ]; then
  EP=$($S awk -F: '($2==""){printf "%s ",$1}' /etc/shadow 2>/dev/null)
  [ -n "$EP" ] && c bad 'Comptes sense contrasenya' "$EP" || c ok 'Comptes sense contrasenya' 'cap'
  NP=$($S grep -rhsE '^[^#].*NOPASSWD' /etc/sudoers /etc/sudoers.d 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ')
  [ -n "$NP" ] && c warn 'sudo sense contrasenya (NOPASSWD)' "$NP" || c ok 'sudo sense contrasenya (NOPASSWD)' 'cap'
  WW=$($S find /etc -xdev -type f -perm -0002 2>/dev/null | head -5 | tr '\n' ' ')
  [ -n "$WW" ] && c bad 'Fitxers de /etc escrivibles per tothom' "$WW" || c ok 'Fitxers de /etc escrivibles per tothom' 'cap'
fi
i 'Usuaris amb shell' "$(awk -F: '$7 !~ /(nologin|false|sync|shutdown|halt)$/{printf "%s ",$1}' /etc/passwd)"

# hardening
if has systemctl; then
  if systemctl is-active --quiet fail2ban || systemctl is-active --quiet crowdsec; then c ok 'Protecció contra força bruta' 'fail2ban / crowdsec actiu'; else c warn 'Protecció contra força bruta' 'ni fail2ban ni crowdsec'; fi
fi
if has getenforce; then M=$(getenforce); [ "$M" = Enforcing ] && c ok 'SELinux / AppArmor' "SELinux $M" || c warn 'SELinux / AppArmor' "SELinux $M"
elif [ -d /sys/kernel/security/apparmor ]; then c ok 'SELinux / AppArmor' 'AppArmor'
else c info 'SELinux / AppArmor' 'no detectat'; fi
if has timedatectl; then T=$(timedatectl show -p NTPSynchronized --value 2>/dev/null); [ "$T" = yes ] && c ok 'Hora sincronitzada (NTP)' 'sí' || c warn 'Hora sincronitzada (NTP)' "${T:-?}"; fi
DU=$(df -P / | awk 'NR==2{gsub(/%/,"",$5);print $5}')
[ "${DU:-0}" -ge 90 ] && c warn 'Disc /' "$DU% ple" || c ok 'Disc /' "$DU%"
if [ $ROOT = 1 ] && has journalctl; then
  F=$($S journalctl -q --since '24 hours ago' -t sshd -t sshd-session 2>/dev/null | grep -cE 'Failed password|Invalid user')
  [ "${F:-0}" -ge 100 ] && c warn 'Inicis de sessió SSH fallits (24 h)' "$F (força bruta?)" || c ok 'Inicis de sessió SSH fallits (24 h)' "${F:-0}"
fi
has docker && i 'Docker' "$($S docker ps -q 2>/dev/null | wc -l) contenidors en marxa"

# listening ports on the network (not loopback)
if has ss; then
  ss -tuln 2>/dev/null | awk 'NR>1{print $1" "$5}' | grep -vE ' (127\.|\[?::1\]?:|localhost)' | sed -E 's/^([a-z]+) .*:([0-9]+)$/O|\1|\2/' | grep '^O|' | sort -u
fi
exit 0
'@

# ---------------------------------------------------------------- Windows (over WinRM)
# Returns the same C|/I|/O| lines as the Linux script
$script:WinAuditBlock = {
    $r = New-Object System.Collections.Generic.List[string]
    function C($s, $n, $d = '') { $r.Add("C|$s|$n|$d") }
    function I($n, $d) { $r.Add("I|$n|$d") }
    $os = Get-CimInstance Win32_OperatingSystem
    I 'Sistema' "$($os.Caption) · build $($os.BuildNumber)"
    $up = (Get-Date) - $os.LastBootUpTime; I 'Encès' ('{0}d {1}h' -f $up.Days, $up.Hours)
    $adm = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $adm) { C warn 'Privilegis' 'sense administrador: algunes comprovacions s''ometen' }
    # updates
    try {
        $res = (New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher().Search("IsInstalled=0 and IsHidden=0 and Type='Software'")
        $n = $res.Updates.Count; $crit = @($res.Updates | Where-Object { $_.MsrcSeverity -in 'Critical', 'Important' }).Count
        C $(if ($crit) { 'bad' } elseif ($n) { 'warn' } else { 'ok' }) 'Actualitzacions pendents' $(if ($crit) { "$n ($crit crítiques/importants)" } else { "$n" })
    } catch { C info 'Actualitzacions pendents' "no s'ha pogut consultar" }
    $hf = Get-HotFix -ErrorAction SilentlyContinue | Where-Object InstalledOn | Sort-Object InstalledOn -Descending | Select-Object -First 1
    if ($hf) { $d = [int]((Get-Date) - $hf.InstalledOn).TotalDays; C $(if ($d -le 40) { 'ok' } else { 'warn' }) 'Última actualització de Windows' "fa $d dies ($($hf.HotFixID))" }
    $rb = (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired') -or (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending')
    C $(if ($rb) { 'warn' } else { 'ok' }) 'Reinici pendent' $(if ($rb) { 'sí' } else { 'no' })
    $au = Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' -ErrorAction SilentlyContinue
    if ($au.NoAutoUpdate -eq 1) { C warn 'Actualitzacions automàtiques' 'desactivades per política' } else { C ok 'Actualitzacions automàtiques' 'activades' }
    # firewall and antivirus
    try { foreach ($p in Get-NetFirewallProfile -ErrorAction Stop) { C $(if ($p.Enabled) { 'ok' } else { 'bad' }) "Tallafocs ($($p.Name))" $(if ($p.Enabled) { 'actiu' } else { 'DESACTIVAT' }) } } catch {}
    try {
        $mp = Get-MpComputerStatus -ErrorAction Stop
        C $(if ($mp.RealTimeProtectionEnabled) { 'ok' } else { 'bad' }) 'Defender: protecció en temps real' $(if ($mp.RealTimeProtectionEnabled) { 'activa' } else { 'DESACTIVADA' })
        C $(if ($mp.AntivirusSignatureAge -le 3) { 'ok' } else { 'warn' }) 'Defender: signatures' "fa $($mp.AntivirusSignatureAge) dies"
    } catch { C info 'Antivirus' 'Defender no disponible (revisa l''antivirus del servidor)' }
    # SMB, RDP, NTLM, TLS
    try {
        $smb = Get-SmbServerConfiguration -ErrorAction Stop
        C $(if ($smb.EnableSMB1Protocol) { 'bad' } else { 'ok' }) 'SMBv1 (WannaCry/EternalBlue)' $(if ($smb.EnableSMB1Protocol) { 'ACTIVAT' } else { 'desactivat' })
        C $(if ($smb.RequireSecuritySignature) { 'ok' } else { 'warn' }) 'Signatura SMB obligatòria' $(if ($smb.RequireSecuritySignature) { 'sí' } else { 'no (NTLM relay possible)' })
    } catch {}
    $rdp = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server' -ErrorAction SilentlyContinue).fDenyTSConnections
    $nla = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -ErrorAction SilentlyContinue).UserAuthentication
    C $(if ($rdp -eq 1) { 'ok' } elseif ($nla -eq 1) { 'ok' } else { 'bad' }) 'Escriptori remot (RDP)' $(if ($rdp -eq 1) { 'desactivat' } elseif ($nla -eq 1) { 'activat amb NLA' } else { 'activat SENSE NLA' })
    $lsa = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa' -ErrorAction SilentlyContinue
    $lm = $lsa.LmCompatibilityLevel
    C $(if ($null -ne $lm -and $lm -lt 3) { 'bad' } else { 'ok' }) 'NTLMv1 / LM' $(if ($null -ne $lm -and $lm -lt 3) { "permès (LmCompatibilityLevel=$lm)" } else { 'desactivat' })
    C $(if ($lsa.RunAsPPL -ge 1) { 'ok' } else { 'warn' }) 'Protecció LSA (RunAsPPL)' $(if ($lsa.RunAsPPL -ge 1) { 'activa' } else { 'inactiva' })
    $wd = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest' -ErrorAction SilentlyContinue).UseLogonCredential
    C $(if ($wd -eq 1) { 'bad' } else { 'ok' }) 'WDigest (contrasenyes en clar)' $(if ($wd -eq 1) { 'ACTIVAT' } else { 'desactivat' })
    $old = @()
    foreach ($v in 'SSL 3.0', 'TLS 1.0', 'TLS 1.1') {
        $k = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\$v\Server" -ErrorAction SilentlyContinue
        # without an explicit value, TLS 1.0/1.1 are only off by default from build 26100 (Server 2025)
        $on = if ($k -and $null -ne $k.Enabled) { $k.Enabled -ne 0 } else { $v -ne 'SSL 3.0' -and [int]$os.BuildNumber -lt 26100 }
        if ($on) { $old += $v }
    }
    C $(if ($old) { 'warn' } else { 'ok' }) 'Protocols TLS antics (servidor)' $(if ($old) { $old -join ', ' } else { 'desactivats' })
    # accounts
    $guest = Get-LocalUser -ErrorAction SilentlyContinue | Where-Object { $_.SID -like '*-501' }
    if ($guest) { C $(if ($guest.Enabled) { 'bad' } else { 'ok' }) 'Compte de convidat' $(if ($guest.Enabled) { 'ACTIVAT' } else { 'desactivat' }) }
    $admins = @(Get-LocalGroupMember -SID 'S-1-5-32-544' -ErrorAction SilentlyContinue)
    if ($admins.Count) { C $(if ($admins.Count -le 3) { 'ok' } else { 'warn' }) 'Administradors locals' (($admins.Name | ForEach-Object { $_ -replace '^.*\\', '' }) -join ', ') }
    if ($adm) {
        try {
            $f = [IO.Path]::GetTempFileName()
            secedit /export /cfg $f /areas SECURITYPOLICY | Out-Null
            $cfg = Get-Content $f; Remove-Item $f -ErrorAction SilentlyContinue
            $min = [int](($cfg | Select-String '^MinimumPasswordLength\s*=\s*(\d+)').Matches[0].Groups[1].Value)
            $lock = [int](($cfg | Select-String '^LockoutBadCount\s*=\s*(\d+)').Matches[0].Groups[1].Value)
            C $(if ($min -ge 12) { 'ok' } elseif ($min -ge 8) { 'warn' } else { 'bad' }) 'Longitud mínima de contrasenya' "$min"
            C $(if ($lock -gt 0 -and $lock -le 10) { 'ok' } else { 'warn' }) 'Bloqueig per intents fallits' $(if ($lock) { "$lock" } else { 'desactivat' })
        } catch {}
        try { $n = @(Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = 4625; StartTime = (Get-Date).AddDays(-1) } -MaxEvents 5000 -ErrorAction Stop).Count } catch { $n = 0 }
        C $(if ($n -ge 100) { 'warn' } else { 'ok' }) 'Inicis de sessió fallits (24 h)' "$n"
    }
    $sp = Get-Service Spooler -ErrorAction SilentlyContinue
    if ($sp) { C $(if ($sp.Status -eq 'Running') { 'warn' } else { 'ok' }) 'Cua d''impressió (PrintNightmare)' "$($sp.Status)" }
    $sh = @(Get-SmbShare -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch '\$$' } | ForEach-Object Name)
    if ($sh.Count) { I 'Carpetes compartides' ($sh -join ', ') }
    Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -in '0.0.0.0', '::' } | Select-Object -ExpandProperty LocalPort -Unique | ForEach-Object { $r.Add("O|tcp|$_") }
    $r
}

# Pending Windows updates as objects
$script:WinUpdBlock = {
    try {
        $res = (New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher().Search("IsInstalled=0 and IsHidden=0 and Type='Software'")
        foreach ($u in $res.Updates) { [pscustomobject]@{ Title = $u.Title; Sev = "$($u.MsrcSeverity)"; MB = [int]($u.MaxDownloadSize / 1MB) } }
    } catch { [pscustomobject]@{ Error = $_.Exception.Message } }
}

# Installs Windows updates. Run here (admin) or on a server as SYSTEM through a scheduled task
# (Windows Update doesn't allow installing over WinRM); it logs to a file that is read while it runs.
$script:WinInstallScript = @'
$log = Join-Path $env:SystemRoot 'Temp\neon-wu.log'
function W([string]$t) { $l = "$(Get-Date -Format HH:mm:ss)  $t"; $l; try { Add-Content -LiteralPath $log -Value $l -Encoding UTF8 } catch {} }
try {
    $session = New-Object -ComObject Microsoft.Update.Session
    W 'Searching for updates...'
    $res = $session.CreateUpdateSearcher().Search("IsInstalled=0 and IsHidden=0 and Type='Software'")
    $todo = New-Object -ComObject Microsoft.Update.UpdateColl
    # Security Updates / Critical Updates categories
    $secCats = '0fa1201d-4330-4fa8-8ae9-b877473b6441', 'e6cf1350-c01b-414d-a61f-263d14d133b4'
    foreach ($u in $res.Updates) {
        $isSec = $u.MsrcSeverity -in 'Critical', 'Important' -or @($u.Categories | Where-Object { $secCats -contains $_.CategoryID }).Count
        if ($OnlySec -and -not $isSec) { continue }
        if (-not $u.EulaAccepted) { $u.AcceptEula() }
        [void]$todo.Add($u); W "  + $($u.Title)"
    }
    if ($todo.Count -eq 0) { W 'Nothing to install' }
    else {
        W "Downloading $($todo.Count)..."
        $dl = $session.CreateUpdateDownloader(); $dl.Updates = $todo; [void]$dl.Download()
        W 'Installing...'
        $in = $session.CreateUpdateInstaller(); $in.Updates = $todo; $r = $in.Install()
        W "Result: $(@{ 2 = 'OK'; 3 = 'OK with errors'; 4 = 'FAILED'; 5 = 'aborted' }[[int]$r.ResultCode])"
        if ($r.RebootRequired) { W 'REBOOT REQUIRED' }
    }
} catch { W "ERROR: $($_.Exception.Message)" }
W 'DONE'
'@

# ---------------------------------------------------------------- audit commands
Reg 'Auditoria · servidors' 'srvaudit <servidor>' 'Auditoria de seguretat d''un servidor (Linux per SSH, Windows per WinRM)'
function global:srvaudit([Parameter(Mandatory = $true)][string]$Target, [ValidateSet('', 'linux', 'windows')][string]$Os = '') {
    $s = Resolve-Srv $Target $Os
    Title "$(L 'Auditoria') · $($s.name) ($($s.host))"
    Start-Score
    switch ($s.os) {
        'linux' { Show-AuditLines (Invoke-SshScript $s ("MODE=audit`n" + $LinuxScript)) }
        'windows' { Show-AuditLines (Invoke-Win $s $WinAuditBlock) }
        default { Warn 'No sé quin sistema té: afegeix -Os linux o -Os windows'; return }
    }
    End-Score
}

Reg 'Auditoria · servidors' 'netaudit <servidor> [ports] [-Deep]' 'Auditoria des de la xarxa: ports, TLS, serveis oberts sense contrasenya (-Deep: nmap)'
function global:netaudit {
    param([Parameter(Mandatory = $true)][string]$Target, [object]$Ports = 'top', [switch]$Deep)
    $h = (Resolve-Srv $Target -NoProbe).host
    try { $ip = ([Net.Dns]::GetHostAddresses($h) | Where-Object AddressFamily -eq 'InterNetwork' | Select-Object -First 1).IPAddressToString } catch { $ip = $null }
    if (-not $ip) { Warn ((L 'No puc resoldre {0}') -f $h); return }
    Title "$(L 'Auditoria de xarxa') · $h ($ip)"
    "  $E[90m$(L 'només sistemes propis o autoritzats')$E[0m"
    $open = @(Get-OpenPorts $ip (Expand-Ports ((@($Ports) | ForEach-Object { "$_" }) -join ',')) 900)
    Start-Score
    "  $E[96m·$E[0m {0,-42} $E[90m{1}$E[0m" -f (L 'Ports oberts'), $(if ($open) { ($open | ForEach-Object { if ($Services.ContainsKey($_)) { "$_/$($Services[$_])" } else { "$_" } }) -join ' ' } else { L 'cap' })
    foreach ($p in $open) {
        switch ($p) {
            23 { AChk bad 'Telnet exposat' 'sense xifrar: desactiva''l' }
            21 {
                $t = Tcp-Talk $ip 21 @("USER anonymous`r`n", "PASS audit@example.com`r`n") 2500
                if ($t -match '(?m)^230') { AChk bad 'FTP anònim' 'permès' } else { AChk warn 'FTP exposat' 'sense xifrar: millor SFTP' }
            }
            22 {
                $b = (Tcp-Talk $ip 22 @() 2000) -split "`r?`n" | Where-Object { $_ -like 'SSH-*' } | Select-Object -First 1
                if ($b -match 'OpenSSH_(\d+)\.(\d+)') { AChk $(if ([int]$Matches[1] -lt 8) { 'warn' } else { 'info' }) 'Versió SSH' "$b" } elseif ($b) { AChk info 'Versió SSH' "$b" }
            }
            445 { AChk warn 'SMB exposat a la xarxa' 'limita-ho a la LAN / VPN' }
            3389 { AChk warn 'Escriptori remot exposat' 'limita-ho a la VPN' }
            5900 { AChk warn 'VNC exposat' '' }
            5985 { AChk warn 'WinRM sense HTTPS' '5985/http' }
            6379 { $t = Tcp-Talk $ip 6379 @("PING`r`n") 2000; if ($t -match '\+PONG') { AChk bad 'Redis sense contrasenya' 'PING respon sense autenticació' } else { AChk warn 'Base de dades exposada' 'redis' } }
            9200 { $r = Http-Get "http://${ip}:9200/"; if ($r -and $r.Status -eq 200 -and $r.Body -match 'cluster_name') { AChk bad 'Elasticsearch sense autenticació' "http://${h}:9200" } else { AChk warn 'Base de dades exposada' 'elasticsearch' } }
            2375 { $r = Http-Get "http://${ip}:2375/version"; if ($r -and $r.Status -eq 200) { AChk bad 'API de Docker sense TLS' 'control total del servidor' } else { AChk warn 'API de Docker exposada' '2375' } }
            11211 { $t = Tcp-Talk $ip 11211 @("stats`r`n") 2000; if ($t -match 'STAT ') { AChk bad 'Memcached obert' 'sense autenticació' } else { AChk warn 'Base de dades exposada' 'memcached' } }
            { $_ -in 1433, 1521, 3306, 5432, 27017 } { AChk warn 'Base de dades exposada' "$($Services[$p]) ($p)" }
        }
    }
    if (-not ($AuditScore.warn + $AuditScore.bad)) { AChk ok 'Serveis de risc exposats' 'cap' }
    # TLS on implicit-TLS ports
    foreach ($p in $open | Where-Object { $_ -in 443, 8443, 465, 636, 993, 995, 5986 }) {
        $t = Get-TlsInfo $h $p
        if (-not $t) { continue }
        $state = if ($t.Days -lt 0 -or -not $t.NameOk) { 'bad' } elseif ($t.Days -lt 21 -or -not $t.Trusted) { 'warn' } else { 'ok' }
        $why = @("$($t.Proto)", $(if ($t.Days -lt 0) { L 'CADUCAT' } else { (L 'caduca en {0} dies') -f $t.Days }))
        if (-not $t.Trusted) { $why += (L 'NO confiable') }
        if (-not $t.NameOk) { $why += (L 'nom no coincideix') }
        AChk $state "$(L 'Certificat TLS') ($p)" ($why -join ' · ')
        $weak = @(foreach ($pr in 'Tls', 'Tls11') { if (Get-TlsInfo $h $p ([Security.Authentication.SslProtocols]$pr)) { $pr -replace 'Tls11', 'TLS 1.1' -replace '^Tls$', 'TLS 1.0' } })
        if ($weak) { AChk warn "$(L 'TLS antic acceptat') ($p)" ($weak -join ', ') }
    }
    # web
    if ($open -contains 80) {
        $r = Http-Get "http://$h/"
        if ($r) { AChk $(if ($r.Status -in 301, 302, 307, 308 -and $r.Location -like 'https://*') { 'ok' } else { 'warn' }) 'HTTP → HTTPS' $(if ($r.Location) { "$($r.Status) → $($r.Location)" } else { "$($r.Status) $(L 'sense redirecció')" }) }
    }
    if ($open -contains 443) {
        $r = Http-Get "https://$h/"
        if ($r) {
            $want = 'Strict-Transport-Security', 'Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy'
            $miss = @($want | Where-Object { -not $r.Headers[$_] })
            AChk $(if ($miss.Count -eq 0) { 'ok' } elseif ($miss.Count -le 2) { 'warn' } else { 'bad' }) 'Capçaleres de seguretat HTTP' $(if ($miss) { "$(L 'falten'): $($miss -join ', ')" } else { "$($want.Count)/$($want.Count)" })
            $leak = @('Server', 'X-Powered-By', 'X-AspNet-Version' | Where-Object { $r.Headers[$_] -match '\d' } | ForEach-Object { "$_`: $($r.Headers[$_])" })
            if ($leak) { AChk warn 'El servidor revela versions' ($leak -join ' · ') }
        }
    }
    End-Score
    if ($Deep) {
        if (-not (Get-Command nmap -ErrorAction SilentlyContinue)) { Warn 'Per a l''anàlisi profunda cal nmap:'; "  winget install Insecure.Nmap"; return }
        if (-not $open) { return }
        Title 'nmap -sV --script vuln'
        & nmap -sV -Pn --script vuln -p ($open -join ',') $h
    }
}

Reg 'Auditoria · servidors' 'srvlynis <servidor>' 'Auditoria completa amb Lynis al servidor Linux'
function global:srvlynis([Parameter(Mandatory = $true)][string]$Target) {
    $s = Resolve-Srv $Target 'linux'
    Invoke-SshScript $s -Tty @'
if command -v lynis >/dev/null 2>&1; then sudo lynis audit system --quick --no-colors | grep -vE '^\s*$'
else
  echo "Lynis is not installed on $(hostname). Install it with one of:"
  echo "  sudo apt-get install -y lynis   ·   sudo dnf install -y lynis   ·   sudo zypper install -y lynis"
fi
'@
}

Reg 'Auditoria · servidors' 'auditall [-Net]' 'Audita tots els servidors i desa els informes a ~\NeonAudits'
function global:auditall([switch]$Net) {
    $list = @(Get-Srvs)
    if (-not $list.Count) { servers; return }
    $dir = Join-Path $AuditDir (Get-Date -Format 'yyyy-MM-dd_HHmm')
    $summary = @()
    foreach ($s in $list) {
        $lines = @()
        srvaudit $s.name | Tee-Object -Variable lines
        $score = $LastScore
        if ($Net) { $more = @(); netaudit $s.name | Tee-Object -Variable more; $lines = @($lines) + @($more) }
        Save-Report (Join-Path $dir "$($s.name).txt") $lines
        $summary += [pscustomobject]@{ Name = $s.name; Score = $score }
    }
    Title 'Resum'
    foreach ($x in $summary) {
        $col = if ($null -eq $x.Score) { 90 } elseif ($x.Score -ge 80) { 92 } elseif ($x.Score -ge 60) { 93 } else { 91 }
        "  {0,-20} $E[${col}m{1}$E[0m" -f $x.Name, $(if ($null -eq $x.Score) { L 'sense connexió' } else { "$($x.Score)/100" })
    }
    ""; "  $(L 'Informes desats a') $E[96m$dir$E[0m   $E[90m(pv `"$dir`")$E[0m"
}

Reg 'Auditoria · servidors' 'report <comanda...>' 'Executa una comanda i en desa la sortida a ~\NeonAudits'
function global:report {
    if (-not $args) { "  $(L 'Ús'): report srvaudit web01 · report netaudit 10.0.0.5 -Deep"; return }
    $cmd = $args -join ' '
    $f = Join-Path $AuditDir ('{0}_{1}.txt' -f (Get-Date -Format 'yyyy-MM-dd_HHmm'), (($cmd -replace '[^\w.-]+', '_').Trim('_')))
    $lines = @()
    Invoke-Expression $cmd | Tee-Object -Variable lines
    Save-Report $f $lines
    ""; "  $(L 'Informe desat:') $E[96m$f$E[0m"
}

# ---------------------------------------------------------------- network helpers
function script:Tcp-Talk([string]$H, [int]$Port, [string[]]$Send, [int]$Ms = 2000) {
    $c = New-Object Net.Sockets.TcpClient
    try {
        if (-not $c.ConnectAsync($H, $Port).Wait($Ms)) { return '' }
        $st = $c.GetStream(); $st.ReadTimeout = $Ms; $buf = New-Object byte[] 4096; $out = ''
        $read = { Start-Sleep -Milliseconds 400; $t = ''; while ($st.DataAvailable) { $n = $st.Read($buf, 0, $buf.Length); $t += [Text.Encoding]::ASCII.GetString($buf, 0, $n) }; $t }
        $out += & $read
        foreach ($x in $Send) { $b = [Text.Encoding]::ASCII.GetBytes($x); $st.Write($b, 0, $b.Length); $out += & $read }
        $out
    } catch { '' } finally { $c.Close() }
}

# Certificate and protocol of a TLS port. With -Proto, only that version is offered (to test old versions).
function script:Get-TlsInfo([string]$H, [int]$Port, $Proto = $null) {
    $c = New-Object Net.Sockets.TcpClient
    try {
        if (-not $c.ConnectAsync($H, $Port).Wait(3000)) { return $null }
        $c.ReceiveTimeout = 5000; $c.SendTimeout = 5000
        $st = New-Object Net.Security.SslStream($c.GetStream(), $false, ({ $true } -as [Net.Security.RemoteCertificateValidationCallback]))
        if ($Proto) { $st.AuthenticateAsClient($H, $null, $Proto, $false) } else { $st.AuthenticateAsClient($H) }
        $cert = New-Object Security.Cryptography.X509Certificates.X509Certificate2($st.RemoteCertificate)
        $chain = New-Object Security.Cryptography.X509Certificates.X509Chain
        $trusted = $chain.Build($cert)
        # SAN values (any locale: "DNS Name=x", "Nombre DNS=x") + CN
        $names = @(($cert.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.17' } | ForEach-Object { [regex]::Matches($_.Format($false), '=\s*([^,\s]+)') | ForEach-Object { $_.Groups[1].Value } }))
        if ($cert.Subject -match 'CN=([^,]+)') { $names += $Matches[1].Trim() }
        $nameOk = ($H -match '^[\d.]+$|:') -or [bool]($names | Where-Object { ($_ -notlike '`*.*' -and $H -eq $_) -or ($_ -like '`*.*' -and $H -like $_ -and ($H -split '\.').Count -eq ($_ -split '\.').Count) })
        [pscustomobject]@{ Proto = "$($st.SslProtocol)"; Days = [int]($cert.NotAfter - (Get-Date)).TotalDays; Trusted = $trusted; NameOk = $nameOk; Subject = $cert.Subject }
    } catch { $null } finally { $c.Close() }
}

function script:Http-Get([string]$Url) {
    $old = [Net.ServicePointManager]::ServerCertificateValidationCallback
    [Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    try {
        $rq = [Net.HttpWebRequest]::Create($Url)
        $rq.AllowAutoRedirect = $false; $rq.Timeout = 6000; $rq.ReadWriteTimeout = 6000; $rq.UserAgent = 'NeonAudit'
        try { $resp = $rq.GetResponse() } catch [Net.WebException] { $resp = $_.Exception.Response }
        if (-not $resp) { return $null }
        $body = ''
        try { $sr = New-Object IO.StreamReader($resp.GetResponseStream()); $buf = New-Object char[] 4096; $n = $sr.Read($buf, 0, 4096); $body = New-Object string($buf, 0, $n) } catch {}
        $o = [pscustomobject]@{ Status = [int]$resp.StatusCode; Location = $resp.Headers['Location']; Headers = $resp.Headers; Body = $body }
        $resp.Close(); $o
    } catch { $null } finally { [Net.ServicePointManager]::ServerCertificateValidationCallback = $old }
}

# ============================================================================ UPDATES
# winget packages with an update: Microsoft.WinGet.Client module if present, otherwise the
# `winget upgrade` table (columns found from the header positions, so it works in any language)
function script:Get-WingetUpdates {
    if (Get-Command Get-WinGetPackage -ErrorAction SilentlyContinue) {
        return Get-WinGetPackage -ErrorAction SilentlyContinue | Where-Object IsUpdateAvailable | ForEach-Object { [pscustomobject]@{ Name = $_.Name; Id = $_.Id; Version = $_.InstalledVersion; Available = @($_.AvailableVersions)[0] } }
    }
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { return }
    $lines = @(& winget upgrade --accept-source-agreements --disable-interactivity 2>$null | ForEach-Object { ("$_" -split "`r")[-1] })
    $sep = -1
    for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match '^-{20,}\s*$') { $sep = $i; break } }
    if ($sep -lt 1) { return }
    $cols = @([regex]::Matches($lines[$sep - 1], '\S+') | ForEach-Object Index)
    if ($cols.Count -lt 4) { return }
    for ($i = $sep + 1; $i -lt $lines.Count; $i++) {
        $l = $lines[$i]
        if ($l.Length -le $cols[3]) { break }
        $f = for ($k = 0; $k -lt 4; $k++) { $end = [Math]::Min($(if ($k + 1 -lt $cols.Count) { $cols[$k + 1] } else { $l.Length }), $l.Length); $l.Substring($cols[$k], [Math]::Max(0, $end - $cols[$k])).Trim() }
        if (-not $f[1] -or $f[1] -match '\s') { break }
        [pscustomobject]@{ Name = $f[0]; Id = $f[1]; Version = $f[2]; Available = $f[3] }
    }
}

function script:Show-WinUpdates($List) {
    $list = @($List)
    if ($list.Count -and $list[0].Error) { Warn "Windows Update: $($list[0].Error)"; return }
    if (-not $list.Count) { "  $E[92m✔ $(L 'Windows està al dia')$E[0m"; return }
    foreach ($u in $list) {
        $col = switch ($u.Sev) { 'Critical' { 91 } 'Important' { 93 } default { 37 } }
        "  $E[${col}m{0,-10}$E[0m {1}  $E[90m{2} MB$E[0m" -f $(if ($u.Sev) { $u.Sev } else { '-' }), $u.Title, $u.MB
    }
}

Reg 'Actualitzacions' 'updates [-NoWindows]' 'Programari d''aquest equip amb actualitzacions (winget + Windows Update)'
function global:updates([switch]$NoWindows) {
    Title 'Programari amb actualitzacions (winget)'
    Write-Host "  $E[90m$(L 'Consultant winget...')$E[0m"
    $w = @(Get-WingetUpdates)
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { Warn 'winget no disponible (instal·la "App Installer" de la Microsoft Store)' }
    elseif (-not $w.Count) { "  $E[92m✔ $(L 'Tot el programari està al dia')$E[0m" }
    else {
        foreach ($u in $w) {
            $name = if ($u.Name.Length -gt 30) { $u.Name.Substring(0, 29) + '…' } else { $u.Name }
            "  {0,-30} $E[90m{1,-16}$E[0m → $E[92m{2,-16}$E[0m  $E[96mwinget upgrade --id {3} -e$E[0m" -f $name, $u.Version, $u.Available, $u.Id
        }
        "  $E[90m$($w.Count) $(L 'paquets') · $(L 'clic a una línia per actualitzar-la, o tot alhora amb:') $E[96mupgrade all$E[0m"
    }
    if (-not $NoWindows) {
        Title 'Windows Update'
        Write-Host "  $E[90m$(L 'Cercant actualitzacions de Windows (pot trigar un minut)...')$E[0m"
        $wu = @(& $WinUpdBlock)
        Show-WinUpdates $wu
        if ($wu.Count -and -not $wu[0].Error) { "  $E[90m$(L 'Per instal·lar-les (com a administrador):')$E[0m $E[96mupgrade win$E[0m  $E[90m·$E[0m $E[96mupgrade win -Security$E[0m" }
    }
    try { $age = (Get-MpComputerStatus -ErrorAction Stop).AntivirusSignatureAge; if ($age -gt 1) { ""; "  $E[93m! $((L 'Signatures de Defender de fa {0} dies:') -f $age)$E[0m $E[96mavupdate$E[0m" } } catch {}
}

Reg 'Actualitzacions' 'upgrade <id|all|win>' 'Actualitza un paquet, tot el programari (winget) o Windows'
function global:upgrade([string]$What = '', [switch]$Security) {
    $agree = '--accept-source-agreements', '--accept-package-agreements', '--disable-interactivity'
    switch ($What) {
        '' { "  $(L 'Ús'): upgrade <id> · upgrade all · upgrade win [-Security]   $E[90m($(L 'llista-les amb'): updates)$E[0m" }
        'all' { & winget upgrade --all --silent @agree }
        'win' {
            if (-not (IsAdmin)) { Warn 'Cal PowerShell com a administrador (comanda: admin)'; return }
            & ([scriptblock]::Create("`$OnlySec = `$$([bool]$Security)`n" + $WinInstallScript))
        }
        default { & winget upgrade --id $What -e --silent @agree }
    }
}

Reg 'Actualitzacions' 'srvupdates <servidor>' 'Paquets pendents d''actualitzar en un servidor'
function global:srvupdates([Parameter(Mandatory = $true)][string]$Target) {
    $s = Resolve-Srv $Target
    Title "$(L 'Actualitzacions') · $($s.name)"
    if ($s.os -eq 'windows') {
        Write-Host "  $E[90m$(L 'Cercant actualitzacions de Windows (pot trigar un minut)...')$E[0m"
        $wu = @(Invoke-Win $s $WinUpdBlock)
        Show-WinUpdates $wu
        if ($wu.Count -and -not $wu[0].Error) { ""; "  $E[96msrvupgrade $($s.name)$E[0m  $E[90m·$E[0m  $E[96msrvupgrade $($s.name) -Security$E[0m" }
        return
    }
    if ($s.os -ne 'linux') { Warn 'No sé quin sistema té: afegeix-lo amb srvadd ... -Os linux|windows'; return }
    $pk = @(); $other = @()
    foreach ($l in @(Invoke-SshScript $s ("MODE=updates`n" + $LinuxScript))) { if ("$l" -like 'P|*') { $pk += , ("$l" -split '\|') } else { $other += $l } }
    Show-AuditLines $other
    if (-not $pk.Count) { "  $E[92m✔ $(L 'Tot el programari està al dia')$E[0m"; return }
    foreach ($p in ($pk | Sort-Object { $_[4] -ne 'sec' }, { $_[1] })) {
        $sec = if ($p[4] -eq 'sec') { "$E[91m$(L 'seguretat')$E[0m" } else { '' }
        "  {0,-34} $E[90m{1,-24}$E[0m → $E[92m{2,-24}$E[0m {3}" -f $p[1], $p[2], $p[3], $sec
    }
    $nsec = @($pk | Where-Object { $_[4] -eq 'sec' }).Count
    ""; "  $E[90m$($pk.Count) $(L 'paquets') ($nsec $(L 'de seguretat')) ·$E[0m $E[96msrvupgrade $($s.name)$E[0m $E[90m·$E[0m $E[96msrvupgrade $($s.name) -Security$E[0m"
}

Reg 'Actualitzacions' 'srvupgrade <servidor> [-Security]' 'Actualitza un servidor (apt/dnf/yum/zypper/apk/pacman o Windows Update)'
function global:srvupgrade([Parameter(Mandatory = $true)][string]$Target, [switch]$Security, [switch]$Yes) {
    $s = Resolve-Srv $Target
    if ($s.os -notin 'linux', 'windows') { Warn 'No sé quin sistema té: afegeix-lo amb srvadd ... -Os linux|windows'; return }
    $what = if ($Security) { L 'només actualitzacions de seguretat' } else { L 'totes les actualitzacions' }
    if (-not $Yes) {
        $a = Read-Host "  $((L 'Instal·lar {0} a {1} ({2})? [s/N]') -f $what, $s.name, $s.host)"
        if ($a -notmatch '^(s|si|sí|y|yes)$') { return }
    }
    if ($s.os -eq 'linux') {
        # sudo asks for the password on the terminal (-t)
        Invoke-SshScript $s -Tty (("SEC=$(if ($Security) { 1 })`n") + @'
S=sudo; [ "$(id -u)" = 0 ] && S=
if command -v apt-get >/dev/null; then
  $S apt-get update || exit 1
  if [ -n "$SEC" ] && command -v unattended-upgrade >/dev/null; then $S unattended-upgrade -v
  else $S apt-get -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold upgrade; fi
elif command -v dnf >/dev/null; then $S dnf -y upgrade ${SEC:+--security}
elif command -v yum >/dev/null; then $S yum -y update ${SEC:+--security}
elif command -v zypper >/dev/null; then if [ -n "$SEC" ]; then $S zypper -n patch --category security; else $S zypper -n update; fi
elif command -v apk >/dev/null; then $S apk upgrade -U
elif command -v pacman >/dev/null; then $S pacman -Syu --noconfirm
else echo "Unknown package manager"; exit 1; fi
if [ -f /var/run/reboot-required ] || { command -v needs-restarting >/dev/null && needs-restarting -r 2>/dev/null | grep -qi 'reboot is required'; }; then
  echo; echo ">>> REBOOT REQUIRED on $(hostname)"
fi
'@)
        return
    }
    # Windows: as SYSTEM through a scheduled task, reading its log until it's done
    $code = "`$OnlySec = `$$([bool]$Security)`n" + $WinInstallScript
    if (Is-Local $s.host) { upgrade win -Security:$Security; return }
    $ps = New-WinSession $s
    if (-not $ps) { return }
    try {
        Invoke-Command -Session $ps -ArgumentList $code -ScriptBlock {
            param($code)
            $f = Join-Path $env:SystemRoot 'Temp\neon-wu.ps1'
            Set-Content -LiteralPath $f -Value $code -Encoding UTF8
            Remove-Item (Join-Path $env:SystemRoot 'Temp\neon-wu.log') -ErrorAction SilentlyContinue
            $a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$f`""
            Register-ScheduledTask -TaskName 'NeonWU' -Action $a -User 'SYSTEM' -RunLevel Highest -Force | Out-Null
            Start-ScheduledTask -TaskName 'NeonWU'
        }
        $seen = 0; $start = Get-Date
        do {
            Start-Sleep -Seconds 8
            $log = @(Invoke-Command -Session $ps -ScriptBlock { Get-Content (Join-Path $env:SystemRoot 'Temp\neon-wu.log') -Encoding UTF8 -ErrorAction SilentlyContinue })
            $log | Select-Object -Skip $seen | ForEach-Object { "  $_" }
            $seen = $log.Count
        } until (($log -match '\sDONE$') -or ((Get-Date) - $start).TotalHours -gt 3)
        if ($log -match 'REBOOT REQUIRED') { ""; "  $E[93m! $(L 'Cal reiniciar el servidor. Quan sigui bon moment:')$E[0m Restart-Computer -ComputerName $($s.host) -Force" }
    } catch { Warn "WinRM: $($_.Exception.Message)" }
    finally {
        try { Invoke-Command -Session $ps -ScriptBlock { Unregister-ScheduledTask -TaskName 'NeonWU' -Confirm:$false -ErrorAction SilentlyContinue; Remove-Item (Join-Path $env:SystemRoot 'Temp\neon-wu.ps1') -ErrorAction SilentlyContinue } } catch {}
        Remove-PSSession $ps
    }
}
