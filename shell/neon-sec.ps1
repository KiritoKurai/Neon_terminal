# ============================================================================
#  NEON TERMINAL — security, pentest and analysis tools
#  Responsible use: only scan your own systems or systems you're authorized to test.
# ============================================================================

# PowerShell 5.1 doesn't enable TLS 1.2 by default
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072 } catch {}

$script:E = [char]27

function script:IsAdmin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function script:Title($t) { $t = L $t; ""; "  $E[1;95m$t$E[0m"; "  $E[90m" + ('─' * [Math]::Min(60, $t.Length + 4)) + "$E[0m" }
function script:Warn($t) { "  $E[93m! $(L $t)$E[0m" }
function script:NeedAdmin { if (-not (IsAdmin)) { Warn 'Algunes dades requereixen PowerShell com a administrador (comanda: admin)' } }

# C# helper for heavy binary operations (entropy and string extraction)
function script:Ensure-NeonNative {
    if ('NeonSecNative' -as [type]) { return }
    Add-Type -TypeDefinition @'
using System; using System.Collections.Generic; using System.Text;
public static class NeonSecNative {
    public static double Entropy(byte[] d) {
        if (d.Length == 0) return 0; long[] c = new long[256];
        foreach (byte b in d) c[b]++;
        double e = 0; foreach (long n in c) { if (n == 0) continue; double p = (double)n / d.Length; e -= p * Math.Log(p, 2); }
        return e;
    }
    public static List<string> Ascii(byte[] d, int min) {
        var r = new List<string>(); var sb = new StringBuilder();
        foreach (byte b in d) { if (b >= 0x20 && b < 0x7f) sb.Append((char)b); else { if (sb.Length >= min) r.Add(sb.ToString()); sb.Clear(); } }
        if (sb.Length >= min) r.Add(sb.ToString()); return r;
    }
    public static List<string> Utf16(byte[] d, int min) {
        var r = new List<string>(); var sb = new StringBuilder();
        for (int i = 0; i + 1 < d.Length; i += 2) { byte b = d[i]; if (d[i + 1] == 0 && b >= 0x20 && b < 0x7f) sb.Append((char)b); else { if (sb.Length >= min) r.Add(sb.ToString()); sb.Clear(); } }
        if (sb.Length >= min) r.Add(sb.ToString()); return r;
    }
}
'@
}

function script:Read-FileBytes([string]$Path, [int]$MaxMB = 64) {
    $full = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
    $fs = [IO.File]::OpenRead($full)
    try {
        $len = [Math]::Min($fs.Length, $MaxMB * 1MB)
        $buf = New-Object byte[] $len
        [void]$fs.Read($buf, 0, $len)
        if ($fs.Length -gt $len) { Warn ((L 'Fitxer gran: només s''analitzen els primers {0} MB') -f $MaxMB) }
        return , $buf
    } finally { $fs.Close() }
}

# Executable path inside a command line ("C:\x y\a.exe" -arg / C:\a.exe /s / rundll32 x.dll,...)
function script:Get-ExePath([string]$cmd) {
    if (-not $cmd) { return $null }
    $cmd = [Environment]::ExpandEnvironmentVariables($cmd.Trim())
    if ($cmd.StartsWith('"')) { return $cmd.Substring(1, $cmd.IndexOf('"', 1) - 1) }
    if ($cmd -match '^(.+?\.(exe|dll|bat|cmd|ps1|vbs|js|com|scr))\b') { return $Matches[1] }
    return ($cmd -split ' ')[0]
}

$script:SigCache = @{}
function script:Sig([string]$path) {
    if (-not $path) { return 'N/A' }
    if ($SigCache.ContainsKey($path)) { return $SigCache[$path] }
    $r = if (-not (Test-Path -LiteralPath $path -ErrorAction SilentlyContinue)) { 'NoTrobat' } else {
        try { $s = Get-AuthenticodeSignature -LiteralPath $path -ErrorAction Stop; if ($s.Status -eq 'Valid') { 'Signat:' + ($s.SignerCertificate.Subject -replace '^CN="?([^",]+).*', '$1') } else { [string]$s.Status } } catch { 'Error' }
    }
    $SigCache[$path] = $r
    return $r
}
function script:SigColor([string]$s) { if ($s -like 'Signat:*') { "$E[92m$s$E[0m" } elseif ($s -eq 'NoTrobat') { "$E[90m$s$E[0m" } else { "$E[91m$s$E[0m" } }

$script:Services = @{
    20 = 'ftp-data'; 21 = 'ftp'; 22 = 'ssh'; 23 = 'telnet'; 25 = 'smtp'; 53 = 'dns'; 67 = 'dhcp'; 69 = 'tftp'; 80 = 'http'; 81 = 'http-alt'; 88 = 'kerberos'; 110 = 'pop3'; 111 = 'rpcbind'
    119 = 'nntp'; 123 = 'ntp'; 135 = 'msrpc'; 137 = 'netbios-ns'; 139 = 'netbios-ssn'; 143 = 'imap'; 161 = 'snmp'; 389 = 'ldap'; 443 = 'https'; 445 = 'smb'; 465 = 'smtps'
    500 = 'isakmp'; 514 = 'syslog'; 515 = 'printer'; 548 = 'afp'; 554 = 'rtsp'; 587 = 'submission'; 631 = 'ipp'; 636 = 'ldaps'; 873 = 'rsync'; 902 = 'vmware'; 993 = 'imaps'
    995 = 'pop3s'; 1080 = 'socks'; 1194 = 'openvpn'; 1433 = 'mssql'; 1521 = 'oracle'; 1723 = 'pptp'; 1883 = 'mqtt'; 2049 = 'nfs'; 2375 = 'docker'; 2376 = 'docker-tls'
    3000 = 'dev-http'; 3128 = 'squid'; 3306 = 'mysql'; 3389 = 'rdp'; 3690 = 'svn'; 4444 = 'metasploit?'; 5000 = 'upnp/dev'; 5060 = 'sip'; 5432 = 'postgres'; 5555 = 'adb'
    5672 = 'amqp'; 5900 = 'vnc'; 5985 = 'winrm'; 5986 = 'winrm-s'; 6379 = 'redis'; 6443 = 'k8s-api'; 7000 = 'cassandra'; 8000 = 'http-alt'; 8008 = 'http-alt'; 8080 = 'http-proxy'
    8081 = 'http-alt'; 8443 = 'https-alt'; 8888 = 'http-alt'; 9000 = 'php-fpm/portainer'; 9090 = 'prometheus'; 9100 = 'jetdirect'; 9200 = 'elasticsearch'; 9418 = 'git'
    10000 = 'webmin'; 11211 = 'memcached'; 27017 = 'mongodb'; 32400 = 'plex'; 49152 = 'win-rpc'
}
$script:TopPorts = @(21, 22, 23, 25, 53, 80, 81, 88, 110, 111, 135, 139, 143, 161, 389, 443, 445, 465, 500, 514, 548, 554, 587, 631, 636, 873, 902, 993, 995, 1080, 1194, 1433, 1521, 1723, 1883, 2049, 2375, 2376,
    3000, 3128, 3306, 3389, 3690, 4444, 5000, 5060, 5432, 5555, 5672, 5900, 5985, 5986, 6379, 6443, 7000, 8000, 8008, 8080, 8081, 8443, 8888, 9000, 9090, 9100, 9200, 9418, 10000, 11211, 27017, 32400, 49152)
$script:RiskyPorts = @(21, 23, 135, 139, 445, 1433, 2375, 3306, 3389, 5432, 5900, 5985, 6379, 9200, 11211, 27017)

function script:Expand-Ports([string]$spec) {
    switch ($spec) { 'top' { return $TopPorts } 'all' { return 1..65535 } 'well' { return 1..1024 } }
    $out = New-Object System.Collections.Generic.List[int]
    foreach ($part in ($spec -split ',')) {
        if ($part -match '^(\d+)-(\d+)$') { [int]$Matches[1]..[int]$Matches[2] | ForEach-Object { $out.Add($_) } }
        elseif ($part -match '^\d+$') { $out.Add([int]$part) }
    }
    return $out
}

