@echo off
cd /d "%~dp0"
echo ========================================
echo   graphMCP - Single Process Dev Server
echo ========================================
echo.
echo Starting server on port 3001...
echo Starting GUI on port 5173...
echo Log: server.log
echo.
npm run dev > server.log 2>&1
pause