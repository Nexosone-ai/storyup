@echo off
rem ============================================================
rem  STORYUP - always-on local server (http://localhost:3000)
rem  Auto-restarts if it ever stops. Close this window to quit.
rem  Runs through cmd (npm.cmd) so PowerShell policy never blocks it.
rem ============================================================
title STORYUP server - http://localhost:3000
cd /d "%~dp0"

:loop
echo.
echo [%date% %time%]  Starting STORYUP on http://localhost:3000 ...
echo (Leave this window open. Ctrl+C or close it to stop.)
echo.
call npm.cmd run dev
echo.
echo [%date% %time%]  Server stopped - restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto loop