function script:IpToUInt([string]$ip) { $b = ([Net.IPAddress]::Parse($ip)).GetAddressBytes(); [Array]::Reverse($b); [BitConverter]::ToUInt32($b, 0) }
function script:UIntToIp([uint32]$n) { $b = [BitConverter]::GetBytes($n); [Array]::Reverse($b); ([Net.IPAddress]$b).ToString() }
function script:Is-Private([string]$ip) { $ip -match '^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fe80:|f[cd][0-9a-f]{2}:|0\.0\.0\.0|::$)' }

function script:Local-Cidr {
    $cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1
    if (-not $cfg) { return $null }
    $a = $cfg.IPv4Address | Select-Object -First 1
    "$($a.IPAddress)/$($a.PrefixLength)"
}

# ============================================================================ NETWORK / RECON
Reg 'Pentest · xarxa' 'netinfo' 'Connexió activa: adaptador, IP, porta d''enllaç, DNS, MAC, IP pública'
function global:netinfo {
    Title 'Connexió de xarxa'
    Get-NetIPConfiguration | Where-Object { $_.NetAdapter.Status -eq 'Up' } | ForEach-Object {
        $ad = $_.NetAdapter
        $kind = if ($ad.PhysicalMediaType -match '802\.11|Wireless' -or $ad.InterfaceDescription -match 'Wi-?Fi|Wireless|WLAN') { 'Wi-Fi' } elseif ($ad.InterfaceDescription -match 'Virtual|VPN|TAP|Wintun|Hyper-V|VMware|VirtualBox|WSL') { 'Virtual' } else { 'Ethernet' }
        "  $E[96m$($ad.Name)$E[0m  $E[90m($kind · $($ad.InterfaceDescription))$E[0m"
        "     IPv4      $($_.IPv4Address.IPAddress -join ', ')/$($_.IPv4Address.PrefixLength | Select-Object -First 1)"
        if ($_.IPv6Address) { "     IPv6      $($_.IPv6Address.IPAddress -join ', ')" }
        "     Gateway   $($_.IPv4DefaultGateway.NextHop -join ', ')"
        "     DNS       $($_.DNSServer | Where-Object AddressFamily -eq 2 | ForEach-Object { $_.ServerAddresses } | Select-Object -Unique)"
        "     MAC       $($ad.MacAddress)    $(L 'Velocitat') $($ad.LinkSpeed)"
        ""
    }
    try { $r = Invoke-RestMethod 'https://ipinfo.io/json' -TimeoutSec 6; "  $((L 'IP pública').PadRight(11)) $E[96m$($r.ip)$E[0m  $($r.city), $($r.country)  $E[90m$($r.org)$E[0m" } catch { "  $((L 'IP pública').PadRight(11)) ($(L 'sense connexió'))" }
}

Reg 'Pentest · xarxa' 'wifi' 'Wi-Fi actual i xarxes properes (o la connexió de cable si no n''hi ha)'
function global:wifi {
    $svc = Get-Service wlansvc -ErrorAction SilentlyContinue
    $wl = Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.PhysicalMediaType -match '802\.11|Wireless' -or $_.InterfaceDescription -match 'Wi-?Fi|Wireless|WLAN' }
    if (-not $wl -or -not $svc -or $svc.Status -ne 'Running') {
        Warn 'Aquest equip no té cap adaptador Wi-Fi actiu (estàs connectat per cable). Mostro la connexió actual:'
        return netinfo
    }
    Title 'Wi-Fi'
    netsh wlan show interfaces | Select-String -Pattern 'SSID|BSSID|Señal|Signal|Senyal|Canal|Channel|Autenticaci|Authentication|Cifrado|Cipher|Velocidad|rate' | ForEach-Object { '  ' + $_.Line.Trim() }
    Title 'Xarxes properes'
    netsh wlan show networks mode=bssid | Select-String -Pattern 'SSID|Señal|Signal|Autenticaci|Authentication' | ForEach-Object { '  ' + $_.Line.Trim() }
}

Reg 'Pentest · xarxa' 'scan <host> [ports] [-Banner]' 'Escàner TCP ràpid. ports: top | well | all | 1-1024 | 22,80,443'
function global:scan {
    param([Parameter(Mandatory = $true)][string]$Target, [object]$Ports = 'top', [int]$Timeout = 700, [switch]$Banner)
    # '22,80' arrives as a list: join it into text
    $list = @(Expand-Ports ((@($Ports) | ForEach-Object { "$_" }) -join ','))
    try { $ip = ([Net.Dns]::GetHostAddresses($Target) | Where-Object AddressFamily -eq 'InterNetwork' | Select-Object -First 1).IPAddressToString } catch { $ip = $null }
    if (-not $ip) { Warn ((L 'No puc resoldre {0}') -f $Target); return }
    "  $E[90m$((L 'Escanejant {0} ({1}) · {2} ports · només sistemes propis o autoritzats') -f $Target, $ip, $list.Count)$E[0m"
    $open = New-Object System.Collections.Generic.List[int]
    $batch = 400; $sw = [Diagnostics.Stopwatch]::StartNew()
    for ($i = 0; $i -lt $list.Count; $i += $batch) {
        $chunk = $list[$i..([Math]::Min($i + $batch, $list.Count) - 1)]
        $jobs = foreach ($p in $chunk) { $c = New-Object Net.Sockets.TcpClient; [pscustomobject]@{ Port = $p; Client = $c; Task = $c.ConnectAsync($ip, $p) } }
        try { [void][Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($jobs.Task), $Timeout) } catch {}
        foreach ($j in $jobs) { if ($j.Task.Status -eq 'RanToCompletion' -and $j.Client.Connected) { $open.Add($j.Port) }; try { $j.Client.Close() } catch {} }
        if ($list.Count -gt $batch) { Write-Progress -Activity "scan $Target" -Status "$([Math]::Min($i + $batch, $list.Count))/$($list.Count) · $(L 'oberts'): $($open.Count)" -PercentComplete (100 * [Math]::Min($i + $batch, $list.Count) / $list.Count) }
    }
    Write-Progress -Activity "scan" -Completed
    ""
    if (-not $open.Count) { "  $(L 'Cap port obert') ($([Math]::Round($sw.Elapsed.TotalSeconds,1))s)"; return }
    "  $E[1mPORT     $((L 'SERVEI').PadRight(20))$(if ($Banner) { 'BANNER' })$E[0m"
    foreach ($p in ($open | Sort-Object)) {
        $svc = if ($Services.ContainsKey($p)) { $Services[$p] } else { '?' }
        $col = if ($RiskyPorts -contains $p) { 93 } else { 92 }
        $b = if ($Banner) { (banner $ip $p -Quiet) } else { '' }
        "  $E[${col}m{0,-8}$E[0m {1,-19} $E[90m{2}$E[0m" -f "$p/tcp", $svc, $b
    }
    "  $E[90m$($open.Count) $(L 'oberts') · $([Math]::Round($sw.Elapsed.TotalSeconds,1))s · $(L 'groc = servei sensible exposat')$E[0m"
}

