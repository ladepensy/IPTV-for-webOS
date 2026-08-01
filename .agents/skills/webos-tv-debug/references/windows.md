# Windows workflow

Use this reference on Windows. Read `privacy.md` first. Prefer Git Bash for webOS CLI work and bundled shell scripts; use PowerShell only for Windows-specific discovery or process inspection.

## Shell selection

Use Git for Windows Bash, normally installed at:

```text
C:\Program Files\Git\bin\bash.exe
```

Do not use `C:\Windows\System32\bash.exe`; that executable launches WSL and is not Git Bash. When the active orchestration shell is PowerShell, start Git Bash explicitly and run the workflow inside it:

```powershell
& 'C:\Program Files\Git\bin\bash.exe' -lc 'cd /d/path/to/app && scripts/check-webos-project.sh .'
```

Keep every bundled `.sh` file LF-only. A failure containing `$'\r'`, `set: -\r`, or `do\r` means the script has CRLF line endings; normalize the repository-owned script before retrying.

## Prerequisites

Install:

- Git for Windows
- Node.js LTS
- LG webOS TV Simulator for Windows when Simulator testing is needed
- LG webOS CLI

Use a fresh Git Bash session after installing Node.js so PATH changes are visible:

```bash
npm install -g @webos-tools/cli
ares --version
ares-launch --version
ares-package --version
```

The current CLI requires a modern Node.js runtime. If `ares-package` fails with a missing `node:*` module, check `node --version` before changing the project.

## Local configuration

Create the ignored local configuration from the public template. Do not print it or include it in logs, screenshots, packages for sharing, or commits.

```bash
APP_DIR=$(pwd -P)
cp "$APP_DIR/config.example.js" "$APP_DIR/config.js"
```

Verify the configured playlist and media endpoints are reachable from the target. For a real TV, `localhost` and `127.0.0.1` refer to the TV, not the Windows host.

## Download and install Simulator

Download the Windows Simulator ZIP from LG's official Simulator Installation page and save it under a bounded, user-selected directory such as `$SIMULATOR_ROOT`. Unzip it so the extracted directory contains the platform executable, for example:

```text
$SIMULATOR_ROOT\webOS_TV_25_Simulator_1.4.4\webOS_TV_25_Simulator_1.4.4.exe
```

Do not treat the ZIP file, the app source directory, or a parent directory without the executable as `--simulator-path`.

## Validate and launch from Git Bash

Validate before every launch or deployment:

```bash
APP_DIR=$(pwd -P)
scripts/check-webos-project.sh "$APP_DIR"
```

Launch a Simulator from Git Bash:

```bash
APP_DIR=$(pwd -P)
: "${WEBOS_SIMULATOR_ROOT:?Set WEBOS_SIMULATOR_ROOT to the verified Simulator root first.}"
SIMULATOR_DIR="$WEBOS_SIMULATOR_ROOT/webOS_TV_25_Simulator_1.4.4"

ares-launch \
  --simulator 25 \
  --simulator-path "$SIMULATOR_DIR" \
  "$APP_DIR"
```

If the Simulator is installed in the CLI's default search location, omit `--simulator-path`. Treat Simulator discovery, process launch, and app launch as separate outcomes.

Use PowerShell only when Windows-native process verification is needed:

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -like '*Simulator*.exe' } |
  Select-Object Name, ProcessId, CommandLine
```

Only inspect or report sanitized process information. Do not expose account-bearing paths or app configuration contents.

## Real TV from Git Bash

Register the TV with the Developer Mode defaults:

```bash
ares-setup-device
```

Use port `9922`, user `prisoner`, and an empty SSH password. Keep the TV's Developer Mode **Dev Mode Status**, **Key Server**, and session lifetime active. Retrieve the key without echoing the passphrase:

```bash
ares-novacom --device myTV --getkey
ares-device --device myTV --system-info
```

Prefer the bundled deployment script after explicit user authorization:

```bash
APP_DIR=$(pwd -P)
DEVICE=myTV
scripts/deploy-to-tv.sh "$DEVICE" "$APP_DIR"
```

For manual diagnosis, keep package, install, launch, running-state verification, and Inspector as distinct steps. Close an old running instance before reinstalling a changed package, and preserve the existing `appinfo.json` version during routine real-TV testing. See `real-device.md` for the clean-reinstall fallback and its data-loss guardrail.

```bash
TASK_TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/webos-manual.XXXXXX")
trap 'rm -rf -- "$TASK_TMP_DIR"' EXIT
ares-package . --outdir "$TASK_TMP_DIR"
ares-launch --close APP_ID --device "$DEVICE" || true
ares-install --device "$DEVICE" "$TASK_TMP_DIR/APP_ID_VERSION_all.ipk"
ares-launch --device "$DEVICE" APP_ID
sleep 5
ares-launch --running --device "$DEVICE"
```

Do not install, remove, or launch on a real TV unless the user requested that state change.

## Common Windows failures

- `ares-launch` requests `--simulator-path`: the requested Simulator version was not found in CLI defaults; provide the verified extracted directory.
- A bundled script reports `$'\r'` or `set: -\r`: its line endings are CRLF; convert the repository-owned `.sh` file to LF and preserve it with `.gitattributes`.
- `ares-package` reports a missing `node:*` module: the active Node.js runtime is too old; upgrade Node.js LTS and open a new Git Bash session.
- Install reports success but the TV still shows old code: verify the generated IPK filename, close the old instance, reinstall the same-version IPK, relaunch, and confirm the running state. Do not change `appinfo.json` automatically; use the explicitly authorized clean-reinstall fallback from `real-device.md` if needed.
- Key retrieval fails: verify Developer Mode status, Key Server, session expiry, port `9922`, user `prisoner`, network reachability, and passphrase case.
- The playlist loads but video fails in Simulator: inspect `MediaError`, container, codec, and network state; do not infer a network failure solely from Simulator media limitations.
