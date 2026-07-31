# Windows workflow

Use this reference when the host is Windows PowerShell. Read `privacy.md` first, then validate the app before launching or packaging it.

## Prerequisites

Install:

- Node.js LTS
- LG webOS TV Simulator for Windows when Simulator testing is needed
- LG webOS CLI

Use a fresh PowerShell session after installing Node.js so PATH changes are visible:

```powershell
npm install -g @webos-tools/cli
ares --version
ares-launch --version
ares-package --version
```

The current CLI requires a modern Node.js runtime. If `ares-package` fails with a missing `node:*` module, check `node --version` before changing the project.

## Local configuration

Create the ignored local configuration from the public template. Do not print it or include it in logs, screenshots, packages for sharing, or commits.

```powershell
$APP_DIR = (Get-Location).Path
Copy-Item "$APP_DIR\config.example.js" "$APP_DIR\config.js"
```

Verify the configured playlist and media endpoints are reachable from the target. For a real TV, `localhost` and `127.0.0.1` refer to the TV, not the Windows host.

## Download and install Simulator

Download the Windows Simulator ZIP from LG's official Simulator Installation page and save it under a bounded, user-selected directory such as `$SIMULATOR_ROOT`. Unzip it so the extracted directory contains the platform executable, for example:

```text
$SIMULATOR_ROOT\webOS_TV_25_Simulator_1.4.4\webOS_TV_25_Simulator_1.4.4.exe
```

Do not treat the ZIP file, the app source directory, or a parent directory without the executable as `--simulator-path`.

## Launch from PowerShell

```powershell
$APP_DIR = (Get-Location).Path
$SIMULATOR_ROOT = $env:WEBOS_SIMULATOR_ROOT
if (-not $SIMULATOR_ROOT) { throw "Set WEBOS_SIMULATOR_ROOT to the verified Simulator root first." }
$SIMULATOR_DIR = Join-Path $SIMULATOR_ROOT "webOS_TV_25_Simulator_1.4.4"

ares-launch `
  --simulator 25 `
  --simulator-path $SIMULATOR_DIR `
  $APP_DIR
```

If the Simulator is installed in the CLI's default search location, omit `--simulator-path`. Treat Simulator discovery, process launch, and app launch as separate outcomes.

Process verification:

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -like '*Simulator*.exe' } |
  Select-Object Name, ProcessId, CommandLine
```

Only inspect or report sanitized process information. Do not expose account-bearing paths or app configuration contents.

## Real TV from Windows

Register the TV with the Developer Mode defaults:

```powershell
ares-setup-device
```

Use port `9922`, user `prisoner`, and an empty SSH password. Keep the TV's Developer Mode **Dev Mode Status**, **Key Server**, and session lifetime active. Retrieve the key without echoing the passphrase:

```powershell
ares-novacom --device myTV --getkey
ares-device --device myTV --system-info
```

Package, install, launch, and inspect as distinct steps:

```powershell
ares-package .
ares-install --device myTV .\APP_ID_VERSION_all.ipk
ares-launch --device myTV APP_ID
ares-inspect --device myTV --app APP_ID --open
```

Do not install, remove, or launch on a real TV unless the user requested that state change.

## Common Windows failures

- `ares-launch` requests `--simulator-path`: the requested Simulator version was not found in CLI defaults; provide the verified extracted directory.
- `ares-package` reports a missing `node:*` module: the active Node.js runtime is too old; upgrade Node.js LTS and open a new PowerShell session.
- Key retrieval fails: verify Developer Mode status, Key Server, session expiry, port `9922`, user `prisoner`, network reachability, and passphrase case.
- The playlist loads but video fails in Simulator: inspect `MediaError`, container, codec, and network state; do not infer a network failure solely from Simulator media limitations.
