@echo off
rem NEON TERMINAL - CMD initializer (prompt + doskey macros)
chcp 65001 >nul
set "NEON_QUIET=1"
set "NEONPS=powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command . '%~dp0neon.ps1';"

rem Two-line prompt with the theme's ANSI colors
prompt $_$E[90m╭─$E[0m $E[2m$T$H$H$H$E[0m $E[1;34m$P$E[0m$_$E[90m╰─$E[36m❯$E[0m$S

rem Macros (neon.macros): Unix-style ones and the Neon commands via PowerShell (themes, system, network...).
rem A single doskey call: one doskey process per macro took ~1.5 s. %NEONPS% expands when a macro runs.
doskey /macrofile="%~dp0neon.macros"

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
