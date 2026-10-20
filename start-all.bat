@echo off
REM Starts the HRMS backend (uvicorn) and frontend (vite) dev servers.

start "HRMS Backend" /D "%~dp0backend" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
start "HRMS Frontend" /D "%~dp0frontend" cmd /k "npm run dev"

echo Backend:  http://127.0.0.1:8000/docs
echo Frontend: http://127.0.0.1:5173