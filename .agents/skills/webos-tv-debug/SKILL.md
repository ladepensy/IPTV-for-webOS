---
name: webos-tv-debug
description: Run, inspect, deploy, and diagnose webOS TV web apps on LG webOS TV Simulators and Developer Mode televisions with privacy-safe environment discovery and redacted diagnostics. Use for ares CLI setup, Simulator discovery and explicit paths, appinfo validation, packaging and IPK installation, Developer Mode SSH/key setup, Web Inspector, screenshots, remote-control testing, or media failures such as MediaError code 4 and DEMUXER_ERROR_COULD_NOT_OPEN.
---

# webOS TV Debug

Diagnose the target first, then use the smallest workflow that proves the requested outcome.

## Workflow

1. Read `references/privacy.md`. Establish the allowed project, Simulator, device, log, and screenshot scope before inspecting or launching anything.
2. Locate the app directory containing `appinfo.json` from the current working directory or workspace root. Preserve unrelated and untracked files. Never infer the app location from this Skill's own absolute path, and never reuse a remembered machine-specific path without verifying it locally.
3. Run `scripts/check-webos-project.sh APP_DIR` before launch or deployment.
4. If the host is Windows PowerShell, read `references/windows.md` for the host setup, CLI, download, path, and device-command conventions. Then select one path:
   - For Simulator work, read `references/simulator.md` and use `scripts/run-simulator.sh` when its arguments fit.
   - For a real TV, read `references/real-device.md`. Run `scripts/deploy-to-tv.sh` only when the user asked to install or launch on that TV.
   - For playback failures, also read `references/media-diagnostics.md` before changing application code.
5. Verify the actual outcome with the least revealing evidence: process and accessibility state before screenshots; sanitized device/Inspector data before raw logs.
6. Report Simulator results separately from real-TV media conclusions, including what local or remote network requests the app initiated.

## Guardrails

- Never print, transmit, screenshot, package for sharing, or commit private playlist/channel URLs, query values, headers, cookies, tokens, passphrases, SSH keys, device IPs, or local configuration contents.
- Treat `config.js`, Inspector output, screenshots, media errors, IPKs, and terminal history as potentially sensitive. Apply `references/privacy.md` before exposing any of them.
- Search only user-provided roots, the current workspace, CLI defaults, and bounded platform install locations. Never recursively scan an entire home directory to discover a Simulator.
- Never render an account-bearing absolute path in user-facing prose or code blocks. Use unexpanded `$APP_DIR`, `$SIMULATOR_DIR`, repository-relative paths, or `~/...`; summarize tool output that exposes a username.
- Before capturing a GUI screenshot, state that visible app content will enter the current Codex task context. Prefer process checks and accessibility text when they prove the result.
- Treat Simulator launch, package creation, installation, launch, and Inspector as distinct steps. Do not claim later steps succeeded from an earlier command.
- Do not diagnose a reachable `video/mp2t` stream as a network failure merely because Simulator playback fails.
- Do not install, remove, or launch an app on a real TV unless the user requested that state change.
- Keep Developer Mode port `9922` and user `prisoner` distinct from emulator defaults.
- Prefer explicit `--simulator-path` when the Simulator is outside the SDK search directory.

## Bundled scripts

- `scripts/check-webos-project.sh APP_DIR`: validate the manifest, entry point, icons, config state, CLI commands, and device profile without exposing secrets.
- `scripts/run-simulator.sh VERSION APP_DIR [SIMULATOR_DIR]`: launch a validated app on the requested Simulator version.
- `scripts/deploy-to-tv.sh DEVICE APP_DIR [--inspect]`: verify the TV connection, package into a temporary directory, install, launch, and optionally open Inspector.

Read a script before modifying it for an unusual project layout. Run representative scripts after edits.
