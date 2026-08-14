@echo off
rem Registers STORYUP to auto-start at Windows login (so localhost:3000 is
rem always live). Runs once; re-run to update. Use autostart-disable.bat to undo.
setlocal
set "TASK=STORYUP Local Server"
set "TARGET=%~dp0serve.bat"

schtasks /Create /TN "%TASK%" /TR "\"%TARGET%\"" /SC ONLOGON /RL LIMITED /F
if errorlevel 1 (
  echo.
  echo Could not register the auto-start task.
  echo Tip: right-click this file and "Run as administrator" if it failed.
) else (
  echo.
  echo Done. STORYUP will start automatically every time you log in.
  echo Starting it now too...
  start "" "%TARGET%"
)
echo.
pause
