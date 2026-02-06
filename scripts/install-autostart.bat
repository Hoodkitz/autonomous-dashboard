@echo off
REM ============================================
REM Install Autonomous Engine Auto-Start
REM Creates a shortcut in Windows Startup folder
REM ============================================

echo Installing Autonomous Engine auto-start...

set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SCRIPT=%USERPROFILE%\autonomous-dashboard\scripts\auto-start.bat

REM Create a shortcut in the Startup folder
echo Creating startup shortcut...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%STARTUP%\AutonomousEngine.lnk'); $s.TargetPath = '%SCRIPT%'; $s.WorkingDirectory = '%USERPROFILE%\autonomous-dashboard'; $s.Description = 'Autonomous Symbiotic Engine Dashboard'; $s.WindowStyle = 7; $s.Save()"

if %ERRORLEVEL%==0 (
    echo.
    echo ============================================
    echo  Auto-start installed successfully!
    echo  Location: %STARTUP%\AutonomousEngine.lnk
    echo  Target: %SCRIPT%
    echo.
    echo  The dashboard will auto-start on login.
    echo  To remove: delete AutonomousEngine.lnk
    echo  from your Startup folder (shell:startup)
    echo ============================================
) else (
    echo.
    echo ERROR: Failed to create shortcut.
    echo You can manually copy auto-start.bat to:
    echo   %STARTUP%
)

pause
