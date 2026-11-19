@echo off
setlocal
title Launch Android Emulator

rem Use universal C:\Software\Android location
set "ANDROID_HOME=C:\Software\Android\Sdk"
set "ANDROID_SDK_ROOT=C:\Software\Android\Sdk"
set "ANDROID_AVD_HOME=C:\Software\Android\avd"

set "EMULATOR_EXE=C:\Software\Android\Sdk\emulator\emulator.exe"
set "ADB_EXE=C:\Software\Android\Sdk\platform-tools\adb.exe"

if not exist "%EMULATOR_EXE%" (
    echo [ERROR] Android emulator executable not found at:
    echo %EMULATOR_EXE%
    pause
    exit /b 1
)

rem Check if an emulator is already running
"%ADB_EXE%" devices | findstr /i "emulator-" >nul 2>&1
if not errorlevel 1 (
    echo [INFO] An Android emulator is already running!
    "%ADB_EXE%" devices
    timeout /t 3 >nul
    exit /b 0
)

echo [START] Starting Android AVD 'medium_tablet'...
start "Android Emulator" "%EMULATOR_EXE%" -avd medium_tablet -no-snapshot-load

echo [INFO] Emulator launched in background.
timeout /t 3 >nul
exit /b 0
