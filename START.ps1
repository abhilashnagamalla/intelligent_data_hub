#!/usr/bin/env pwsh
<#
Quick Start Script for Intelligent Data Hub (PowerShell)
This script starts both the backend and frontend servers
#>

Write-Host ""
Write-Host "========================================"
Write-Host "Intelligent Data Hub - Quick Start" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""

# Check if running from root directory
if (-not (Test-Path "backend")) {
    Write-Host "Error: This script must be run from the root directory" -ForegroundColor Red
    Write-Host "Current path: $(Get-Location)"
    Read-Host "Press Enter to exit"
    exit 1
}

# Function to check if port is in use
function Test-Port {
    param([int]$Port)
    $result = Test-NetConnection -ComputerName localhost -Port $Port -ErrorAction SilentlyContinue -WarningAction SilentlyContinue
    return $result.TcpTestSucceeded
}

# Check if ports are available
Write-Host "Checking port availability..."
if (Test-Port 8000) {
    Write-Host "Warning: Port 8000 is already in use" -ForegroundColor Yellow
    Write-Host "Kill process: taskkill /PID <pid> /F" -ForegroundColor Gray
}

if (Test-Port 5173) {
    Write-Host "Warning: Port 5173 is already in use" -ForegroundColor Yellow
    Write-Host "Kill process: taskkill /PID <pid> /F" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Starting Backend Server (http://localhost:8000)..." -ForegroundColor Green

# Start backend
$backendProcess = Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd backend; python -m uvicorn app.main:app --reload --port 8000" -PassThru
Write-Host "Backend PID: $($backendProcess.Id)" -ForegroundColor Gray

Start-Sleep -Seconds 3

Write-Host "Starting Frontend Server (http://localhost:5173)..." -ForegroundColor Green

# Start frontend
$frontendProcess = Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -PassThru
Write-Host "Frontend PID: $($frontendProcess.Id)" -ForegroundColor Gray

Write-Host ""
Write-Host "========================================"
Write-Host "Waiting for servers to start..."
Write-Host "========================================"
Write-Host ""

Start-Sleep -Seconds 5

Write-Host "Opening browser..."
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "========================================"
Write-Host "Servers started!" -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "To debug chatbot errors:"
Write-Host "1. Open Browser Console (F12)" -ForegroundColor Gray
Write-Host "2. Check [API] and [ChatbotDataset] logs" -ForegroundColor Gray
Write-Host "3. Check Network tab for failed requests" -ForegroundColor Gray
Write-Host "4. Check backend terminal for [CHATBOT] logs" -ForegroundColor Gray
Write-Host ""
Write-Host "Kill servers when done:"
Write-Host "taskkill /PID $($backendProcess.Id) /F" -ForegroundColor Gray
Write-Host "taskkill /PID $($frontendProcess.Id) /F" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to exit"

# Cleanup
Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
