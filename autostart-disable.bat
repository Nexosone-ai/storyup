@echo off
rem Removes the STORYUP auto-start task created by autostart-enable.bat.
schtasks /Delete /TN "STORYUP Local Server" /F
echo.
echo Auto-start removed. (Any running server window stays open until you close it.)
echo.
pause
