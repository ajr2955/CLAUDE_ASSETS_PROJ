param(
    [int]$MaxIterations = 10,
    [int]$SleepSeconds = 2
)

Write-Host "Starting Ralph agent - maximum $MaxIterations cycles"
Write-Host ""

$promptFile   = Join-Path $PSScriptRoot "ralph-prompt.txt"
$prdFile      = Join-Path $PSScriptRoot "PRD.md"
$progressFile = Join-Path $PSScriptRoot "progress.txt"

$promptTemplate = Get-Content $promptFile -Raw

for ($i = 1; $i -le $MaxIterations; $i++) {
    # Re-read files each cycle so Ralph sees its own updates to progress.txt / PRD.md
    $prdContent      = Get-Content $prdFile      -Raw
    $progressContent = Get-Content $progressFile -Raw

    # Use .Replace() (literal, not regex) to avoid $ and () in file contents corrupting substitution
    $promptText = $promptTemplate.Replace('@PRD.md', $prdContent).Replace('@progress.txt', $progressContent)
    Write-Host "==========================================="
    Write-Host "  Cycle $i of $MaxIterations"
    Write-Host "==========================================="

    $result = $promptText | claude --dangerously-skip-permissions --output-format text -p -

    Write-Host $result
    Write-Host ""

    if ($result -like "*<promise>COMPLETE</promise>*") {
        Write-Host "==========================================="
        Write-Host "  All tasks completed after $i cycles"
        Write-Host "==========================================="
        exit 0
    }

    Start-Sleep -Seconds $SleepSeconds
}

Write-Host "==========================================="
Write-Host "  Stopped after reaching limit ($MaxIterations)"
Write-Host "==========================================="
exit 1