Write-Host "Starting FastAPI server..."
Set-Location "..\backend"
& ".\\.venv\\Scripts\\Activate.ps1"

$job = Start-Job -ScriptBlock { fastapi dev controller.py }

Write-Host "Waiting for server to start..."
do {
    Start-Sleep -Seconds 1
    $response = try { Invoke-WebRequest -Uri "http://localhost:8000/openapi.json" -UseBasicParsing -ErrorAction Stop } catch { $null }
} while ($response -eq $null)

Write-Host "Server is ready, generating API client..."
Set-Location "..\frontend"
& openapi-generator-cli generate -i http://localhost:8000/openapi.json -g typescript-fetch -o ./src/api-client

Write-Host "API client generated successfully!"

Write-Host "Stopping FastAPI server..."
Stop-Job $job
Remove-Job $job

Write-Host "Done!"