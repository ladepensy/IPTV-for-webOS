---
name: webos-tv-debug
description: Run, inspect, deploy, and diagnose webOS TV web apps on LG webOS TV Simulators and Developer Mode televisions with privacy-safe environment discovery, Windows Git Bash-first workflows, and redacted diagnostics. Use for ares CLI setup, Simulator discovery and explicit paths, appinfo validation, packaging and IPK installation, Developer Mode SSH/key setup, Web Inspector, screenshots, remote-control testing, or media failures such as MediaError code 4 and DEMUXER_ERROR_COULD_NOT_OPEN.
---

# webOS TV Debug

Diagnose the target first, then use the smallest workflow that proves the requested outcome. Privacy is a hard prerequisite, not a reporting preference: if the privacy gate cannot be completed, stop before discovery, launch, packaging, deployment, screenshots, Inspector access, or external reporting.

## Workflow

1. **Mandatory privacy gate:** read `references/privacy.md` completely. Establish the allowed project, Simulator, device, log, screenshot, network, and artifact scope before inspecting or launching anything. Confirm that private URLs, configuration, credentials, device identifiers, logs, screenshots, and IPKs will stay local and redacted. If any item is unknown, pause and resolve it before continuing.
2. Locate the app directory containing `appinfo.json` from the current working directory or workspace root. Preserve unrelated and untracked files. Never infer the app location from this Skill's own absolute path, and never reuse a remembered machine-specific path without verifying it locally.
3. Run `scripts/check-webos-project.sh APP_DIR` before launch or deployment.
4. If the host is Windows, read `references/windows.md`. Prefer **Git Bash for Windows** for project validation, bundled `.sh` scripts, webOS CLI commands, packaging, installation, and launch. Use PowerShell only for Windows-only process inspection, path discovery, or when Git Bash is unavailable. Never confuse the WSL launcher at `C:\Windows\System32\bash.exe` with Git Bash. Then select one path:
   - For Simulator work, read `references/simulator.md` and use `scripts/run-simulator.sh` when its arguments fit.
   - For a real TV, read `references/real-device.md`. Run `scripts/deploy-to-tv.sh` only when the user asked to install or launch on that TV.
   - For playback failures, also read `references/media-diagnostics.md` before changing application code.
5. Verify the actual outcome with the least revealing evidence: process and accessibility state before screenshots; sanitized device/Inspector data before raw logs.
6. Report Simulator results separately from real-TV media conclusions, including what local or remote network requests the app initiated.

## Required privacy checks

Run these checks before each consequential phase and again before any commit, upload, screenshot handoff, or user-facing report:

- **Before discovery:** scope roots and targets; do not scan beyond bounded project, SDK, and user-provided locations.
- **Before launch or deployment:** confirm local configuration exists only where intended, endpoints are categorized without printing them, and real-TV state changes are explicitly authorized.
- **Before logs or screenshots:** prefer sanitized process/accessibility evidence; if visual capture is necessary, warn that visible content enters the task context and redact private content.
- **Before packaging or sharing:** inspect only metadata needed for validation; never expose or publish `config.js`, private URLs, headers, cookies, tokens, passphrases, keys, raw logs, or IPKs containing them.
- **Before reporting or committing:** search the proposed output/diff for account-bearing paths, IP addresses, hostnames, query strings, credentials, and raw diagnostic content. Remove or replace them with placeholders and categories.

Failure of any check is a hard stop. Do not continue by assumption, and do not claim success from an earlier lifecycle step.

## Guardrails

- Never print, transmit, screenshot, package for sharing, or commit private playlist/channel URLs, query values, headers, cookies, tokens, passphrases, SSH keys, device IPs, or local configuration contents.
- Treat `config.js`, Inspector output, screenshots, media errors, IPKs, and terminal history as potentially sensitive. Apply `references/privacy.md` before exposing any of them.
- Search only user-provided roots, the current workspace, CLI defaults, and bounded platform install locations. Never recursively scan an entire home directory to discover a Simulator.
- Never render an account-bearing absolute path in user-facing prose or code blocks. Use unexpanded `$APP_DIR`, `$SIMULATOR_DIR`, repository-relative paths, or `~/...`; summarize tool output that exposes a username.
- Before capturing a GUI screenshot, state that visible app content will enter the current Codex task context. Prefer process checks and accessibility text when they prove the result.
- Treat Simulator launch, package creation, installation, launch, and Inspector as distinct steps. Do not claim later steps succeeded from an earlier command.
- Do not diagnose a reachable `video/mp2t` stream as a network failure merely because Simulator playback fails.
- Do not install, remove, or launch an app on a real TV unless the user requested that state change.
- Preserve the existing `appinfo.json` version during real-TV testing and deployment. Never change the local version solely to force an install or bypass caching; change it only when the user explicitly requests a version change or release.
- Keep Developer Mode port `9922` and user `prisoner` distinct from emulator defaults.
- Prefer explicit `--simulator-path` when the Simulator is outside the SDK search directory.
- On Windows, keep bundled `.sh` files LF-only and run them with the verified Git for Windows `bash.exe`. If Bash reports `$'\r'` or `set: -\r`, fix the repository-owned script line endings before retrying rather than repeatedly wrapping the script at runtime.

## Bundled scripts

- `scripts/check-webos-project.sh APP_DIR`: validate the manifest, entry point, icons, config state, CLI commands, and device profile without exposing secrets.
- `scripts/run-simulator.sh VERSION APP_DIR [SIMULATOR_DIR]`: launch a validated app on the requested Simulator version.
- `scripts/deploy-to-tv.sh DEVICE APP_DIR [--inspect]`: verify the TV connection, package into a temporary directory, install, launch, and optionally open Inspector.

Read a script before modifying it for an unusual project layout. Run representative scripts after edits.
