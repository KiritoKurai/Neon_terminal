@echo off
rem NEON TERMINAL - CMD initializer (prompt + doskey macros)
chcp 65001 >nul
set "NEON_QUIET=1"
set "NEONPS=powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command . '%~dp0neon.ps1';"

rem Two-line prompt with the theme's ANSI colors
prompt $_$E[90m╭─$E[0m $E[2m$T$H$H$H$E[0m $E[1;34m$P$E[0m$_$E[90m╰─$E[36m❯$E[0m$S

rem Unix-style macros
doskey ls=dir /w $*
doskey ll=dir $*
doskey clear=cls
doskey cat=type $*
doskey pwd=cd
doskey ..=cd ..
doskey ...=cd ..\..
doskey grep=findstr /n /i $*
doskey which=where $*
doskey cc=claude $*
doskey ask=claude -p "$*"

rem Neon commands via PowerShell (themes, system, network...)
for %%c in (theme fx opacity fontsize glow crt accent wallpaper cursor settings palette split pin notify sysinfo top disks uptime battery myip localip ports killport weather pingg dns serve size bigfiles ff uuid pass calc epoch cheat qr timer matrix rainbow hack fortune colors neon netinfo wifi netscan banner ssl secheaders dnsinfo whois ipinfo conns arp trace subnet dnscache flushdns secaudit defender avscan threats avupdate autoruns procsus svcaudit users logons usbhist shares fwrules hosts hashes vt sigcheck entropy strings iocs pe jwt hashid urlenc urldec pwned listen sectools lang focus preview pv) do doskey %%c=%NEONPS% %%c $*

if exist "%USERPROFILE%\.neonrc.cmd" call "%USERPROFILE%\.neonrc.cmd"
cls
echo.
if "%NEON_LANG%"=="es" (
  echo   [1;96m✳ NEON[0m[90m  ·  Command Prompt  ·  escribe [96mneon[90m para ver los comandos[0m
) else if "%NEON_LANG%"=="en" (
  echo   [1;96m✳ NEON[0m[90m  ·  Command Prompt  ·  type [96mneon[90m to see the commands[0m
) else (
  echo   [1;96m✳ NEON[0m[90m  ·  Command Prompt  ·  escriu [96mneon[90m per veure les comandes[0m
)
