#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Device,

    [string]$AppDir = (Get-Location).Path,

    [switch]$Inspect
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Resolve-WebOsCommand {
    param([Parameter(Mandatory)][string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { return $command.Source }
    if ($IsWindows -and $env:APPDATA) {
        $npmCommand = Join-Path $env:APPDATA "npm\$Name.cmd"
        if (Test-Path -LiteralPath $npmCommand -PathType Leaf) { return $npmCommand }
    }
    return $null
}

function Invoke-WebOsPrivate {
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][object[]]$Arguments,
        [Parameter(Mandatory)][string]$Phase,
        [switch]$AllowFailure
    )

    $output = & $Command @Arguments 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0 -and -not $AllowFailure) {
        throw "$Phase failed with exit code $exitCode. Raw output was hidden because it may contain private device or network data."
    }
    return [pscustomobject]@{ ExitCode = $exitCode; Output = $output }
}

$resolvedAppDir = (Resolve-Path -LiteralPath $AppDir -ErrorAction Stop).Path
$checkScript = Join-Path $PSScriptRoot 'check-webos-project.ps1'
& $checkScript -AppDir $resolvedAppDir

$commands = @{}
foreach ($commandName in @('ares-device', 'ares-package', 'ares-install', 'ares-launch')) {
    $commands[$commandName] = Resolve-WebOsCommand $commandName
    if (-not $commands[$commandName]) { throw "Missing command: $commandName" }
}
if ($Inspect) {
    $commands['ares-inspect'] = Resolve-WebOsCommand 'ares-inspect'
    if (-not $commands['ares-inspect']) { throw 'Missing command: ares-inspect' }
}

$manifest = Get-Content -LiteralPath (Join-Path $resolvedAppDir 'appinfo.json') -Raw | ConvertFrom-Json
$appId = [string]$manifest.id
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$taskTempDir = Join-Path $tempRoot ("webos-tv-debug-{0}" -f [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskTempDir | Out-Null

try {
    Write-Output 'Checking authorized TV connection (details hidden)...'
    Invoke-WebOsPrivate -Command $commands['ares-device'] -Arguments @('--system-info', '--device', $Device) -Phase 'Device check' | Out-Null
    Write-Output 'Device check: successful'

    Write-Output "Packaging $appId without changing appinfo.json version..."
    Invoke-WebOsPrivate -Command $commands['ares-package'] -Arguments @($resolvedAppDir, '--outdir', $taskTempDir) -Phase 'Packaging' | Out-Null
    $packages = @(Get-ChildItem -LiteralPath $taskTempDir -Filter '*.ipk' -File)
    if ($packages.Count -ne 1) { throw 'Packaging did not create exactly one IPK in the temporary directory.' }
    Write-Output 'Packaging: successful (temporary IPK kept private)'

    Invoke-WebOsPrivate -Command $commands['ares-launch'] -Arguments @('--device', $Device, '--close', $appId) -Phase 'Closing old instance' -AllowFailure | Out-Null
    Write-Output 'Old running instance: closed or not running'

    Invoke-WebOsPrivate -Command $commands['ares-install'] -Arguments @('--device', $Device, $packages[0].FullName) -Phase 'Installation' | Out-Null
    Write-Output 'Installation: successful'

    Invoke-WebOsPrivate -Command $commands['ares-launch'] -Arguments @('--device', $Device, $appId) -Phase 'Launch' | Out-Null
    Write-Output 'Launch request: successful'

    $running = Invoke-WebOsPrivate -Command $commands['ares-launch'] -Arguments @('--running', '--device', $Device) -Phase 'Running-state verification'
    if ($running.Output -notmatch [regex]::Escape($appId)) {
        throw 'The launch command succeeded, but the app was not found in the sanitized running-state check.'
    }
    Write-Output 'Running-state verification: successful'

    if ($Inspect) {
        & $commands['ares-inspect'] --device $Device --app $appId --open
        if ($LASTEXITCODE -ne 0) { throw "Inspector launch failed with exit code $LASTEXITCODE." }
    }
} finally {
    if (Test-Path -LiteralPath $taskTempDir) {
        $resolvedTempDir = [IO.Path]::GetFullPath($taskTempDir)
        $leaf = Split-Path -Leaf $resolvedTempDir
        if ($resolvedTempDir.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and $leaf -like 'webos-tv-debug-*') {
            Remove-Item -LiteralPath $resolvedTempDir -Recurse -Force
        } else {
            Write-Warning 'Temporary package directory was not removed because its path failed the safety check.'
        }
    }
}
