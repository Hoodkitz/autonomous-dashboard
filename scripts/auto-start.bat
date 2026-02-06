@echo off
REM ============================================
REM Autonomous Symbiotic Engine - Auto-Start
REM Place shortcut in Windows Startup folder:
REM   shell:startup
REM ============================================

title Autonomous Engine Dashboard

echo ============================================
echo  Autonomous Symbiotic Engine - Starting...
echo ============================================

cd /d "%USERPROFILE%\autonomous-dashboard"

REM Check if port 3000 is already in use
netstat -ano | findstr ":3000" >nul 2>&1
if %ERRORLEVEL%==0 (
    echo Dashboard already running on port 3000
    echo Opening browser...
    start http://localhost:3000
    goto :check_engine
)

echo Starting Next.js dev server...
start /min cmd /c "cd /d %USERPROFILE%\autonomous-dashboard && npm run dev"

REM Wait for server to start
echo Waiting for server to be ready...
:wait_loop
timeout /t 2 /nobreak >nul
curl -s http://localhost:3000 >nul 2>&1
if %ERRORLEVEL% neq 0 goto :wait_loop

echo Server is ready!
start http://localhost:3000

:check_engine
REM Check if engine has interrupted state and trigger auto-resume
echo Checking for interrupted engine state...
curl -s http://localhost:3000/api/engine/auto-resume -X POST >nul 2>&1

echo ============================================
echo  Dashboard running at http://localhost:3000
echo  Engine auto-resume triggered
echo ============================================
