#!/bin/bash
# Run both EACH backend and frontend with one command
cd "$(dirname "$0")"

# Backend
source .venv/bin/activate 2>/dev/null || { python3.11 -m venv .venv && source .venv/bin/activate && pip install -q -r requirements.txt; }
python main.py &
BACKEND_PID=$!

# Frontend
cd frontend && npm run dev &
FRONTEND_PID=$!

# Exit cleanly on Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
