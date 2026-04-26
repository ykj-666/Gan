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

echo [3/3] Starting local web server...
echo.
echo Local URL: http://localhost:3000
echo Account: admin
echo Password: admin123
echo.
echo Keep this window open while using the website.
echo Press Ctrl+C to stop the server.
echo.

npm.cmd run dev

echo.
echo Server stopped. Code: %errorlevel%
pause
