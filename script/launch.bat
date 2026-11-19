@echo off
setlocal
cd /d "%~dp0.."

where bunx >nul 2>&1
if errorlevel 1 (
  echo Bun is required. Install it from https://bun.sh/
  exit /b 1
)

netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 start "Retro Mix Dev Server" /min cmd /c "bunx vite --host 127.0.0.1"
start "" http://127.0.0.1:5173/
