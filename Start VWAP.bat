@echo off
setlocal

REM ── Locate Python ──────────────────────────────────────────────────────────
where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.9+ and add it to PATH.
    pause
    exit /b 1
)

REM ── Verify bridge exists ───────────────────────────────────────────────────
set BRIDGE=%~dp0bloomberg-bridge\bridge.py
if not exist "%BRIDGE%" (
    echo ERROR: bloomberg-bridge\bridge.py not found.
    pause
    exit /b 1
)

REM ── Start bridge if not already running on port 8001 ──────────────────────
netstat -ano | find "0.0.0.0:8001" >nul 2>&1
if errorlevel 1 (
    echo Starting Bloomberg VWAP bridge on port 8001...
    where pythonw >nul 2>&1
    if errorlevel 1 (
        start /min python.exe "%BRIDGE%"
    ) else (
        start "" pythonw.exe "%BRIDGE%"
    )
    timeout /t 3 /nobreak >nul
) else (
    echo Bloomberg VWAP bridge already running on port 8001.
)

REM ── Open the SPA ──────────────────────────────────────────────────────────
set HTML=%~dp0spa\dist\index.html
if not exist "%HTML%" (
    echo ERROR: spa\dist\index.html not found. Run "npm run build" in the spa\ folder first.
    pause
    exit /b 1
)

echo Opening VWAP Curve Generator...
start "" "%HTML%"
exit /b 0
