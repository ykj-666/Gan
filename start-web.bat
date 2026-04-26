@echo off
title Gan Deploy Tool

echo Checking Node.js...
node --version >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Node.js not found.
    echo Please install from: https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi
    echo.
    pause
    exit /b 1
)

echo Starting web deploy tool...
cd /d "%~dp0"
node deploy-server.cjs
