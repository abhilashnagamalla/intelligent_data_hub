@echo off
REM Quick Start Script for Intelligent Data Hub
REM This script starts both the backend and frontend servers

echo.
echo ========================================
echo Intelligent Data Hub - Quick Start
echo ========================================
echo.

REM Check if running from root directory
if not exist "backend" (
    echo Error: This script must be run from the root directory (MPS\intelligent_data_hub)
    pause
    exit /b 1
)

REM Start backend in a new terminal
echo Starting Backend Server (http://localhost:8000)...
start cmd /k "cd backend && python -m uvicorn app.main:app --reload --port 8000"
timeout /t 3

REM Start frontend in a new terminal
echo Starting Frontend Server (http://localhost:5173)...
start cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo Waiting for servers to start...
echo ========================================
echo.
timeout /t 5

REM Open browser
echo Opening browser...
start http://localhost:5173

echo.
echo ========================================
echo Servers started!
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo ========================================
echo.
echo To debug chatbot errors:
echo 1. Open Browser Console (F12)
echo 2. Check [API] and [ChatbotDataset] logs
echo 3. Check Network tab for failed requests
echo 4. Check backend terminal for [CHATBOT] logs
echo.
pause
