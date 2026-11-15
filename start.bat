@echo off
chcp 65001 >nul
title OGVIEW - One Global View
cd /d "%~dp0"

set PY=python
where python >nul 2>nul || set PY=py

if not exist "requirements.txt" (
  echo ============================================
  echo   FEHLER: Dateien fehlen in diesem Ordner!
  echo ============================================
  echo.
  echo   Du hast start.bat vermutlich DIREKT IM ZIP-FENSTER gestartet.
  echo   So geht es richtig:
  echo.
  echo   1. ZIP-Datei doppelklicken -^> Button "Alle extrahieren" klicken
  echo   2. In den NEU ENSTANDENEN Ordner gehen
  echo   3. DORT start.bat doppelklicken
  echo.
  pause
  goto ende
)

echo ============================================
echo   OGVIEW wird gestartet ...
echo ============================================
echo.

echo [1/3] Installiere Benoetigtes (nur beim ersten Mal, ca. 1 Minute) ...
%PY% -m pip install -r requirements.txt --quiet
if errorlevel 1 goto fehler

echo [2/3] Starte OGVIEW ...
echo.
echo   ==> Browser oeffnen:  http://localhost:5002
echo.
echo   WICHTIG: Dieses Fenster bitte OFFEN lassen, solange du die App nutzt!
echo            Beenden: Fenster schliessen oder Strg+C
echo.
echo   Der Browser oeffnet sich in wenigen Sekunden automatisch.
start "" /min cmd /c "timeout /t 4 /nobreak >nul && start "" http://localhost:5002"
%PY% server.py
goto ende

:fehler
echo.
echo FEHLER: Etwas hat nicht geklappt.
echo Moeglichste Ursache: Python ist nicht installiert oder
echo der Haken "Add Python to PATH" wurde beim Installieren vergessen.
echo Bitte Python von https://www.python.org/downloads/ installieren
echo (Haken bei "Add Python to PATH" setzen!) und dieses Fenster neu oeffnen.
pause

:ende
pause
