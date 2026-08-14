@echo off
title STORYUP dev server
cd /d "%~dp0"
echo ============================================
echo   STORYUP - starting dev server
echo   Keep this window OPEN while using the app.
echo   Open http://localhost:3000 in your browser.
echo ============================================
echo.
call npm.cmd run dev
echo.
echo (server stopped)
pause
