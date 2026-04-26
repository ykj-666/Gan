@echo off
setlocal
chcp 65001 >nul
title Gan Deploy Web Tool
cd /d "%~dp0"

echo.
echo [1/2] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js not found.
    echo Please install from: https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi
    echo.
    pause
    exit /b 1
)

set "NODE_MAJOR="
for /f "tokens=1 delims=v." %%v in ('node --version') do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR (
    echo.
    echo [ERROR] Failed to detect Node.js version.
    echo.
    pause
    exit /b 1
)

if %NODE_MAJOR% LSS 20 (
    echo.
    echo [ERROR] Node.js version is too old ^(requires v20+^).
    echo Current:
    node --version
    echo Please upgrade from: https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js version:
node --version

echo.
echo [2/2] Starting deploy web tool...
echo The browser will open automatically. If not, visit http://localhost:3456
echo.
node deploy-server.cjs

echo.
echo [INFO] Program exited with code %errorlevel%
pause
