@echo off
rem ============================================================
rem  STORYUP - always-on local server (http://localhost:3000)
rem  Uses absolute paths to Node + Next so it never depends on PATH.
rem  Auto-restarts if it stops. Close this window to quit.
rem ============================================================
title STORYUP server - http://localhost:3000
cd /d "%~dp0"

rem Locate Node (pi-node install, else fall back to PATH)
set "NODE_EXE=%LOCALAPPDATA%\pi-node\current\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
set "NEXT_BIN=%~dp0node_modules\next\dist\bin\next"

if not exist "%NEXT_BIN%" (
  echo ERROR: dependencies not installed. Run this once first:
  echo     "%NODE_EXE%" -v
  echo     then in this folder:  npm install
  echo.
  pause
  exit /b 1
)

:loop
echo.
echo [%date% %time%]  Starting STORYUP on http://localhost:3000 ...
echo (Leave this window OPEN. Ctrl+C or close it to stop.)
echo.
"%NODE_EXE%" "%NEXT_BIN%" dev
echo.
echo [%date% %time%]  Server stopped - restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto loop
