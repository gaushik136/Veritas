@echo off
echo Starting VERITAS Backend...
cd /d "%~dp0backend"
if not exist ".venv" (
    echo Creating virtual environment...
    py -m venv .venv
    echo Installing dependencies...
    .venv\Scripts\python.exe -m pip install -r requirements.txt
)
echo.
echo VERITAS API: http://127.0.0.1:8000
echo Health check: http://127.0.0.1:8000/health
echo.
.venv\Scripts\python.exe start.py
