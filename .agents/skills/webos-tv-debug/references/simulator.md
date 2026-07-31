# Simulator workflow

## Launch

Validate the project first. A Simulator launch uses source files directly; it does not require an IPK.

```bash
ares-launch --simulator 25 /absolute/path/to/app
```

When the Simulator is outside the SDK search directory:

```bash
ares-launch --simulator 25 \
  --simulator-path /absolute/path/to/webOS_TV_25_Simulator_1.4.4 \
  /absolute/path/to/app
```

The explicit path is the extracted Simulator directory containing the platform-specific executable or `.app`, not the app source directory.

## Verify

Do not stop at the CLI message. Verify that:

1. The Simulator process exists.
2. Its process arguments contain the intended app directory.
3. The UI shows the expected app and data state.
4. Inspector has no unexpected JavaScript or network failures.

Open Inspector with **Tools > Inspector** or the RCU **Inspect** button. Inspect Console, Network, the `<video>` element, and application storage.

## Scope

Use Simulator for layout, focus, remote keys, lifecycle, M3U parsing, network requests, and supported webOS APIs. Do not use it as the final authority for MPEG-TS, HEVC, 4K, HDR, audio codecs, hardware decoding, or long-running playback.

Official references:

- https://webostv.developer.lge.com/develop/tools/simulator-installation
- https://webostv.developer.lge.com/develop/tools/simulator-dev-guide
