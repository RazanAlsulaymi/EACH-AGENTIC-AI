#!/bin/bash
# Run EACH backend (use Python 3.11 — LangChain doesn't support Python 3.14 yet)
cd "$(dirname "$0")"
source .venv/bin/activate 2>/dev/null || { python3.11 -m venv .venv && source .venv/bin/activate && pip install -q -r requirements.txt; }
exec python main.py
