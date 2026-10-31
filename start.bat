@echo off
set "ROOT=%~dp0"
echo Starting Smart Waste Management System...

if not exist "%ROOT%backend\node_modules\express" (
  echo Installing backend dependencies...
  call npm.cmd --prefix "%ROOT%backend" install
  if errorlevel 1 (
    echo Backend dependency installation failed.
    pause
    exit /b 1
  )
)

if not exist "%ROOT%frontend\node_modules\vite" (
  echo Installing frontend dependencies...
  call npm.cmd --prefix "%ROOT%frontend" install
  if errorlevel 1 (
    echo Frontend dependency installation failed.
    pause
    exit /b 1
  )
)

start "EcoTrack API" cmd /k "cd /d ""%ROOT%backend"" && node server.js"
start "EcoTrack UI" cmd /k "cd /d ""%ROOT%frontend"" && npm.cmd run dev"
echo Backend and frontend are starting in separate windows.
echo Open http://localhost:5173 after the frontend is ready.
echo The ML service is optional; the API uses local risk scoring if it is not running.