Reg 'Pentest · xarxa' 'netscan [cidr]' 'Descobreix equips de la xarxa local (ping + ARP + nom)'
function global:netscan([string]$Cidr) {
    if (-not $Cidr) { $Cidr = Local-Cidr }
    if (-not $Cidr) { Warn 'No trobo la xarxa local'; return }
    $ipStr, $bits = $Cidr -split '/'; $bits = [int]$bits
    if ($bits -lt 22) { Warn ((L 'Rang massa gran (/{0}); limito a /24') -f $bits); $bits = 24 }
    $mask = [uint32]([Math]::Pow(2, 32) - [Math]::Pow(2, 32 - $bits))
    $net = (IpToUInt $ipStr) -band $mask
    $count = [Math]::Pow(2, 32 - $bits) - 2
    "  $E[90m$((L 'Escanejant {0}/{1} ({2} adreces)...') -f (UIntToIp $net), $bits, $count)$E[0m"
    $alive = @{}
    $addrs = 1..$count | ForEach-Object { UIntToIp ([uint32]($net + $_)) }
    for ($i = 0; $i -lt $addrs.Count; $i += 256) {
        $chunk = $addrs[$i..([Math]::Min($i + 256, $addrs.Count) - 1)]
        $jobs = foreach ($a in $chunk) { $p = New-Object Net.NetworkInformation.Ping; [pscustomobject]@{ Ip = $a; Task = $p.SendPingAsync($a, 800) } }
        try { [void][Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($jobs.Task), 2500) } catch {}
        foreach ($j in $jobs) { if ($j.Task.Status -eq 'RanToCompletion' -and $j.Task.Result.Status -eq 'Success') { $alive[$j.Ip] = "$($j.Task.Result.RoundtripTime) ms" } }
    }
    # hosts that don't answer ping but are in the ARP table
    $neigh = Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.State -in 'Reachable', 'Stale', 'Delay', 'Probe' -and $_.LinkLayerAddress -notmatch '^(00-00-00-00-00-00|FF-FF-FF-FF-FF-FF)$' }
    $macs = @{}; foreach ($n in $neigh) { $macs[$n.IPAddress] = $n.LinkLayerAddress; $u = IpToUInt $n.IPAddress; if (($u -band $mask) -eq $net -and -not $alive.ContainsKey($n.IPAddress)) { $alive[$n.IPAddress] = 'ARP' } }
    $ips = $alive.Keys | Sort-Object { IpToUInt $_ }
    $dns = foreach ($a in $ips) { [pscustomobject]@{ Ip = $a; Task = [Net.Dns]::GetHostEntryAsync($a) } }
    try { [void][Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($dns.Task), 2500) } catch {}
    $gw = (Get-NetIPConfiguration | Where-Object IPv4DefaultGateway | Select-Object -First 1).IPv4DefaultGateway.NextHop
    $me = (Get-NetIPAddress -AddressFamily IPv4).IPAddress
    ""; "  $E[1m{0,-16} {1,-18} {2,-8} {3}$E[0m" -f 'IP', 'MAC', 'PING', (L 'NOM')
    foreach ($d in $dns) {
        $name = if ($d.Task.Status -eq 'RanToCompletion') { $d.Task.Result.HostName } else { '' }
        $tag = if ($d.Ip -eq $gw) { " $E[95m[router]$E[0m" } elseif ($me -contains $d.Ip) { " $E[96m[$(L 'aquest equip')]$E[0m" } else { '' }
        "  {0,-16} {1,-18} {2,-8} {3}{4}" -f $d.Ip, $macs[$d.Ip], $alive[$d.Ip], $name, $tag
    }
    "  $E[90m$($ips.Count) $(L 'equips trobats')$E[0m"
}

Reg 'Pentest · xarxa' 'banner <host> <port>' 'Captura el banner d''un servei'
function global:banner([string]$H, [int]$Port, [switch]$Quiet) {
    $c = New-Object Net.Sockets.TcpClient
    try {
        if (-not $c.ConnectAsync($H, $Port).Wait(2000)) { if (-not $Quiet) { L 'Sense connexió' }; return '' }
        $s = $c.GetStream(); $s.ReadTimeout = 1500
        $buf = New-Object byte[] 1024; $txt = ''
        Start-Sleep -Milliseconds 400
        if (-not $s.DataAvailable) { $req = [Text.Encoding]::ASCII.GetBytes("HEAD / HTTP/1.0`r`nHost: $H`r`n`r`n"); $s.Write($req, 0, $req.Length) }
        try { $n = $s.Read($buf, 0, $buf.Length); $txt = [Text.Encoding]::ASCII.GetString($buf, 0, $n) } catch {}
        $txt = ($txt -replace '[^\x20-\x7E\r\n]', '.').Trim()
        if ($Quiet) { return (($txt -split "`r?`n") | Where-Object { $_ -match '^(Server:|SSH-|220|HTTP/|\+OK|\* OK)' } | Select-Object -First 1) }
        $txt
    } catch { if (-not $Quiet) { "Error: $($_.Exception.Message)" } else { '' } } finally { $c.Close() }
}

