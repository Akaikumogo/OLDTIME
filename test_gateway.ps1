# Test go2rtc gateway accessibility
param(
    [string]$ServerIP = "192.168.0.165",
    [int]$GatewayPort = 1984,
    [int]$BackendPort = 8000
)

Write-Host "=== Testing Media Gateway ===" -ForegroundColor Cyan

# Test 1: Check if go2rtc is running on the backend machine
Write-Host "`nTest 1: Testing gateway connectivity to $ServerIP`:$GatewayPort" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://$ServerIP`:$GatewayPort/api/streams" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Gateway is accessible (Status: $($response.StatusCode))" -ForegroundColor Green
    Write-Host "Current streams:"
    $response.Content | ConvertFrom-Json | Format-Table
} catch {
    Write-Host "✗ Gateway NOT accessible: $_" -ForegroundColor Red
    Write-Host "  - Make sure go2rtc is running on 192.168.0.165" -ForegroundColor Yellow
    Write-Host "  - Make sure port 1984 is not blocked" -ForegroundColor Yellow
}

# Test 2: Check backend API
Write-Host "`nTest 2: Testing backend API on $ServerIP`:$BackendPort" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://$ServerIP`:$BackendPort/api/camera-monitoring/zones" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Backend API is accessible" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend API NOT accessible: $_" -ForegroundColor Red
}

# Test 3: Test camera stream endpoint with debug
Write-Host "`nTest 3: Testing camera stream endpoint" -ForegroundColor Yellow
Write-Host "  Note: This will test the endpoint but may fail if no cameras are configured" -ForegroundColor Cyan
Write-Host "  The important thing is to see if the request reaches the gateway" -ForegroundColor Cyan

Write-Host "`n=== Diagnostic Summary ===" -ForegroundColor Cyan
Write-Host "If Test 1 fails: go2rtc is not running or not accessible" -ForegroundColor Yellow
Write-Host "If Test 2 fails: backend API is not accessible" -ForegroundColor Yellow
Write-Host "Check backend logs for [DEBUG] messages to see the actual gateway URL being used" -ForegroundColor Yellow
