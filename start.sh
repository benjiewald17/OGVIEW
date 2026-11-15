#!/usr/bin/env bash
# OGVIEW starten (macOS/Linux): im Terminal  ./start.sh
set -e
cd "$(dirname "$0")"

PY=python3
command -v python3 >/dev/null 2>&1 || PY=python

echo "[1/2] Installiere Pakete (nur beim ersten Mal) ..."
"$PY" -m pip install -r requirements.txt --quiet

echo "[2/2] Starte OGVIEW ..."
echo "  ==> http://localhost:5002"
echo "  Beenden mit Strg+C"
( sleep 2; open http://localhost:5002 2>/dev/null || xdg-open http://localhost:5002 2>/dev/null || true ) &
exec "$PY" server.py
