@echo off
echo Starting VERITAS Frontend...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)
echo.
echo VERITAS UI: http://localhost:5173
echo.
npm run dev
