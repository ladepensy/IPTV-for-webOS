#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9]+(?:\.[0-9]+)*$')]
    [string]$Version,

    [string]$AppDir = (Get-Location).Path,

    [string]$SimulatorDir
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

$resolvedAppDir = (Resolve-Path -LiteralPath $AppDir -ErrorAction Stop).Path
$checkScript = Join-Path $PSScriptRoot 'check-webos-project.ps1'
& $checkScript -AppDir $resolvedAppDir

$aresLaunch = Resolve-WebOsCommand 'ares-launch'
if (-not $aresLaunch) { throw 'ares-launch is not installed or is not available to PowerShell 7.' }

$launchArgs = @('--simulator', $Version)
if ($SimulatorDir) {
    $resolvedSimulatorDir = (Resolve-Path -LiteralPath $SimulatorDir -ErrorAction Stop).Path
    $launchArgs += @('--simulator-path', $resolvedSimulatorDir)
}
$launchArgs += $resolvedAppDir

& $aresLaunch @launchArgs
if ($LASTEXITCODE -ne 0) { throw "Simulator launch failed with exit code $LASTEXITCODE." }
