# Windows workflow

Use this reference on Windows. Read `privacy.md` first. PowerShell 7 is the canonical Windows shell for this skill; do not route commands through Git Bash, WSL, or Windows PowerShell 5.1 unless the user explicitly asks.

## Start PowerShell 7

Verify the active major version before doing project or device work:

```powershell
if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw 'PowerShell 7 or newer is required. Start pwsh and retry.'
}
```

When `pwsh` is installed but the current terminal is Windows PowerShell, start it explicitly:

```powershell
& 'C:\Program Files\PowerShell\7\pwsh.exe' -NoProfile
```

## Prerequisites and CLI discovery

Install Node.js LTS, LG webOS CLI, and the LG webOS TV Simulator when Simulator testing is needed:

```powershell
npm install --global @webos-tools/cli
ares --version
ares-launch --version
ares-package --version
```

If npm's global command directory is not on the active PATH, add it only to the current PowerShell process, then verify commands without reporting the expanded account-bearing path:

```powershell
$npmCommandDir = Join-Path $env:APPDATA 'npm'
if ($env:Path -notlike "*$npmCommandDir*") {
    $env:Path = "$npmCommandDir;$env:Path"
}
Get-Command ares-launch, ares-package, ares-install, ares-device
```

The CLI requires a modern Node.js runtime. If `ares-package` reports a missing `node:*` module, verify `node --version` before changing the project.

## Local configuration

Create the ignored local configuration without printing its contents:

```powershell
Copy-Item -LiteralPath .\config.example.js -Destination .\config.js
```

Verify the configured playlist and media endpoints are reachable from the target. On a real TV, `localhost` and `127.0.0.1` refer to the TV, not the Windows host.

## Validate and run a Simulator

Validate from the app directory:

```powershell
& .\.agents\skills\webos-tv-debug\scripts\check-webos-project.ps1 -AppDir .
```

If the Simulator is installed in the CLI default location:

```powershell
& .\.agents\skills\webos-tv-debug\scripts\run-simulator.ps1 -Version 25 -AppDir .
```

Otherwise, pass the verified extracted Simulator directory containing its Windows executable:

```powershell
& .\.agents\skills\webos-tv-debug\scripts\run-simulator.ps1 `
    -Version 25 `
    -AppDir . `
    -SimulatorDir $env:WEBOS_SIMULATOR_DIR
```

Treat Simulator discovery, process launch, and app launch as separate outcomes. For a privacy-safe process check, inspect only the needed fields and do not report account-bearing command-line paths:

```powershell
Get-CimInstance Win32_Process |
    Where-Object Name -Like '*Simulator*.exe' |
    Select-Object Name, ProcessId
```

## Deploy to a real TV

Register the Developer Mode TV with `ares-setup-device`. Use port `9922`, user `prisoner`, and an empty SSH password. Keep **Dev Mode Status**, **Key Server**, and the session lifetime active. Retrieve the key without echoing its passphrase:

```powershell
ares-novacom --device myTV --getkey
ares-device --device myTV --system-info
```

After the user explicitly authorizes installation and launch, use the native deployment script:

```powershell
& .\.agents\skills\webos-tv-debug\scripts\deploy-to-tv.ps1 -Device myTV -AppDir .
```

Add `-Inspect` only when opening the Inspector is requested. The script validates, packages to a private temporary directory, closes the old instance, installs the same-version IPK, launches, verifies the running state, and removes the temporary package. It never rewrites `appinfo.json` and does not uninstall the existing app.

If installation is rejected because the installed version differs, stop and report it. Uninstalling can erase app-local data and requires explicit authorization; follow `real-device.md` for that fallback.

## Common Windows failures

- A script is rejected by execution policy: run it in PowerShell 7 with a process-scoped policy only if the user permits, for example `Set-ExecutionPolicy -Scope Process Bypass`; do not change the machine policy automatically.
- `ares-launch` requests `--simulator-path`: provide the verified extracted Simulator directory, not the ZIP or app source directory.
- `ares-package` reports a missing `node:*` module: upgrade Node.js LTS and open a fresh PowerShell 7 session.
- Install succeeds but old code appears: close the old instance, reinstall the same-version IPK, relaunch, and verify running state. Do not modify `appinfo.json` merely to force an update.
- Key retrieval fails: verify Developer Mode status, Key Server, session expiry, port `9922`, user `prisoner`, network reachability, and passphrase case.
- The playlist loads but video fails in Simulator: inspect `MediaError`, container, codec, and network state; do not infer a network failure solely from Simulator media limitations.
