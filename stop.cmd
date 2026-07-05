@echo off
title ScanPilot - Stopping...
echo Stopping ScanPilot services...

taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM NAPS2.Console.exe >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq ScanPilot-Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq ScanPilot-Vite*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq ScanPilot-TSC*" >nul 2>&1

:: Kill any remaining node/python processes on our ports
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8765 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1

echo All ScanPilot services stopped.
timeout /t 2 /nobreak >nul
