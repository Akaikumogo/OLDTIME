@echo off
echo Installing agent dependencies...
pip install -r requirements-agent.txt

echo Building WorkPlusAgent.exe...
pyinstaller ^
    --onefile ^
    --name WorkPlusAgent ^
    --hidden-import win32gui ^
    --hidden-import win32process ^
    --hidden-import win32con ^
    --hidden-import psutil ^
    workplus_computer_agent.py

echo.
if exist dist\WorkPlusAgent.exe (
    echo Build successful: dist\WorkPlusAgent.exe
) else (
    echo Build FAILED
    exit /b 1
)
