$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

& (Join-Path $PSScriptRoot "setup-local-mysql.ps1")
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Set-Location $projectRoot
npm.cmd run dev
