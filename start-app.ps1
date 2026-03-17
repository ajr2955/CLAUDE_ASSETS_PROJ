# start-app.ps1
# Workaround for Turbopack bug with non-ASCII (Hebrew) characters in folder paths.
# Creates a temporary Windows junction at C:\AssetsMgmt and runs the dev server from there.

$junctionPath = "C:\AssetsMgmt"
$appPath = Join-Path $PSScriptRoot "app"

# Create junction if it doesn't exist
if (-not (Test-Path $junctionPath)) {
    Write-Host "Creating junction: $junctionPath -> $appPath"
    New-Item -ItemType Junction -Path $junctionPath -Target $appPath | Out-Null
} else {
    Write-Host "Junction already exists at $junctionPath"
}

Write-Host "Starting Next.js dev server from $junctionPath ..."
Write-Host "App will be available at http://localhost:3000"
Write-Host ""

try {
    Set-Location $junctionPath
    npm run dev
} finally {
    # Restore original location
    Set-Location $PSScriptRoot
}
