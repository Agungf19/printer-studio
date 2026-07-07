@echo off
title PrintStudio - Stopping...
echo Stopping PrintStudio services...

taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM NAPS2.Console.exe >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq PrintStudio-Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq PrintStudio-Vite*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq PrintStudio-TSC*" >nul 2>&1

:: Kill any remaining node/python processes on our ports
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8765 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1

echo All PrintStudio services stopped.
timeout /t 2 /nobreak >nul
