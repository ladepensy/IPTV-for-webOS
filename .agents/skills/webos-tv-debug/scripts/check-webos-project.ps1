#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$AppDir
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Resolve-WebOsCommand {
    param([Parameter(Mandatory)][string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) {
        return $command.Source
    }

    if ($IsWindows -and $env:APPDATA) {
        $npmCommand = Join-Path $env:APPDATA "npm\$Name.cmd"
        if (Test-Path -LiteralPath $npmCommand -PathType Leaf) {
            return $npmCommand
        }
    }

    return $null
}

$resolvedAppDir = (Resolve-Path -LiteralPath $AppDir -ErrorAction Stop).Path
$manifestPath = Join-Path $resolvedAppDir 'appinfo.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw 'Missing appinfo.json in the app directory.'
}

try {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
} catch {
    throw "appinfo.json is not valid JSON: $($_.Exception.Message)"
}

foreach ($field in @('id', 'version', 'type', 'main', 'title')) {
    if (-not $manifest.PSObject.Properties[$field] -or [string]::IsNullOrWhiteSpace([string]$manifest.$field)) {
        throw "appinfo.json is missing $field."
    }
}

if ($manifest.type -ne 'web') {
    throw "Unsupported app type '$($manifest.type)'; expected 'web'."
}

foreach ($field in @('main', 'icon', 'largeIcon')) {
    $property = $manifest.PSObject.Properties[$field]
    if ($property -and -not [string]::IsNullOrWhiteSpace([string]$property.Value)) {
        $referencedPath = Join-Path $resolvedAppDir ([string]$property.Value)
        if (-not (Test-Path -LiteralPath $referencedPath -PathType Leaf)) {
            throw "appinfo.json references a missing $field file."
        }
    }
}

Write-Output "App: $($manifest.id) $($manifest.version)"
Write-Output "Title: $($manifest.title)"
Write-Output "Type: $($manifest.type)"
Write-Output "Main: $($manifest.main)"
if (Test-Path -LiteralPath (Join-Path $resolvedAppDir 'config.js') -PathType Leaf) {
    Write-Output 'Local config: present (contents hidden)'
} else {
    Write-Output 'Local config: absent'
}

foreach ($commandName in @('ares-launch', 'ares-package', 'ares-install', 'ares-inspect', 'ares-device')) {
    if (Resolve-WebOsCommand $commandName) {
        Write-Output "${commandName}: available"
    } else {
        Write-Output "${commandName}: missing"
    }
}

$aresConfig = Resolve-WebOsCommand 'ares-config'
if ($aresConfig) {
    Write-Output 'webOS CLI profile command: available (details hidden)'
}