Reg 'Pentest · xarxa' 'ssl <host> [port]' 'Certificat TLS: emissor, caducitat, SAN, protocol'
function global:ssl([string]$H, [int]$Port = 443) {
    $c = New-Object Net.Sockets.TcpClient
    try {
        $c.Connect($H, $Port)
        $st = New-Object Net.Security.SslStream($c.GetStream(), $false, ({ $true } -as [Net.Security.RemoteCertificateValidationCallback]))
        $st.AuthenticateAsClient($H)
        $cert = New-Object Security.Cryptography.X509Certificates.X509Certificate2($st.RemoteCertificate)
        $chain = New-Object Security.Cryptography.X509Certificates.X509Chain
        $valid = $chain.Build($cert)
        $days = [int]($cert.NotAfter - (Get-Date)).TotalDays
        $san = ($cert.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.17' } | ForEach-Object { $_.Format($false) }) -replace 'DNS Name=|Nombre DNS=', ''
        Title "TLS $H`:$Port"
        "  $((L 'Subjecte').PadRight(10)) $($cert.Subject)"
        "  $((L 'Emissor').PadRight(10)) $($cert.Issuer)"
        "  $((L 'Vàlid').PadRight(10)) $($cert.NotBefore.ToString('yyyy-MM-dd')) → $($cert.NotAfter.ToString('yyyy-MM-dd'))  " + $(if ($days -lt 0) { "$E[91m$(L 'CADUCAT')$E[0m" } elseif ($days -lt 21) { "$E[93m$((L 'caduca en {0} dies') -f $days)$E[0m" } else { "$E[92m$((L '{0} dies') -f $days)$E[0m" })
        "  $((L 'Cadena').PadRight(10)) " + $(if ($valid) { "$E[92m$(L 'confiable')$E[0m" } else { "$E[91m$(L 'NO confiable'): $(($chain.ChainStatus | ForEach-Object Status) -join ', ')$E[0m" })
        "  Protocol   $($st.SslProtocol)  ·  $($st.CipherAlgorithm) $($st.CipherStrength) bits  ·  clau $($cert.PublicKey.Oid.FriendlyName) $($cert.PublicKey.Key.KeySize)"
        "  SAN        $san"
        "  SHA-256    $([BitConverter]::ToString((New-Object Security.Cryptography.SHA256Managed).ComputeHash($cert.RawData)) -replace '-', '')"
    } catch { Warn "Error: $($_.Exception.Message)" } finally { $c.Close() }
}

Reg 'Pentest · xarxa' 'secheaders <url>' 'Capçaleres de seguretat HTTP (HSTS, CSP, X-Frame...)'
function global:secheaders([string]$Url) {
    if ($Url -notmatch '^https?://') { $Url = "https://$Url" }
    try { $r = Invoke-WebRequest $Url -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 10 } catch { if ($_.Exception.Response) { $r = $_.Exception.Response } else { Warn $_.Exception.Message; return } }
    $h = $r.Headers
    Title "Capçaleres de seguretat · $Url"
    $want = [ordered]@{
        'Strict-Transport-Security' = (L 'Força HTTPS'); 'Content-Security-Policy' = (L 'Mitiga XSS/injeccions'); 'X-Frame-Options' = (L 'Evita clickjacking')
        'X-Content-Type-Options' = (L 'Evita MIME sniffing'); 'Referrer-Policy' = (L 'Controla el Referer'); 'Permissions-Policy' = (L 'Limita APIs del navegador')
        'Cross-Origin-Opener-Policy' = (L 'Aïlla la finestra'); 'Cross-Origin-Resource-Policy' = (L 'Limita càrregues creuades')
    }
    $ok = 0
    foreach ($k in $want.Keys) {
        if ($h[$k]) { $ok++; "  $E[92m✔$E[0m {0,-30} $E[90m{1}$E[0m" -f $k, ([string]$h[$k]).Substring(0, [Math]::Min(70, ([string]$h[$k]).Length)) }
        else { "  $E[91m✘$E[0m {0,-30} $E[90m{1}$E[0m" -f $k, $want[$k] }
    }
    foreach ($k in 'Server', 'X-Powered-By', 'X-AspNet-Version', 'X-AspNetMvc-Version') { if ($h[$k]) { "  $E[93m!$E[0m {0,-30} $E[93m{1}$E[0m ($(L 'revela tecnologia'))" -f $k, $h[$k] } }
    "  $E[90mPuntuació: $ok/$($want.Count)$E[0m"
}

Reg 'Pentest · xarxa' 'dnsinfo <domini>' 'Registres DNS + SPF/DMARC/CAA'
function global:dnsinfo([string]$D) {
    Title "DNS · $D"
    foreach ($t in 'A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'CAA', 'SOA') {
        try {
            $r = Resolve-DnsName $D -Type $t -DnsOnly -ErrorAction Stop | Where-Object { $_.Type -eq $t }
            foreach ($x in $r) {
                $v = switch ($t) { 'A' { $x.IPAddress } 'AAAA' { $x.IPAddress } 'CNAME' { $x.NameHost } 'MX' { "$($x.Preference) $($x.NameExchange)" } 'NS' { $x.NameHost } 'TXT' { $x.Strings -join '' } 'SOA' { "$($x.PrimaryServer) $($x.NameAdministrator)" } default { ($x | Out-String).Trim() } }
                "  $E[96m{0,-6}$E[0m {1}" -f $t, $v
            }
        } catch {}
    }
    $txt = (Resolve-DnsName $D -Type TXT -DnsOnly -ErrorAction SilentlyContinue).Strings -join "`n"
    $dmarc = (Resolve-DnsName "_dmarc.$D" -Type TXT -DnsOnly -ErrorAction SilentlyContinue).Strings -join ''
    ""
    if ($txt -match 'v=spf1') { "  $E[92m✔ SPF$E[0m    " + ($txt -split "`n" | Where-Object { $_ -match 'v=spf1' }) } else { "  $E[91m✘ SPF$E[0m    $(L 'no configurat (suplantació de correu possible)')" }
    if ($dmarc) { "  $E[92m✔ DMARC$E[0m  $dmarc" } else { "  $E[91m✘ DMARC$E[0m  $(L 'no configurat')" }
}

Reg 'Pentest · xarxa' 'whois <domini|ip>' 'Propietari, registrador, dates (RDAP)'
function global:whois([string]$Q) {
    $isIp = $Q -match '^\d{1,3}(\.\d{1,3}){3}$|:'
    try { $r = Invoke-RestMethod "https://rdap.org/$(if ($isIp) { 'ip' } else { 'domain' })/$Q" -TimeoutSec 12 } catch { Warn ("$(L 'Sense resposta RDAP'): $($_.Exception.Message)"); return }
    Title "WHOIS · $Q"
    if ($isIp) {
        "  $((L 'Xarxa').PadRight(10)) $($r.name)  ($($r.startAddress) - $($r.endAddress))"
        "  $((L 'País').PadRight(10)) $($r.country)"
    } else {
        "  $((L 'Domini').PadRight(10)) $($r.ldhName)"
        "  $((L 'Estat').PadRight(10)) $($r.status -join ', ')"
        "  NS         $(($r.nameservers | ForEach-Object ldhName) -join ', ')"
    }
    foreach ($ev in $r.events) { "  {0,-10} {1}" -f $ev.eventAction, $ev.eventDate }
    foreach ($en in $r.entities) {
        $fn = ($en.vcardArray[1] | Where-Object { $_[0] -eq 'fn' } | Select-Object -First 1)
        if ($fn) { "  {0,-10} {1}" -f ($en.roles -join '/'), $fn[3] }
    }
}

Reg 'Pentest · xarxa' 'ipinfo <ip>' 'Geolocalització i organització d''una IP'
function global:ipinfo([string]$Ip) { try { Invoke-RestMethod "https://ipinfo.io/$Ip/json" -TimeoutSec 8 | Format-List ip, hostname, city, region, country, org, timezone } catch { Warn $_.Exception.Message } }

Reg 'Pentest · xarxa' 'conns [-Resolve]' 'Connexions establertes amb procés (marca IP públiques)'
function global:conns([switch]$Resolve) {
    $procs = @{}; Get-Process | ForEach-Object { $procs[$_.Id] = $_.ProcessName }
    "  $E[1m{0,-22} {1,-24} {2,-6} {3}$E[0m" -f (L 'PROCÉS'), (L 'REMOT'), 'PORT', $(if ($Resolve) { L 'NOM' } else { '' })
    Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue | Where-Object { $_.RemoteAddress -notin '127.0.0.1', '::1' } | Sort-Object OwningProcess | ForEach-Object {
        $pub = -not (Is-Private $_.RemoteAddress)
        $name = if ($Resolve -and $pub) { try { [Net.Dns]::GetHostEntry($_.RemoteAddress).HostName } catch { '' } } else { '' }
        "  {0,-22} $(if ($pub) { "$E[96m" } else { "$E[90m" }){1,-24}$E[0m {2,-6} {3}" -f "$($procs[[int]$_.OwningProcess]) ($($_.OwningProcess))", $_.RemoteAddress, $_.RemotePort, $name
    }
}

Reg 'Pentest · xarxa' 'arp' 'Taula ARP (equips vistos a la xarxa)'
function global:arp { Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.State -ne 'Unreachable' -and $_.LinkLayerAddress -and $_.LinkLayerAddress -ne '00-00-00-00-00-00' -and $_.IPAddress -notmatch '^(224|239|255)\.' } | Sort-Object { IpToUInt $_.IPAddress } | Format-Table IPAddress, LinkLayerAddress, State, InterfaceAlias -AutoSize }

Reg 'Pentest · xarxa' 'trace <host>' 'Traceroute ràpid'
function global:trace([string]$H) { tracert -d -w 800 -h 25 $H }

Reg 'Pentest · xarxa' 'subnet <cidr>' 'Calculadora de subxarxes'
function global:subnet([string]$Cidr) {
    $ip, $bits = $Cidr -split '/'; $bits = [int]$bits
    $mask = [uint32]([Math]::Pow(2, 32) - [Math]::Pow(2, 32 - $bits)); $net = (IpToUInt $ip) -band $mask; $bc = $net + [uint32]([Math]::Pow(2, 32 - $bits) - 1)
    "  $((L 'Xarxa').PadRight(10)) $(UIntToIp $net)/$bits"; "  $((L 'Màscara').PadRight(10)) $(UIntToIp $mask)"; "  Broadcast  $(UIntToIp ([uint32]$bc))"
    if ($bits -lt 31) { "  Hosts      $(UIntToIp ([uint32]($net + 1))) - $(UIntToIp ([uint32]($bc - 1)))  ($([Math]::Pow(2, 32 - $bits) - 2))" }
}

Reg 'Pentest · xarxa' 'dnscache / flushdns' 'Veure / buidar la memòria cau DNS'
function global:dnscache { Get-DnsClientCache -ErrorAction SilentlyContinue | Select-Object -First 80 Entry, Data, TimeToLive | Format-Table -AutoSize }
function global:flushdns { Clear-DnsClientCache; 'Memòria cau DNS buidada' }

# ============================================================================ SYSTEM AUDIT
Reg 'Seguretat · sistema' 'secaudit' 'Auditoria de seguretat de l''equip amb puntuació'
function global:secaudit {
    $score = @{ ok = 0; warn = 0; bad = 0 }
    function Chk($name, $state, $detail = '') {
        $sym = @{ ok = "$E[92m✔"; warn = "$E[93m!"; bad = "$E[91m✘"; info = "$E[96m·" }[$state]
        "  $sym$E[0m {0,-38} $E[90m{1}$E[0m" -f (L $name), (L "$detail")
        if ($score.ContainsKey($state)) { $score[$state]++ }
    }
    Title 'Auditoria de seguretat'
    NeedAdmin
    # firewall
    try { foreach ($p in Get-NetFirewallProfile -ErrorAction Stop) { Chk "Tallafocs ($($p.Name))" $(if ($p.Enabled) { 'ok' } else { 'bad' }) $(if ($p.Enabled) { 'actiu' } else { 'DESACTIVAT' }) } } catch { Chk 'Tallafocs' 'info' 'no s''ha pogut llegir' }
    # antivirus
    try {
        $mp = Get-MpComputerStatus -ErrorAction Stop
        Chk 'Defender: protecció en temps real' $(if ($mp.RealTimeProtectionEnabled) { 'ok' } else { 'bad' }) $(if ($mp.RealTimeProtectionEnabled) { 'activa' } else { 'DESACTIVADA' })
        Chk 'Defender: signatures' $(if ($mp.AntivirusSignatureAge -le 3) { 'ok' } else { 'warn' }) "fa $($mp.AntivirusSignatureAge) dies"
        Chk 'Defender: protecció contra manipulació' $(if ($mp.IsTamperProtected) { 'ok' } else { 'warn' }) $(if ($mp.IsTamperProtected) { 'activa' } else { 'inactiva' })
    } catch {
        $av = Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction SilentlyContinue
        if ($av) { Chk 'Antivirus' 'ok' (($av.displayName | Select-Object -Unique) -join ', ') } else { Chk 'Antivirus' 'bad' 'no se n''ha detectat cap' }
    }
    # UAC
    $sys = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -ErrorAction SilentlyContinue
    Chk 'Control de comptes (UAC)' $(if ($sys.EnableLUA -eq 1) { if ($sys.ConsentPromptBehaviorAdmin -eq 0) { 'warn' } else { 'ok' } } else { 'bad' }) $(if ($sys.EnableLUA -ne 1) { 'DESACTIVAT' } elseif ($sys.ConsentPromptBehaviorAdmin -eq 0) { 'eleva sense preguntar' } else { 'actiu' })
    # SMBv1
    try { $smb = Get-SmbServerConfiguration -ErrorAction Stop; Chk 'SMBv1 (WannaCry/EternalBlue)' $(if ($smb.EnableSMB1Protocol) { 'bad' } else { 'ok' }) $(if ($smb.EnableSMB1Protocol) { 'ACTIVAT' } else { 'desactivat' }) } catch { Chk 'SMBv1' 'info' 'requereix admin' }
    # RDP
    $rdp = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server' -ErrorAction SilentlyContinue).fDenyTSConnections
    $nla = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -ErrorAction SilentlyContinue).UserAuthentication
    Chk 'Escriptori remot (RDP)' $(if ($rdp -eq 1) { 'ok' } elseif ($nla -eq 1) { 'warn' } else { 'bad' }) $(if ($rdp -eq 1) { 'desactivat' } elseif ($nla -eq 1) { 'activat amb NLA' } else { 'activat SENSE NLA' })
    # accounts
    $guest = Get-LocalUser -ErrorAction SilentlyContinue | Where-Object { $_.SID -like '*-501' }
    Chk 'Compte de convidat' $(if ($guest.Enabled) { 'bad' } else { 'ok' }) $(if ($guest.Enabled) { 'ACTIVAT' } else { 'desactivat' })
    $admins = @(Get-LocalGroupMember -SID 'S-1-5-32-544' -ErrorAction SilentlyContinue)
    Chk 'Administradors locals' $(if ($admins.Count -le 2) { 'ok' } else { 'warn' }) (($admins.Name | ForEach-Object { $_ -replace '^.*\\', '' }) -join ', ')
    $wl = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -ErrorAction SilentlyContinue
    Chk 'Inici de sessió automàtic' $(if ($wl.AutoAdminLogon -eq '1') { 'bad' } else { 'ok' }) $(if ($wl.AutoAdminLogon -eq '1') { "ACTIVAT$(if ($wl.DefaultPassword) { ' amb contrasenya en clar al registre!' })" } else { 'desactivat' })
    # encryption and boot
    try { $bl = (New-Object -ComObject Shell.Application).NameSpace('C:').Self.ExtendedProperty('System.Volume.BitLockerProtection'); Chk 'BitLocker a C:' $(if ($bl -eq 1) { 'ok' } else { 'warn' }) $(switch ($bl) { 1 { 'xifrat' } 2 { 'no xifrat' } 3 { 'xifrant...' } default { 'no disponible' } }) } catch {}
    $sb = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot\State' -ErrorAction SilentlyContinue).UEFISecureBootEnabled
    Chk 'Secure Boot' $(if ($sb -eq 1) { 'ok' } else { 'warn' }) $(if ($sb -eq 1) { 'actiu' } else { 'inactiu' })
    # credentials
    $lsa = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa' -ErrorAction SilentlyContinue
    Chk 'Protecció LSA (RunAsPPL)' $(if ($lsa.RunAsPPL -ge 1) { 'ok' } else { 'warn' }) $(if ($lsa.RunAsPPL -ge 1) { 'activa' } else { 'inactiva (mimikatz pot llegir LSASS)' })
    $wd = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest' -ErrorAction SilentlyContinue).UseLogonCredential
    Chk 'WDigest (contrasenyes en clar)' $(if ($wd -eq 1) { 'bad' } else { 'ok' }) $(if ($wd -eq 1) { 'ACTIVAT' } else { 'desactivat' })
    $llmnr = (Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient' -ErrorAction SilentlyContinue).EnableMulticast
    Chk 'LLMNR (enverinament amb Responder)' $(if ($llmnr -eq 0) { 'ok' } else { 'warn' }) $(if ($llmnr -eq 0) { 'desactivat' } else { 'actiu' })
    # updates
    $hf = Get-HotFix -ErrorAction SilentlyContinue | Where-Object InstalledOn | Sort-Object InstalledOn -Descending | Select-Object -First 1
    if ($hf) { $d = [int]((Get-Date) - $hf.InstalledOn).TotalDays; Chk 'Última actualització de Windows' $(if ($d -le 40) { 'ok' } else { 'warn' }) "fa $d dies ($($hf.HotFixID))" }
    # the machine's real policy (not the process one, which Neon opens with Bypass)
    $ep = (Get-ExecutionPolicy -List | Where-Object { $_.Scope -ne 'Process' -and $_.ExecutionPolicy -ne 'Undefined' } | Select-Object -First 1).ExecutionPolicy
    if (-not $ep) { $ep = 'Restricted' }
    Chk 'Política d''execució PowerShell' $(if ("$ep" -in 'Unrestricted', 'Bypass') { 'warn' } else { 'ok' }) $ep
    $rr = Get-Service RemoteRegistry -ErrorAction SilentlyContinue
    Chk 'Registre remot' $(if ($rr.Status -eq 'Running') { 'warn' } else { 'ok' }) $rr.Status
    # exposed ports
    $listen = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -in '0.0.0.0', '::' } | Select-Object -ExpandProperty LocalPort -Unique
    $risky = $listen | Where-Object { $RiskyPorts -contains $_ }
    Chk 'Ports sensibles exposats a la xarxa' $(if ($risky) { 'warn' } else { 'ok' }) $(if ($risky) { ($risky | ForEach-Object { "$_/$($Services[[int]$_])" }) -join ', ' } else { 'cap' })
    $hosts = Get-Content "$env:SystemRoot\System32\drivers\etc\hosts" -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*[^#\s]' }
    Chk 'Fitxer hosts' $(if ($hosts) { 'warn' } else { 'ok' }) $(if ($hosts) { "$(@($hosts).Count) entrades (revisa-les amb: hosts)" } else { 'net' })
    ""
    $total = $score.ok + $score.warn + $score.bad
    $pct = if ($total) { [int](100 * ($score.ok + $score.warn * 0.5) / $total) } else { 0 }
    $col = if ($pct -ge 80) { 92 } elseif ($pct -ge 60) { 93 } else { 91 }
    "  $E[1;${col}m$(L 'Puntuació'): $pct/100$E[0m   $E[92m$($score.ok) $(L 'correctes')$E[0m · $E[93m$($score.warn) $(L 'avisos')$E[0m · $E[91m$($score.bad) $(L 'problemes')$E[0m"
}

Reg 'Seguretat · sistema' 'defender' 'Estat de Microsoft Defender'
function global:defender {
    try { Get-MpComputerStatus -ErrorAction Stop | Format-List AMServiceEnabled, AntivirusEnabled, RealTimeProtectionEnabled, IsTamperProtected, AntivirusSignatureLastUpdated, AntivirusSignatureAge, QuickScanEndTime, FullScanEndTime }
    catch { Warn 'Defender no disponible (potser tens un altre antivirus)'; Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction SilentlyContinue | Select-Object displayName, pathToSignedProductExe }
}
Reg 'Seguretat · sistema' 'avscan [quick|full|<ruta>]' 'Escaneig antivirus amb Defender'
function global:avscan([string]$What = 'quick') {
    try {
        switch ($What) {
            'quick' { (L 'Escaneig ràpid en curs...'); Start-MpScan -ScanType QuickScan -ErrorAction Stop }
            'full' { (L 'Escaneig complet en curs (pot trigar molt)...'); Start-MpScan -ScanType FullScan -ErrorAction Stop }
            default { $p = (Resolve-Path $What).Path; ((L 'Escanejant {0}...') -f $p); Start-MpScan -ScanType CustomScan -ScanPath $p -ErrorAction Stop }
        }
        "$E[92m$(L 'Escaneig acabat.')$E[0m $(L 'Amenaces detectades:')"; threats
    } catch { Warn "No s'ha pogut escanejar: $($_.Exception.Message)"; NeedAdmin }
}
Reg 'Seguretat · sistema' 'threats' 'Amenaces detectades per Defender'
function global:threats {
    try {
        $t = Get-MpThreatDetection -ErrorAction Stop
        if (-not $t) { "  $E[92m$(L 'Cap amenaça registrada')$E[0m"; return }
        $names = @{}; Get-MpThreat -ErrorAction SilentlyContinue | ForEach-Object { $names[$_.ThreatID] = $_.ThreatName }
        $t | Sort-Object InitialDetectionTime -Descending | ForEach-Object { "  $E[91m$($names[$_.ThreatID])$E[0m  $($_.InitialDetectionTime)  $E[90m$($_.Resources -join ', ')$E[0m" }
    } catch { Warn 'Defender no disponible' }
}
Reg 'Seguretat · sistema' 'avupdate' 'Actualitza les signatures de Defender'
function global:avupdate { try { Update-MpSignature -ErrorAction Stop; L 'Signatures actualitzades' } catch { Warn $_.Exception.Message } }

Reg 'Seguretat · sistema' 'autoruns' 'Programes que s''inicien sols (registre, inici, tasques) + signatura'
function global:autoruns {
    Title 'Inici automàtic'
    $keys = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce'
    foreach ($k in $keys) {
        $p = Get-ItemProperty $k -ErrorAction SilentlyContinue
        if (-not $p) { continue }
        foreach ($prop in $p.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' }) {
            $exe = Get-ExePath $prop.Value
            "  {0,-34} {1}  $E[90m{2}$E[0m" -f $prop.Name, (SigColor (Sig $exe)), ($k -replace 'SOFTWARE\\(WOW6432Node\\)?Microsoft\\Windows\\CurrentVersion\\', '')
            "     $E[90m$($prop.Value)$E[0m"
        }
    }
    Title 'Carpetes d''inici'
    foreach ($f in [Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('CommonStartup')) {
        Get-ChildItem $f -ErrorAction SilentlyContinue | ForEach-Object {
            $target = $_.FullName
            if ($_.Extension -eq '.lnk') { $target = (New-Object -ComObject WScript.Shell).CreateShortcut($_.FullName).TargetPath }
            "  {0,-34} {1}  $E[90m{2}$E[0m" -f $_.Name, (SigColor (Sig $target)), $target
        }
    }
    Title 'Tasques programades (no Microsoft)'
    Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskPath -notlike '\Microsoft\*' -and $_.State -ne 'Disabled' } | ForEach-Object {
        $act = $_.Actions | Select-Object -First 1
        $exe = Get-ExePath $act.Execute
        "  {0,-34} {1}" -f $_.TaskName, (SigColor (Sig $exe))
        "     $E[90m$($act.Execute) $($act.Arguments)$E[0m"
    }
    "  $E[90m$(L 'Vermell = sense signatura vàlida: revisa-ho')$E[0m"
}

Reg 'Seguretat · sistema' 'procsus' 'Processos sospitosos (sense signar o des de carpetes temporals)'
function global:procsus {
    Title 'Processos sospitosos'
    $sus = '\\(Temp|AppData\\Local\\Temp|Downloads|Descargas|Baixades|Users\\Public|ProgramData)\\'
    $found = 0
    # Store apps (WindowsApps) are signed by their MSIX package, not Authenticode
    Get-Process | Where-Object { $_.Path -and $_.Path -notlike "$env:SystemRoot\*" -and $_.Path -notlike '*\WindowsApps\*' } | Sort-Object Path -Unique | ForEach-Object {
        $sig = Sig $_.Path
        $why = @()
        if ($sig -notlike 'Signat:*') { $why += (L 'sense signatura') }
        if ($_.Path -match $sus) { $why += (L 'carpeta inusual') }
        if ($why) {
            $found++
            "  $E[93m{0,-24}$E[0m PID {1,-6} {2}" -f $_.ProcessName, $_.Id, ($why -join ' · ')
            "     $E[90m$($_.Path)$E[0m"
        }
    }
    if (-not $found) { "  $E[92m$(L 'Cap procés sospitós')$E[0m" } else { "  $E[90m$(L 'Analitza''n un amb:') vt <file>  ·  strings <file>  ·  entropy <file>$E[0m" }
}

Reg 'Seguretat · sistema' 'svcaudit' 'Serveis: sense signar i rutes sense cometes (escalada de privilegis)'
function global:svcaudit {
    Title 'Auditoria de serveis'
    Get-CimInstance Win32_Service | Where-Object { $_.PathName } | ForEach-Object {
        $exe = Get-ExePath $_.PathName
        $issues = @()
        if ($_.PathName -notmatch '^"' -and $exe -match ' ' -and $exe -notlike "$env:SystemRoot\*") { $issues += "$E[91m$(L 'ruta sense cometes')$E[0m" }
        if ($exe -notlike "$env:SystemRoot\*") { $s = Sig $exe; if ($s -notlike 'Signat:*' -and $s -ne 'NoTrobat') { $issues += "$E[93m$s$E[0m" } }
        if ($issues) { "  {0,-32} {1,-9} {2}" -f $_.Name, $_.StartMode, ($issues -join ' · '); "     $E[90m$($_.PathName)$E[0m" }
    }
}

Reg 'Seguretat · sistema' 'users' 'Comptes locals i administradors'
function global:users {
    Title 'Comptes locals'
    Get-LocalUser | ForEach-Object { "  {0,-22} {1,-10} $(L 'últim accés'): {2,-20} $(L 'contrasenya'): {3}" -f $_.Name, $(if ($_.Enabled) { "$E[92m$(L 'habilitat')$E[0m" } else { "$E[90m$(L 'deshabilitat')$E[0m" }), $_.LastLogon, $(if ($_.PasswordRequired) { L 'requerida' } else { "$E[93m$(L 'NO requerida')$E[0m" }) }
    Title 'Administradors'
    Get-LocalGroupMember -SID 'S-1-5-32-544' -ErrorAction SilentlyContinue | ForEach-Object { "  $($_.Name)  $E[90m($($_.ObjectClass))$E[0m" }
}

Reg 'Seguretat · sistema' 'logons [n]' 'Inicis de sessió fallits i correctes recents (admin)'
function global:logons([int]$N = 20) {
    NeedAdmin
    try {
        Title 'Intents fallits (4625)'
        Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = 4625 } -MaxEvents $N -ErrorAction Stop | ForEach-Object { $x = [xml]$_.ToXml(); $d = @{}; $x.Event.EventData.Data | ForEach-Object { $d[$_.Name] = $_.'#text' }; "  $($_.TimeCreated)  $E[91m$($d.TargetUserName)$E[0m  $(L 'des de') $($d.IpAddress)  $(L 'tipus') $($d.LogonType)" }
    } catch { "  $E[90m($(L 'cap o sense permís'))$E[0m" }
    try {
        Title 'Correctes (4624, interactius/remots)'
        Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = 4624 } -MaxEvents 300 -ErrorAction Stop | ForEach-Object { $x = [xml]$_.ToXml(); $d = @{}; $x.Event.EventData.Data | ForEach-Object { $d[$_.Name] = $_.'#text' }; if ($d.LogonType -in '2', '10', '11') { "  $($_.TimeCreated)  $E[92m$($d.TargetUserName)$E[0m  $(L 'tipus') $($d.LogonType)  $($d.IpAddress)" } } | Select-Object -First $N
    } catch { "  $E[90m($(L 'sense permís'))$E[0m" }
}

