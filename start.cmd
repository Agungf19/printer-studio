@echo off
title PrintStudio - Starting...
echo ========================================
echo   PrintStudio - Starting All Services
echo ========================================
echo.

:: Kill existing processes
echo [1/4] Cleaning up old processes...
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM NAPS2.Console.exe >nul 2>&1
timeout /t 1 /nobreak >nul

:: Start FastAPI backend
echo [2/4] Starting FastAPI backend (LAN port 8765)...
start "PrintStudio-Backend" /MIN cmd /c "cd /d %~dp0backend && D:\laragon\bin\python\python-3.10\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8765 --reload"

:: Start Vite dev server
echo [3/4] Starting Vite dev server (port 5173)...
start "PrintStudio-Vite" /MIN cmd /c "cd /d %~dp0desktop && npx vite --port 5173"

:: Wait for Vite to be ready
echo      Waiting for Vite to be ready...
:wait_vite
timeout /t 2 /nobreak >nul
curl -s http://localhost:5173 >nul 2>&1
if errorlevel 1 goto wait_vite
echo      Vite ready!

:: Start TypeScript watch
echo      Starting TypeScript watch...
start "PrintStudio-TSC" /MIN cmd /c "cd /d %~dp0desktop && npx tsc -p tsconfig.electron.json --watch"

:: Wait a bit for everything to settle
timeout /t 2 /nobreak >nul

:: Start Electron
echo [4/4] Starting Electron...
start "PrintStudio-Electron" cmd /c "cd /d %~dp0desktop && npx electron ."

echo.
echo ========================================
echo   PrintStudio is running!
echo   - Backend:  http://127.0.0.1:8765
echo   - Sharing:  http://IP-PC-HOST:8765/sharing/client
echo   - Frontend: http://localhost:5173
echo   - Electron: Desktop window
echo ========================================
echo.
echo Press any key to STOP all services...
pause >nul

echo.
echo Stopping all services...
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq PrintStudio-Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq PrintStudio-Vite*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq PrintStudio-TSC*" >nul 2>&1
taskkill /F /IM NAPS2.Console.exe >nul 2>&1
echo All services stopped.
timeout /t 2 /nobreak >nul
