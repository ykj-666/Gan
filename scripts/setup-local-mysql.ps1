param(
  [int]$Port = 3307
)

$ErrorActionPreference = "Stop"
if ($PSVersionTable.PSVersion.Major -ge 7) {
  $PSNativeCommandUseErrorActionPreference = $false
}

function Write-Step($message) {
  Write-Host $message
}

function New-RandomSecret([int]$length = 24) {
  $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  $buffer = New-Object char[] $length
  for ($i = 0; $i -lt $length; $i++) {
    $buffer[$i] = $chars[(Get-Random -Minimum 0 -Maximum $chars.Length)]
  }
  return (-join $buffer)
}

function Wait-TcpPort([string]$HostName, [int]$PortNumber, [int]$TimeoutSeconds = 30) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $client = $null
    try {
      $client = New-Object System.Net.Sockets.TcpClient
      $async = $client.BeginConnect($HostName, $PortNumber, $null, $null)
      if ($async.AsyncWaitHandle.WaitOne(1000) -and $client.Connected) {
        $client.EndConnect($async)
        $client.Close()
        return $true
      }
    } catch {
    } finally {
      if ($client) {
        $client.Close()
      }
    }

    Start-Sleep -Milliseconds 500
  }

  return $false
}

function Get-EnvMap([string]$Path) {
  $result = @{}

  if (-not (Test-Path $Path)) {
    return $result
  }

  foreach ($line in Get-Content $Path) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith("#")) {
      continue
    }

    $pair = $line -split "=", 2
    if ($pair.Count -ne 2) {
      continue
    }

    $result[$pair[0].Trim()] = $pair[1]
  }

  return $result
}

