$ErrorActionPreference = 'SilentlyContinue'
foreach ($port in @(4000, 3000, 4001, 3001)) {
  netstat -ano | Select-String 'LISTENING' | Select-String ":$port " | ForEach-Object {
    if ($_ -match '\s+(\d+)\s*$') {
      $procId = [int]$matches[1]
      if ($procId -gt 0) {
        Write-Host "Stopping PID $procId (port $port)"
        taskkill /PID $procId /F | Out-Null
      }
    }
  }
}
Start-Sleep -Seconds 1
Write-Host 'Ports 4000 and 3000 should be free now.'
