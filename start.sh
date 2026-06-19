#!/bin/bash
set -e

echo "=== Steam Plant Digital Twin ==="

# Backend
echo "[1/2] Starting Python backend..."
cd backend
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
else
  source .venv/bin/activate
fi
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Frontend
echo "[2/2] Starting React frontend..."
cd frontend
[ ! -d "node_modules" ] && npm install
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "HMI:     http://localhost:5173"
echo "API:     http://localhost:8000/docs"
echo "Press Ctrl+C to stop both servers"
wait $BACKEND_PID $FRONTEND_PID
