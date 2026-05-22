param(
    [string]$ServerIP = "192.168.30.52",
    [int]$BackendPort = 8000,
    [int]$GatewayPort = 1984
)

$BaseURL = "http://$ServerIP`:$BackendPort"
$GatewayURL = "http://$ServerIP`:$GatewayPort"

Write-Host "====== OLDTIME System Test ======" -ForegroundColor Cyan
Write-Host "Server: $ServerIP" -ForegroundColor Yellow
Write-Host ""

# Test 1: Backend
Write-Host "[1] Backend API" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseURL/api/camera-monitoring/zones" -TimeoutSec 5
    Write-Host "OK - Backend running" -ForegroundColor Green
} catch {
    Write-Host "FAIL - Backend offline" -ForegroundColor Red
}

# Test 2: Gateway
Write-Host "[2] Media Gateway (go2rtc)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$GatewayURL/api/streams" -TimeoutSec 5
    Write-Host "OK - Gateway running" -ForegroundColor Green
} catch {
    Write-Host "FAIL - Gateway offline" -ForegroundColor Red
}

# Test 3: Cameras
Write-Host "[3] Cameras" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseURL/api/camera-monitoring/cameras?limit=5" -TimeoutSec 5
    $data = $response.Content | ConvertFrom-Json
    Write-Host "OK - Found $($data.data.Count) cameras" -ForegroundColor Green
} catch {
    Write-Host "FAIL - Could not get cameras" -ForegroundColor Red
}

# Test 4: Rooms
Write-Host "[4] Rooms" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseURL/api/camera-monitoring/rooms" -TimeoutSec 5
    $data = $response.Content | ConvertFrom-Json
    Write-Host "OK - Found $($data.data.Count) rooms" -ForegroundColor Green
} catch {
    Write-Host "FAIL - Could not get rooms" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test complete" -ForegroundColor Cyan
