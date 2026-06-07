Write-Host "=== Launching Al-Khair Pharma System (Port 3002) ===" -ForegroundColor Cyan
cd "$PSScriptRoot\server"
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies, please wait..." -ForegroundColor Yellow
    npm install
}
Write-Host "Starting server on port 3002..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList "/k", "title Al-Khair Pharma Server (3002) && node index.js"
Write-Host "Server started successfully!" -ForegroundColor Green
Write-Host "You can access the system at: http://localhost:3002" -ForegroundColor Cyan
