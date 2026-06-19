@echo off
echo === Steam Plant Digital Twin ===

:: Start Python backend
echo [1/2] Starting Python backend on http://localhost:8000 ...
cd backend
if not exist .venv (
    python -m venv .venv
    call .venv\Scripts\activate
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate
)
start "Backend" cmd /k "uvicorn main:app --reload --port 8000"
cd ..

:: Install and start React frontend
echo [2/2] Starting React HMI on http://localhost:5173 ...
cd frontend
if not exist node_modules (
    npm install
)
start "Frontend" cmd /k "npm run dev"
cd ..

echo.
echo Both servers starting. Open http://localhost:5173 in your browser.
echo Backend API docs: http://localhost:8000/docs
pause
