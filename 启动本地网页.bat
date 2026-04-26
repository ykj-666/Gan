@echo off
chcp 65001 >nul
title Gan Local Web

cd /d "%~dp0"

echo [1/3] Checking Node.js...
node --version >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js not found.
    echo Please install Node.js first.
    echo.
    pause
    exit /b 1
)

echo [2/3] Opening browser...
start "" "http://localhost:3000"

echo [3/3] Preparing local MySQL and starting web server...
echo.
echo Local URL: http://localhost:3000
echo Account: admin
echo Password: admin123
echo MySQL: this script will auto-prepare a local portable MySQL on 127.0.0.1:3307
echo.
echo Keep this window open while using the website.
echo Press Ctrl+C to stop the server.
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0scripts\start-local-web.ps1"

echo.
echo Server stopped. Code: %errorlevel%
pause
