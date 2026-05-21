# go2rtc o'rnatish va ishga tushirish skripti
# PowerShell da ishga tushiring: .\setup_go2rtc.ps1

$go2rtcDir = "$PSScriptRoot\go2rtc"
$go2rtcExe = "$go2rtcDir\go2rtc.exe"
$go2rtcUrl = "https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_win64.exe"

if (-not (Test-Path $go2rtcDir)) {
    New-Item -ItemType Directory -Path $go2rtcDir | Out-Null
}

if (-not (Test-Path $go2rtcExe)) {
    Write-Host "go2rtc yuklab olinmoqda..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $go2rtcUrl -OutFile $go2rtcExe
    Write-Host "Yuklandi: $go2rtcExe" -ForegroundColor Green
} else {
    Write-Host "go2rtc allaqachon mavjud: $go2rtcExe" -ForegroundColor Green
}

# go2rtc.yaml config (kameralar dinamik qo'shiladi — config shart emas)
$configPath = "$go2rtcDir\go2rtc.yaml"
if (-not (Test-Path $configPath)) {
    @"
api:
  listen: ":1984"

# Kameralar backend orqali dinamik ro'yxatdan o'tkaziladi.
# Qo'lda qo'shish uchun:
# streams:
#   cam-UUID:
#     - rtsp://admin:password@IP:554/Streaming/Channels/101
"@ | Set-Content -Path $configPath -Encoding utf8
    Write-Host "Config yaratildi: $configPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "go2rtc ishga tushirilmoqda (port 1984)..." -ForegroundColor Cyan
Write-Host "To'xtatish uchun: Ctrl+C" -ForegroundColor Yellow
Write-Host ""
& $go2rtcExe -config $configPath