Reg 'Seguretat · sistema' 'usbhist' 'Historial de dispositius USB d''emmagatzematge'
function global:usbhist { Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Enum\USBSTOR\*\*' -ErrorAction SilentlyContinue | ForEach-Object { $p = Get-ItemProperty $_.PSPath; "  $($p.FriendlyName)  $E[90m$($_.PSChildName)$E[0m" } }

Reg 'Seguretat · sistema' 'shares / fwrules [filtre]' 'Carpetes compartides / regles d''entrada permeses'
function global:shares { Get-SmbShare -ErrorAction SilentlyContinue | Format-Table Name, Path, Description -AutoSize }
function global:fwrules([string]$F = '') {
    Get-NetFirewallRule -Enabled True -Direction Inbound -Action Allow -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*$F*" } | Sort-Object DisplayName | ForEach-Object { "  {0,-60} $E[90m{1}$E[0m" -f $_.DisplayName.Substring(0, [Math]::Min(60, $_.DisplayName.Length)), $_.Profile }
}
Reg 'Seguretat · sistema' 'hosts' 'Entrades del fitxer hosts (el malware el modifica)'
function global:hosts { $h = Get-Content "$env:SystemRoot\System32\drivers\etc\hosts" | Where-Object { $_ -match '^\s*[^#\s]' }; if ($h) { $h | ForEach-Object { "  $E[93m$_$E[0m" } } else { "  $E[92m$(L 'Sense entrades personalitzades')$E[0m" } }

# ============================================================================ FILE / MALWARE ANALYSIS
Reg 'Malware · anàlisi' 'hashes <fitxer>' 'MD5, SHA1 i SHA256'
function global:hashes([string]$F) { foreach ($a in 'MD5', 'SHA1', 'SHA256') { "  {0,-7} {1}" -f $a, (Get-FileHash -LiteralPath $F -Algorithm $a).Hash } }

Reg 'Malware · anàlisi' 'vt <fitxer>' 'Obre el fitxer a VirusTotal pel seu hash (no el puja)'
function global:vt([string]$F) { $h = (Get-FileHash -LiteralPath $F -Algorithm SHA256).Hash; "  SHA256 $h"; Start-Process "https://www.virustotal.com/gui/file/$h" }

Reg 'Malware · anàlisi' 'sigcheck <fitxer|carpeta>' 'Verifica signatures digitals'
function global:sigcheck([string]$P = '.') {
    Get-ChildItem -LiteralPath $P -File -Recurse:((Get-Item -LiteralPath $P).PSIsContainer) -Include *.exe, *.dll, *.sys, *.msi, *.ps1, *.scr -ErrorAction SilentlyContinue | Select-Object -First 300 | ForEach-Object { "  {0}  $E[90m{1}$E[0m" -f (SigColor (Sig $_.FullName)), $_.FullName }
}

Reg 'Malware · anàlisi' 'entropy <fitxer>' 'Entropia (>7.2 = probablement empaquetat/xifrat)'
function global:entropy([string]$F) {
    Ensure-NeonNative
    $b = Read-FileBytes $F
    # ($e and $E are the same variable in PowerShell: hence $ent)
    $ent = [NeonSecNative]::Entropy($b)
    $col = if ($ent -gt 7.2) { 91 } elseif ($ent -gt 6.5) { 93 } else { 92 }
    $bar = ('█' * [int]($ent * 5)).PadRight(40, '░')
    "  $E[${col}m{0:N3}$E[0m / 8   $E[${col}m{1}$E[0m   {2}" -f $ent, $bar, $(if ($ent -gt 7.2) { L 'empaquetat, comprimit o xifrat' } elseif ($ent -gt 6.5) { L 'dades denses' } else { L 'normal' })
}

Reg 'Malware · anàlisi' 'strings <fitxer> [min] [filtre]' 'Cadenes llegibles d''un binari (ASCII + UTF-16)'
function global:strings([string]$F, [int]$Min = 5, [string]$Filter = '') {
    Ensure-NeonNative
    $b = Read-FileBytes $F
    $all = @([NeonSecNative]::Ascii($b, $Min)) + @([NeonSecNative]::Utf16($b, $Min))
    $all | Where-Object { -not $Filter -or $_ -match $Filter } | Select-Object -Unique
}

Reg 'Malware · anàlisi' 'iocs <fitxer>' 'Extreu indicadors: URLs, IPs, correus, registre, APIs sospitoses'
function global:iocs([string]$F) {
    Ensure-NeonNative
    $b = Read-FileBytes $F
    $s = (@([NeonSecNative]::Ascii($b, 4)) + @([NeonSecNative]::Utf16($b, 4))) -join "`n"
    $groups = [ordered]@{
        'URLs' = 'https?://[^\s"''<>]{4,}'
        'IPs' = '\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b'
        'Correus' = '[\w.+-]+@[\w-]+\.[\w.-]{2,}'
        'Registre' = '(?i)(HKEY_[A-Z_]+|HKLM|HKCU)\\[^\s"]{4,}|(?i)Software\\Microsoft\\Windows\\CurrentVersion\\Run[^\s"]*'
        'Rutes' = '(?i)[a-z]:\\[^\s"*?<>|]{4,}|%(appdata|temp|programdata|userprofile)%[^\s"]*'
        'APIs sospitoses' = '\b(VirtualAlloc(Ex)?|VirtualProtect|WriteProcessMemory|CreateRemoteThread|NtUnmapViewOfSection|SetWindowsHookEx|GetAsyncKeyState|URLDownloadToFile\w?|WinExec|ShellExecute\w?|IsDebuggerPresent|CheckRemoteDebuggerPresent|InternetOpen\w?|HttpSendRequest\w?|CryptEncrypt|CryptAcquireContext\w?|RegSetValueEx\w?|AdjustTokenPrivileges|OpenProcessToken|MiniDumpWriteDump|LoadLibrary\w?|GetProcAddress)\b'
        'Ordres' = '(?i)\b(powershell(\.exe)?\s+-(e|enc|encodedcommand|nop|w hidden)\b[^\n]*|cmd(\.exe)? /c [^\n]{4,}|vssadmin[^\n]*delete[^\n]*|bcdedit[^\n]*|schtasks[^\n]*/create[^\n]*|certutil[^\n]*-urlcache[^\n]*)'
    }
    foreach ($k in $groups.Keys) {
        $m = [regex]::Matches($s, $groups[$k]) | ForEach-Object Value | Select-Object -Unique
        if ($k -eq 'IPs') { $m = $m | Where-Object { $_ -notmatch '^(0\.|255\.|1\.0\.0\.0|\d+\.0\.0\.0|1\.3\.6\.1|1\.3\.14\.|1\.2\.840\.|2\.5\.|2\.16\.|2\.23\.|1\.3\.132\.)' } }  # drop certificate OIDs
        if (-not $m) { continue }
        Title "$(L $k) ($(@($m).Count))"
        $m | Select-Object -First 40 | ForEach-Object { "  $(if ($k -eq 'APIs sospitoses' -or $k -eq 'Ordres') { "$E[93m" })$_$E[0m" }
    }
}

Reg 'Malware · anàlisi' 'pe <fitxer>' 'Capçalera PE: arquitectura, data de compilació, seccions'
function global:pe([string]$F) {
    $b = Read-FileBytes $F 8
    if ($b[0] -ne 0x4D -or $b[1] -ne 0x5A) { Warn 'No és un executable PE (falta MZ)'; return }
    $pe = [BitConverter]::ToInt32($b, 0x3C)
    $machine = [BitConverter]::ToUInt16($b, $pe + 4); $nsec = [BitConverter]::ToUInt16($b, $pe + 6)
    $ts = [BitConverter]::ToUInt32($b, $pe + 8); $optSize = [BitConverter]::ToUInt16($b, $pe + 20); $chars = [BitConverter]::ToUInt16($b, $pe + 22)
    $magic = [BitConverter]::ToUInt16($b, $pe + 24)
    $sub = [BitConverter]::ToUInt16($b, $pe + 24 + 68)
    Title "PE · $(Split-Path $F -Leaf)"
    "  $((L 'Arquitectura').PadRight(13)) $(switch ($machine) { 0x14c { 'x86' } 0x8664 { 'x64' } 0xAA64 { 'ARM64' } default { '0x{0:X}' -f $machine } })  ·  $(if ($magic -eq 0x20b) { 'PE32+' } else { 'PE32' })  ·  $(if ($chars -band 0x2000) { 'DLL' } else { 'EXE' })"
    "  $((L 'Compilat').PadRight(13)) $([DateTimeOffset]::FromUnixTimeSeconds($ts).UtcDateTime.ToString('yyyy-MM-dd HH:mm')) UTC $(if ($ts -gt [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) { "$E[93m($(L 'data futura: falsificada?'))$E[0m" } elseif ($ts -lt 946684800) { "$E[90m($(L 'build reproduïble o data falsificada'))$E[0m" })"
    "  $((L 'Subsistema').PadRight(13)) $(switch ($sub) { 2 { 'GUI' } 3 { L 'Consola' } 1 { L 'Nadiu/driver' } default { $sub } })"
    "  $E[1m{0,-10} {1,10} {2,10} {3,8}  {4}$E[0m" -f (L 'SECCIÓ'), (L 'MIDA VIRT'), (L 'MIDA RAW'), (L 'ENTROPIA'), ''
    Ensure-NeonNative
    $sec = $pe + 24 + $optSize
    for ($i = 0; $i -lt $nsec; $i++) {
        $o = $sec + $i * 40
        $name = ([Text.Encoding]::ASCII.GetString($b, $o, 8)).TrimEnd([char]0)
        $vsz = [BitConverter]::ToUInt32($b, $o + 8); $rsz = [BitConverter]::ToUInt32($b, $o + 16); $rptr = [BitConverter]::ToUInt32($b, $o + 20)
        $ent = if ($rsz -gt 0 -and $rptr + $rsz -le $b.Length) { $seg = New-Object byte[] $rsz; [Array]::Copy($b, $rptr, $seg, 0, $rsz); [NeonSecNative]::Entropy($seg) } else { 0 }
        $flag = if ($ent -gt 7.2) { "$E[91m$(L 'empaquetada?')$E[0m" } elseif ($name -match 'UPX|aspack|themida|vmp') { "$E[91m$(L 'packer conegut')$E[0m" } else { '' }
        "  {0,-10} {1,10} {2,10} {3,8:N2}  {4}" -f $name, $vsz, $rsz, $ent, $flag
    }
    "  $((L 'Signatura').PadRight(13)) $(SigColor (Sig (Resolve-Path $F).Path))"
}

# ============================================================================ PENTEST UTILITIES
Reg 'Pentest · utilitats' 'jwt <token>' 'Descodifica un JWT (capçalera i contingut)'
function global:jwt([string]$T) {
    $parts = $T.Split('.')
    foreach ($i in 0, 1) {
        $p = $parts[$i].Replace('-', '+').Replace('_', '/'); while ($p.Length % 4) { $p += '=' }
        Title $(if ($i -eq 0) { 'Capçalera' } else { 'Contingut' })
        $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p))
        $obj = $json | ConvertFrom-Json
        ($obj | ConvertTo-Json -Depth 10) -split "`r?`n" | Where-Object { $_.Trim() } | ForEach-Object { "  $_" }
        if ($i -eq 0 -and $obj.alg -eq 'none') { Warn 'alg = none: el token no està signat!' }
        if ($i -eq 1) { foreach ($k in 'iat', 'nbf', 'exp') { if ($obj.$k) { "  $E[90m$k = $([DateTimeOffset]::FromUnixTimeSeconds([long]$obj.$k).LocalDateTime)$E[0m" } } }
    }
}

Reg 'Pentest · utilitats' 'hashid <hash>' 'Identifica el tipus de hash'
function global:hashid([string]$H) {
    $t = switch -Regex ($H) {
        '^\$2[aby]\$\d\d\$' { 'bcrypt' } '^\$argon2' { 'Argon2' } '^\$6\$' { 'SHA-512 crypt (Linux)' } '^\$5\$' { 'SHA-256 crypt (Linux)' } '^\$1\$' { 'MD5 crypt' } '^\$y\$' { 'yescrypt' }
        '^[a-f0-9]{32}$' { 'MD5 / NTLM / MD4' } '^[a-f0-9]{40}$' { 'SHA-1' } '^[a-f0-9]{56}$' { 'SHA-224' } '^[a-f0-9]{64}$' { 'SHA-256' } '^[a-f0-9]{96}$' { 'SHA-384' } '^[a-f0-9]{128}$' { 'SHA-512' }
        '^[a-f0-9]{32}:[a-f0-9]{32}$' { 'LM:NTLM' } '^[a-zA-Z0-9+/]{27}=$' { 'SHA-1 Base64' } default { 'desconegut' }
    }
    "  $E[96m$t$E[0m"
}

Reg 'Pentest · utilitats' 'urlenc / urldec <text>' 'Codifica/descodifica URL'
function global:urlenc { [uri]::EscapeDataString($args -join ' ') }
function global:urldec { [uri]::UnescapeDataString($args -join ' ') }

Reg 'Pentest · utilitats' 'pwned' 'Comprova si una contrasenya ha estat filtrada (HIBP, k-anonimat)'
function global:pwned {
    $sec = Read-Host ('  ' + (L 'Contrasenya (no es desa; només s''envien 5 caràcters del hash)')) -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $sha = -join ((New-Object Security.Cryptography.SHA1Managed).ComputeHash([Text.Encoding]::UTF8.GetBytes($plain)) | ForEach-Object { $_.ToString('X2') })
    $plain = $null
    $r = (Invoke-WebRequest "https://api.pwnedpasswords.com/range/$($sha.Substring(0,5))" -UseBasicParsing -TimeoutSec 10).Content
    $hit = ($r -split "`r?`n") | Where-Object { $_.StartsWith($sha.Substring(5)) }
    if ($hit) { "  $E[91m✘ $((L 'Filtrada {0} vegades. No la facis servir!') -f ($hit -split ':')[1])$E[0m" } else { "  $E[92m✔ $(L 'No apareix en cap filtració coneguda')$E[0m" }
}

Reg 'Pentest · utilitats' 'listen <port>' 'Escolta un port TCP i mostra el que hi arriba (proves de connectivitat)'
function global:listen([int]$Port) {
    $l = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Any, $Port)
    $l.Start(); "  $((L 'Escoltant al port {0} (Ctrl+C per sortir)...') -f $Port)"
    try {
        while ($true) {
            if (-not $l.Pending()) { Start-Sleep -Milliseconds 200; continue }
            $c = $l.AcceptTcpClient(); "  $E[92m$(L 'Connexió de') $($c.Client.RemoteEndPoint)$E[0m"
            $s = $c.GetStream(); $s.ReadTimeout = 3000; $buf = New-Object byte[] 4096
            try { $n = $s.Read($buf, 0, $buf.Length); [Text.Encoding]::UTF8.GetString($buf, 0, $n) } catch {}
            $c.Close()
        }
    } finally { $l.Stop() }
}

Reg 'Pentest · utilitats' 'sectools' 'Eines de seguretat instal·lades i com instal·lar-ne més'
function global:sectools {
    $tools = [ordered]@{ nmap = 'Insecure.Nmap'; wireshark = 'WiresharkFoundation.Wireshark'; sqlmap = '(pip install sqlmap)'; ffuf = '(go install / GitHub)'; nuclei = '(GitHub projectdiscovery)'
        hashcat = 'hashcat.hashcat'; john = '(GitHub openwall)'; burpsuite = 'PortSwigger.BurpSuite.Community'; ghidra = 'NSA.Ghidra'; x64dbg = '(x64dbg.com)'; procmon = 'Microsoft.Sysinternals.ProcessMonitor'
        autoruns = 'Microsoft.Sysinternals.Autoruns'; tcpview = 'Microsoft.Sysinternals.TCPView'; openssl = 'ShiningLight.OpenSSL.Light'; curl = '(Windows inclòs)'; ssh = '(Windows inclòs)' }
    Title 'Eines de seguretat'
    foreach ($t in $tools.Keys) {
        $c = Get-Command $t -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($c) { "  $E[92m✔$E[0m {0,-12} $E[90m{1}$E[0m" -f $t, $c.Source } else { "  $E[90m·$E[0m {0,-12} $E[90m$(L 'instal·lar'): {1}$E[0m" -f $t, $(if ($tools[$t] -like '(*') { $tools[$t] } else { "winget install $($tools[$t])" }) }
    }
}
