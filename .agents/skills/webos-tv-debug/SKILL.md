---
name: webos-tv-debug
description: Run, inspect, deploy, and diagnose webOS TV web apps on LG webOS TV Simulators and Developer Mode televisions. Use for ares CLI setup, explicit Simulator paths, appinfo validation, packaging and IPK installation, Developer Mode SSH/key setup, Web Inspector, remote-control testing, or media failures such as MediaError code 4 and DEMUXER_ERROR_COULD_NOT_OPEN.
---

# webOS TV Debug

Diagnose the target first, then use the smallest workflow that proves the requested outcome.

## Workflow

1. Locate the app directory containing `appinfo.json`. Preserve unrelated and untracked files.
2. Run `scripts/check-webos-project.sh APP_DIR` before launch or deployment.
3. Select one path:
   - For Simulator work, read `references/simulator.md` and use `scripts/run-simulator.sh` when its arguments fit.
   - For a real TV, read `references/real-device.md`. Run `scripts/deploy-to-tv.sh` only when the user asked to install or launch on that TV.
   - For playback failures, also read `references/media-diagnostics.md` before changing application code.
4. Verify the actual outcome: process arguments and rendered app for Simulator; device info, install result, launch result, and Inspector for TV.
5. Report Simulator results separately from real-TV media conclusions.

## Guardrails

- Never print or commit private playlist URLs, tokens, passphrases, SSH keys, or the contents of local `config.js` files. Report only sanitized protocol, response type, status, and capability data.
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
