# System diagnostic for 192.168.30.52
param(
    [string]$ServerIP = "192.168.30.52",
    [int]$BackendPort = 8000,
    [int]$GatewayPort = 1984
)

$BaseURL = "http://$ServerIP`:$BackendPort"
$GatewayURL = "http://$ServerIP`:$GatewayPort"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   OLDTIME System Diagnostic Test                          ║" -ForegroundColor Cyan
Write-Host "║   Server: $ServerIP                                       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# Test 1: Backend API
Write-Host "`n[1/5] Backend API Status" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseURL/api/camera-monitoring/zones" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  ✓ Backend API ONLINE (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Backend API OFFLINE" -ForegroundColor Red
    Write-Host "    Error: $_" -ForegroundColor Red
}

# Test 2: Gateway (go2rtc)
Write-Host "`n[2/5] Media Gateway (go2rtc) Status" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$GatewayURL/api/streams" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  ✓ Media Gateway ONLINE (Status: $($response.StatusCode))" -ForegroundColor Green
    $streams = $response.Content | ConvertFrom-Json
    if ($streams.Count -gt 0) {
        Write-Host "  Registered Streams: $($streams.Count)" -ForegroundColor Cyan
    } else {
        Write-Host "  No streams registered yet" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Media Gateway OFFLINE" -ForegroundColor Red
    Write-Host "    Error: $_" -ForegroundColor Red
}

# Test 3: Cameras
Write-Host "`n[3/5] Cameras List" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseURL/api/camera-monitoring/cameras?limit=5" -TimeoutSec 5 -ErrorAction Stop
    $cameras = $response.Content | ConvertFrom-Json
    if ($cameras.data.Count -gt 0) {
        Write-Host "  ✓ Found $($cameras.data.Count) cameras" -ForegroundColor Green
        $cameras.data | ForEach-Object {
            Write-Host "    - $($_.name) (ID: $($_.id)) - Status: $($_.status)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  ⚠ No cameras configured" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Could not fetch cameras" -ForegroundColor Red
    Write-Host "    Error: $_" -ForegroundColor Red
}

# Test 4: Rooms
Write-Host "`n[4/5] Rooms List" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseURL/api/camera-monitoring/rooms" -TimeoutSec 5 -ErrorAction Stop
    $rooms = $response.Content | ConvertFrom-Json
    if ($rooms.data.Count -gt 0) {
        Write-Host "  ✓ Found $($rooms.data.Count) rooms" -ForegroundColor Green
        $rooms.data | ForEach-Object {
            Write-Host "    - $($_.name)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  ⚠ No rooms configured" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Could not fetch rooms" -ForegroundColor Red
    Write-Host "    Error: $_" -ForegroundColor Red
}

# Test 5: Unknown Detections
Write-Host "`n[5/5] Unknown Detections (Real-time)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseURL/api/camera-monitoring/cameras/live-unknown-detections" -TimeoutSec 5 -ErrorAction Stop
    $detections = $response.Content | ConvertFrom-Json
    if ($detections.data.Count -gt 0) {
        Write-Host "  ✓ Found $($detections.data.Count) unknown persons" -ForegroundColor Green
        $detections.data | ForEach-Object {
            Write-Host "    - Camera: $($_.camera_name) (Confidence: $($_.confidence * 100)%)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  ✓ No unknown persons detected" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ Could not fetch detections" -ForegroundColor Red
    Write-Host "    Error: $_" -ForegroundColor Red
}

# Summary
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Test Summary                                            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host "`nFrontend URL: http://$ServerIP`:3000 (yoki tegishli port)" -ForegroundColor Yellow
Write-Host "Backend API: $BaseURL" -ForegroundColor Yellow
Write-Host "Media Gateway: $GatewayURL" -ForegroundColor Yellow

Write-Host "`n📋 Logs ko'rish:" -ForegroundColor Cyan
Write-Host "  Backend logs: C:\Users\User\Desktop\OLDTIME\Backend\logs" -ForegroundColor Gray
Write-Host "  go2rtc config: C:\Users\User\Desktop\OLDTIME\go2rtc\go2rtc.yaml" -ForegroundColor Gray

Write-Host "`n⚠️  Agar Backend yoki Gateway OFFLINE bo'lsa, uni restart qiling:" -ForegroundColor Yellow
Write-Host "  Backend: python main.py (Backend foldersida)" -ForegroundColor Gray
Write-Host "  go2rtc: .\go2rtc.exe (go2rtc foldersida)" -ForegroundColor Gray
