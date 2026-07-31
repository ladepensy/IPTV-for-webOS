# Real TV workflow

## Register Developer Mode TV

Require the Mac and TV to share a reachable network. In the TV's LG Developer Mode app:

1. Enable **Dev Mode Status**.
2. Extend **Remain Session** when needed.
3. Enable **Key Server**.
4. Read the six-character case-sensitive passphrase.

Run `ares-setup-device`, add the TV, and use:

```text
port: 9922
user: prisoner
password: empty
```

Homebrew Channel does not replace this Developer Mode authorization flow.

Retrieve the key and verify the connection:

```bash
ares-novacom --device myTV --getkey
ares-device --system-info --device myTV
```

Never echo or record the passphrase or private key.

## Deploy manually

```bash
ares-package /absolute/path/to/app
ares-install --device myTV APP_ID_VERSION_all.ipk
ares-launch --device myTV APP_ID
ares-inspect --device myTV --app APP_ID --open
```

Confirm local config values are reachable from the TV. `localhost` and `127.0.0.1` refer to the TV after installation, not the developer computer.

## Troubleshoot

- Key retrieval failure: re-check IP, Key Server, session time, and passphrase case.
- Port failure: confirm `9922`, `prisoner`, same network, and no client isolation.
- Install failure: inspect package output, app ID/version, free space, and Developer Mode state.
- App launch failure: query running apps and use Inspector; do not assume install success implies launch success.

Official reference:

- https://webostv.developer.lge.com/develop/getting-started/developer-mode-app
