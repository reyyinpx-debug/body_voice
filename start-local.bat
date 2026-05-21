@echo off
cd /d "D:\Hackathon_资料\hackathon-body-social"
echo Stopping old server...
taskkill /f /im node.exe 2>nul
timeout /t 1 /nobreak >nul
echo Starting BodyFeed server...
node dev-server.js
pause
