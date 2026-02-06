@echo off
REM ============================================
REM Autonomous Symbiotic Engine - Auto-Start
REM Starts dashboard + watchdog on login
REM ============================================

title Autonomous Engine Launcher

set DASHBOARD_DIR=%USERPROFILE%\autonomous-dashboard
set PORT=3000

echo ============================================
echo  Autonomous Symbiotic Engine - Starting...
echo ============================================

cd /d "%DASHBOARD_DIR%"

REM Remove any previous stop signal
if exist "%DASHBOARD_DIR%\scripts\.watchdog-stop" del "%DASHBOARD_DIR%\scripts\.watchdog-stop"

REM Check if already running
netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL%==0 (
    echo Dashboard already running on port %PORT%
    goto :start_watchdog
)

echo Starting Next.js dev server...
start /min cmd /c "cd /d %DASHBOARD_DIR% && npm run dev -- --hostname 0.0.0.0"

echo Waiting for server...
:wait_loop
timeout /t 2 /nobreak >nul
curl -s http://localhost:%PORT% >nul 2>&1
if %ERRORLEVEL% neq 0 goto :wait_loop

echo Server is ready!

:start_watchdog
REM Start the self-healing watchdog in background
echo Starting self-healing watchdog...
start /min cmd /c "cd /d %DASHBOARD_DIR%\scripts && watchdog.bat"

REM Trigger auto-resume
echo Triggering auto-resume...
curl -s http://localhost:%PORT%/api/engine/auto-resume -X POST >nul 2>&1

REM Open browser
start http://localhost:%PORT%

echo ============================================
echo  Dashboard: http://localhost:%PORT%
echo  Watchdog:  ACTIVE (self-healing enabled)
echo  Auto-resume: triggered
echo ============================================
