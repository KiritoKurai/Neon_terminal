; Neon Terminal — extra installer steps (electron-builder / NSIS)
; After copying the app, installs missing dependencies with winget (Claude Code, ffmpeg).
!macro customInstall
  DetailPrint "Checking and installing dependencies (Claude Code, ffmpeg)..."
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\app.asar.unpacked\shell\install-deps.ps1"'
  Pop $0
  DetailPrint "Dependencies: done ($0)"
!macroend