function Get-ListeningProcessId([int]$PortNumber) {
  try {
    $connection = Get-NetTCPConnection -LocalPort $PortNumber -State Listen -ErrorAction Stop |
      Select-Object -First 1
    if ($connection) {
      return [int]$connection.OwningProcess
    }
  } catch {
  }

  return $null
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot ".runtime\mysql-local"
$downloadDir = Join-Path $runtimeRoot "downloads"
$extractDir = Join-Path $runtimeRoot "server"
$logDir = Join-Path $runtimeRoot "logs"
$dataDir = Join-Path $runtimeRoot "data"
$statePath = Join-Path $runtimeRoot "state.json"
$configPath = Join-Path $runtimeRoot "my.ini"
$bootstrapPath = Join-Path $runtimeRoot "bootstrap.sql"
$stdoutLog = Join-Path $logDir "mysql.stdout.log"
$stderrLog = Join-Path $logDir "mysql.stderr.log"
$mysqlVersion = "8.4.8"
$mysqlFolder = "mysql-$mysqlVersion-winx64"
$mysqlZipUrl = "https://cdn.mysql.com/Downloads/MySQL-8.4/$mysqlFolder.zip"
$mysqlZipPath = Join-Path $downloadDir "$mysqlFolder.zip"
$mysqlRoot = Join-Path $extractDir $mysqlFolder
$mysqldExe = Join-Path $mysqlRoot "bin\mysqld.exe"
$mysqlExe = Join-Path $mysqlRoot "bin\mysql.exe"
$mysqlClientStdout = Join-Path $logDir "mysql-client.stdout.log"
$mysqlClientStderr = Join-Path $logDir "mysql-client.stderr.log"

function Join-ProcessArguments([string[]]$Arguments) {
  return ($Arguments | ForEach-Object {
    if ($_ -match '[\s"]') {
      '"' + ($_ -replace '"', '\"') + '"'
    } else {
      $_
    }
  }) -join " "
}

function Start-PortableMysql([string[]]$ExtraArgs = @()) {
  $args = @("--defaults-file=$configPath", "--console") + $ExtraArgs
  $argumentString = Join-ProcessArguments $args
  Start-Process -FilePath $mysqldExe `
    -ArgumentList $argumentString `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog | Out-Null
}

function Stop-PortableMysql() {
  $processId = Get-ListeningProcessId -PortNumber $Port
  if ($processId) {
    Stop-Process -Id $processId -Force
    Start-Sleep -Seconds 2
  }
}

function Invoke-MySql([string[]]$Arguments, [string]$Password = "") {
  if (Test-Path $mysqlClientStdout) {
    Remove-Item $mysqlClientStdout -Force
  }
  if (Test-Path $mysqlClientStderr) {
    Remove-Item $mysqlClientStderr -Force
  }

  $previousPassword = $env:MYSQL_PWD
  if ($Password) {
    $env:MYSQL_PWD = $Password
  } else {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
  }

  $argumentString = Join-ProcessArguments $Arguments
  $process = Start-Process -FilePath $mysqlExe `
    -ArgumentList $argumentString `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $mysqlClientStdout `
    -RedirectStandardError $mysqlClientStderr

  if ([string]::IsNullOrEmpty($previousPassword)) {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
  } else {
    $env:MYSQL_PWD = $previousPassword
  }

  return [pscustomobject]@{
    ExitCode = $process.ExitCode
    StdOut = if (Test-Path $mysqlClientStdout) { Get-Content $mysqlClientStdout -Raw } else { "" }
    StdErr = if (Test-Path $mysqlClientStderr) { Get-Content $mysqlClientStderr -Raw } else { "" }
  }
}

New-Item -ItemType Directory -Force -Path $downloadDir, $extractDir, $logDir | Out-Null

if (-not (Test-Path $mysqlZipPath)) {
  Write-Step "[1/7] Downloading portable MySQL..."
  Invoke-WebRequest -Uri $mysqlZipUrl -OutFile $mysqlZipPath
} else {
  Write-Step "[1/7] Reusing downloaded MySQL archive"
}

if (-not (Test-Path $mysqldExe)) {
  Write-Step "[2/7] Extracting portable MySQL..."
  Expand-Archive -LiteralPath $mysqlZipPath -DestinationPath $extractDir -Force
} else {
  Write-Step "[2/7] Reusing extracted MySQL runtime"
}

$state = $null
if (Test-Path $statePath) {
  $state = Get-Content $statePath -Raw | ConvertFrom-Json
}

if (-not $state) {
  $sourceEnv = Get-EnvMap (Join-Path $projectRoot ".env.production.local")
  if ($sourceEnv.Count -eq 0) {
    $sourceEnv = Get-EnvMap (Join-Path $projectRoot ".env")
  }

  $state = [pscustomobject]@{
    rootPassword = New-RandomSecret
    appDatabase = "gan_local"
    appUser = "gan_local"
    appPassword = New-RandomSecret
    appSecret = if ($sourceEnv.ContainsKey("APP_SECRET") -and $sourceEnv["APP_SECRET"]) { $sourceEnv["APP_SECRET"] } else { New-RandomSecret 64 }
    appId = if ($sourceEnv.ContainsKey("APP_ID") -and $sourceEnv["APP_ID"]) { $sourceEnv["APP_ID"] } else { "gan-app" }
    kimiApiKey = if ($sourceEnv.ContainsKey("KIMI_API_KEY")) { $sourceEnv["KIMI_API_KEY"] } else { "" }
    ownerUnionId = if ($sourceEnv.ContainsKey("OWNER_UNION_ID")) { $sourceEnv["OWNER_UNION_ID"] } else { "" }
  }
}

$configContent = @"
[mysqld]
basedir=$(($mysqlRoot -replace "\\","/"))
datadir=$(($dataDir -replace "\\","/"))
port=$Port
bind-address=127.0.0.1
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
default-time-zone=+00:00
max_connections=100
skip-name-resolve=0
log-error=$(($stderrLog -replace "\\","/"))
"@
Set-Content -Path $configPath -Value $configContent -Encoding ASCII

if (-not (Test-Path (Join-Path $dataDir "mysql"))) {
  Write-Step "[3/7] Initializing data directory..."
  New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
  & $mysqldExe "--defaults-file=$configPath" --initialize-insecure --console
  if ($LASTEXITCODE -ne 0) {
    throw "mysqld initialization failed"
  }
} else {
  Write-Step "[3/7] Reusing existing data directory"
}

if (-not (Wait-TcpPort -HostName "127.0.0.1" -PortNumber $Port -TimeoutSeconds 2)) {
  Write-Step "[4/7] Starting portable MySQL..."
  Start-PortableMysql
} else {
  Write-Step "[4/7] Portable MySQL is already running"
}

if (-not (Wait-TcpPort -HostName "127.0.0.1" -PortNumber $Port -TimeoutSeconds 30)) {
  throw "Portable MySQL failed to start. Check $stderrLog"
}

$rootPasswordEscaped = $state.rootPassword.Replace("'", "''")
$appPasswordEscaped = $state.appPassword.Replace("'", "''")
$dbName = $state.appDatabase
$appUser = $state.appUser
$verifyArgs = @(
  "--protocol=TCP",
  "-h", "127.0.0.1",
  "-P", "$Port",
  "-u", $appUser,
  "-e", "USE $dbName; SELECT 'ok' AS status;"
)

Write-Step "[5/7] Ensuring database and app user..."
$verifyResult = Invoke-MySql -Arguments $verifyArgs -Password $state.appPassword
if ($verifyResult.ExitCode -ne 0) {
  $bootstrapSql = @"
ALTER USER 'root'@'localhost' IDENTIFIED BY '$rootPasswordEscaped';
CREATE DATABASE IF NOT EXISTS $dbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$appUser'@'localhost' IDENTIFIED BY '$appPasswordEscaped';
CREATE USER IF NOT EXISTS '$appUser'@'127.0.0.1' IDENTIFIED BY '$appPasswordEscaped';
ALTER USER '$appUser'@'localhost' IDENTIFIED BY '$appPasswordEscaped';
ALTER USER '$appUser'@'127.0.0.1' IDENTIFIED BY '$appPasswordEscaped';
GRANT ALL PRIVILEGES ON $dbName.* TO '$appUser'@'localhost';
GRANT ALL PRIVILEGES ON $dbName.* TO '$appUser'@'127.0.0.1';
FLUSH PRIVILEGES;
"@
  Set-Content -Path $bootstrapPath -Value $bootstrapSql -Encoding ASCII

  Stop-PortableMysql
  Start-PortableMysql @("--init-file=$bootstrapPath")

  if (-not (Wait-TcpPort -HostName "127.0.0.1" -PortNumber $Port -TimeoutSeconds 30)) {
    throw "Portable MySQL bootstrap start failed. Check $stderrLog"
  }
}

$verifyResult = Invoke-MySql -Arguments $verifyArgs -Password $state.appPassword
if ($verifyResult.ExitCode -ne 0) {
  throw "Portable MySQL bootstrap failed. $($verifyResult.StdErr)"
}

Remove-Item $bootstrapPath -Force -ErrorAction SilentlyContinue

$envLocalPath = Join-Path $projectRoot ".env.local"
$databaseUrl = "mysql://$($state.appUser):$($state.appPassword)@127.0.0.1:$Port/$($state.appDatabase)"
$envContent = @(
  "APP_ID=$($state.appId)"
  "APP_SECRET=$($state.appSecret)"
  "DATABASE_URL=$databaseUrl"
  "KIMI_API_KEY=$($state.kimiApiKey)"
  "OWNER_UNION_ID=$($state.ownerUnionId)"
) -join "`r`n"

Set-Content -Path $envLocalPath -Value $envContent -Encoding ASCII
Set-Content -Path $statePath -Value ($state | ConvertTo-Json -Depth 4) -Encoding UTF8

Write-Step "[6/7] Writing .env.local"
Write-Step "[7/7] Verifying connection..."
$verifyResult = Invoke-MySql -Arguments $verifyArgs -Password $state.appPassword
if ($verifyResult.ExitCode -ne 0) {
  throw "Final connection verification failed. $($verifyResult.StdErr)"
}

if ($verifyResult.StdOut) {
  Write-Host $verifyResult.StdOut.Trim()
}

Write-Host ""
Write-Host "Portable MySQL is ready"
Write-Host "DATABASE_URL=$databaseUrl"
