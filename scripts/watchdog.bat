@echo off
REM ============================================
REM Autonomous Engine Watchdog
REM Self-healing: checks every 30 seconds if
REM dashboard is alive, restarts if down.
REM Only stops if user creates STOP file.
REM ============================================

title Autonomous Engine Watchdog

set DASHBOARD_DIR=%USERPROFILE%\autonomous-dashboard
set STOP_FILE=%DASHBOARD_DIR%\scripts\.watchdog-stop
set CHECK_INTERVAL=30
set PORT=3000

REM Remove stop file on start (fresh start = active)
if exist "%STOP_FILE%" del "%STOP_FILE%"

echo ============================================
echo  Autonomous Engine Watchdog - ACTIVE
echo  Monitoring http://localhost:%PORT%
echo  Check interval: %CHECK_INTERVAL%s
echo  To stop: click OFF in dashboard or create
echo  %STOP_FILE%
echo ============================================
echo.

:watchdog_loop

REM Check if user requested stop
if exist "%STOP_FILE%" (
    echo [%date% %time%] User requested stop. Watchdog deactivating.
    echo Watchdog stopped. Delete .watchdog-stop and run again to reactivate.
    goto :eof
)

REM Health check - try to reach the dashboard
curl -s -o nul -w "%%{http_code}" http://localhost:%PORT% > "%TEMP%\watchdog_status.txt" 2>nul
set /p HTTP_STATUS=<"%TEMP%\watchdog_status.txt"

if "%HTTP_STATUS%"=="200" (
    REM Dashboard is alive, check auto-resume
    curl -s http://localhost:%PORT%/api/engine/auto-resume > "%TEMP%\watchdog_resume.txt" 2>nul
    echo [%date% %time%] OK - Dashboard alive (HTTP %HTTP_STATUS%)
) else (
    echo [%date% %time%] DOWN - Dashboard not responding! Restarting...

    REM Kill any zombie node processes on port 3000
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
        taskkill /PID %%a /F >nul 2>&1
    )

    REM Wait a moment for cleanup
    timeout /t 3 /nobreak >nul

    REM Restart the dashboard
    echo [%date% %time%] Starting dashboard...
    start /min cmd /c "cd /d %DASHBOARD_DIR% && npm run dev"

    REM Wait for it to come up
    echo [%date% %time%] Waiting for dashboard to start...
    :restart_wait
    timeout /t 3 /nobreak >nul
    curl -s http://localhost:%PORT% >nul 2>&1
    if %ERRORLEVEL% neq 0 goto :restart_wait

    echo [%date% %time%] Dashboard restarted successfully!

    REM Trigger auto-resume for any interrupted work
    curl -s http://localhost:%PORT%/api/engine/auto-resume -X POST >nul 2>&1
    echo [%date% %time%] Auto-resume triggered.
)

REM Wait before next check
timeout /t %CHECK_INTERVAL% /nobreak >nul
goto :watchdog_loop
