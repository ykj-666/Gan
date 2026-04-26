@echo off
echo [1/3] 检查 Node.js...
node -v
if %errorlevel% neq 0 (
    echo [错误] Node.js 未安装
    pause
    exit /b 1
)
echo [2/3] 运行部署工具...
cd /d "%~dp0"
node deploy.cjs
echo.
echo [3/3] 退出码: %errorlevel%
echo.
pause
