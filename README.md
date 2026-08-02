# IPTV for webOS

English | [Simplified Chinese](README.zh-CN.md)

*A lightweight IPTV player built for LG webOS TV.*

The app fetches M3U playlists from any accessible HTTP or HTTPS source and plays their channels through the TV's native media capabilities.

## Screenshots

Captured at 1920×1080 in the webOS TV 25 Simulator. The channels, groups, logos, and programme titles come from a fictional demo playlist, and the backdrop behind the interface is a synthetic still frame rather than a decoded broadcast stream.

Now playing information with channel logo, group, playback resolution, and current programme progress:

![Now playing panel](docs/screenshots/now-playing.png)

Channel browser focused on the channel list, with the TV guide for the focused channel:

![Channel browser with channel list and TV guide](docs/screenshots/channels.png)

The full three-column browser for sources, groups, and channels:

![Three-column browser for sources, groups, and channels](docs/screenshots/channel-browser.png)

## Features

- Configure any M3U source through a local configuration file.
- Add, edit, and delete up to 10 playlist sources directly on the TV, with the most recently used source remembered.
- Configure request methods, headers, credentials, and request bodies.
- Parse channel names, groups, logos, and playback URLs.
- Resolve channel URLs relative to the playlist URL.
- Keep video full screen while showing an on-demand three-column browser for sources, groups, and channels.
- Shift the channel browser with the active column and show current and upcoming programmes for the focused channel.
- Discover XMLTV guides from the M3U `x-tvg-url` attribute, with an optional configuration override.
- Resume the last selected channel on startup, or play the first channel when no valid history exists.
- Hide the interface after five seconds without remote or Magic Remote activity while playback continues.
- Use Enact Spotlight for TV focus, 5-way navigation, and focus restoration.
- Support mouse input for browser and Simulator development.
- Match the system language at startup. English, Simplified Chinese, Traditional Chinese, Japanese, and Korean are supported; unsupported languages fall back to English.
- Play HTTP media streams, including streams exposed by rtp2httpd, through the native `<video>` element.
- Coalesce rapid channel changes so only the final request rebuilds the media connection.
- Delay the compact loading indicator during ordinary channel changes so the last rendered frame is not immediately covered.
- Enable a lower-composition-cost visual mode automatically on physical webOS TVs.
- Target 1920×1080 while remaining usable in smaller development windows.

## Project structure

```text
.
├── appinfo.json   # webOS application manifest
├── index.html     # Vite entry point and player shell
├── styles.css     # Global TV interface styles
├── src/
│   ├── core/      # TypeScript M3U, XMLTV, source, and browser state logic
│   ├── i18n/      # Locales, system-language matching, and formatting
│   ├── ui/        # React channel browser, source form, and Spotlight adapter
│   └── main.tsx   # Integration layer for the new core/UI and legacy controller
├── features/
│   ├── channels/
│   │   └── channel-panel.css
│   └── sources/
│       └── source-form.css
├── interaction.js # Interaction state machine and event transitions
├── app.js         # HTMLVideoElement playback and webOS side effects
├── vite.config.ts # Web build and webOS asset copying
├── dist/          # Generated deployable webOS app; not committed
├── docs/
│   ├── interaction-design.md
│   └── screenshots/  # Interface screenshots used by the README
├── config.example.js
├── icon.png
├── largeIcon.png
└── tests/
    ├── interaction.test.js
    └── channel-panel.test.js
```

## Development environment

Recommended tools:

- [Visual Studio Code](https://code.visualstudio.com/)
- LG's official webOS Studio extension
- webOS TV 25 Simulator
- LG webOS CLI

See [LG webOS TV Simulator Installation](https://webostv.developer.lge.com/develop/tools/simulator-installation) for Simulator downloads and requirements.

Install the official LG webOS CLI:

```bash
npm install -g @webos-tools/cli
ares-config --profile tv
ares-launch --version
```

## Local development

Install dependencies:

```bash
corepack enable
corepack install
pnpm install
```

If the current terminal still cannot find `pnpm`, close and reopen PowerShell before trying again.

Create a local-only configuration file:

```bash
cp config.example.js config.js
```

Edit `config.js`:

```js
window.IPTV_CONFIG = {
  playlist: {
    url: "http://YOUR_M3U_SERVER/playlist.m3u",
    request: {
      method: "GET"
    }
  }
};
```

The source only needs to return valid M3U text. It does not have to use rtp2httpd; a static file server, NAS, reverse proxy, IPTV service, or custom API can all be used.

`config.js` is ignored by Git. Never place private server addresses, credentials, or tokens in source files, documentation, or example configuration.

The development server automatically loads a local `config.js` from the project root when it exists:

```bash
pnpm dev
```

A regular browser is useful for checking layout, M3U parsing, and basic interaction. Validate remote focus and webOS behavior in the Simulator. Real decoding, channel changes, and long-running playback must be verified on a physical TV.

Run the TypeScript tests, the active state-machine regression test, and the production build:

```bash
pnpm test
pnpm build
```

`pnpm build` creates `dist/`. For privacy, the build writes an empty safe configuration and does not copy the local `config.js`. When no source is bundled, the app opens the source form on the TV.

## Simulator debugging

### Launch the app

Run `pnpm build`, then use the repository script to validate and launch the generated `dist/` app.

On Windows with PowerShell 7:

```powershell
& .\.agents\skills\webos-tv-debug\scripts\run-simulator.ps1 -Version 25 -AppDir .\dist
```

On macOS:

```bash
./.agents/skills/webos-tv-debug/scripts/run-simulator.sh 25 "$(pwd -P)/dist"
```

If the Simulator is outside the default webOS CLI search paths, add `-SimulatorDir $env:WEBOS_SIMULATOR_DIR` on Windows or append `"$WEBOS_SIMULATOR_DIR"` on macOS. The variable must point to the extracted directory containing the Simulator executable.

You can also launch manually through webOS Studio:

1. Open the project in VS Code.
2. Right-click the project directory.
3. Select **Run on Simulator**.
4. Select **webOS TV 25**.

Or use the CLI:

```bash
ares-launch --simulator 25 .
```

Specify a nonstandard Simulator directory with `--simulator-path`:

```bash
ares-launch \
  --simulator 25 \
  --simulator-path "$SIMULATOR_DIR" \
  "$APP_DIR"
```

Alternatively, open the Simulator first, choose **File > Launch App**, and select the project root containing `appinfo.json`.

### Inspector

After launching the app, choose **Tools > Inspector** from the Simulator menu or select **Inspect** in the remote-control area. Use the Inspector to:

- Review JavaScript exceptions and console output.
- Inspect playlist and channel network requests.
- Debug DOM, CSS, focus state, and local storage.
- Inspect the `<video>` element's `MediaError`, `networkState`, and `readyState`.

### Simulator media limitations

The Simulator is useful for interface, remote-control, focus, M3U-loading, and some webOS API tests, but its media support does not match TV hardware. A continuous `video/mp2t` channel may produce errors such as:

```text
MediaError code 4
DEMUXER_ERROR_COULD_NOT_OPEN
FormatUnsupported
```

A source's own web player may list channels successfully while the Simulator still fails to demux MPEG-TS or decode HEVC. Verify the following on a physical TV:

- MPEG-TS, HLS, and live-stream startup.
- H.264, HEVC, MPEG-2, 4K, HDR, and interlaced video.
- AAC, AC3, EAC3, multiple audio tracks, and A/V sync.
- Hardware decoding, repeated channel changes, long-running playback, and memory stability.

## Physical TV debugging

### 1. Prepare the TV

The TV and development computer must be on the same local network. Open LG's **Developer Mode** app on the TV:

1. Sign in with an LG Developer account.
2. Confirm that **Dev Mode Status** is ON.
3. Check **Remain Session** and select **EXTEND** when necessary.
4. Enable **Key Server**.
5. Note the case-sensitive six-character passphrase.
6. Find the TV's local IP address in its network settings.

Homebrew Channel does not replace Developer Mode SSH authorization. The steps above are still required when installing development packages with the official CLI.

### 2. Register the TV

Run:

```bash
ares-setup-device
```

Choose `add` and enter:

```text
Device Name: myTV
Device IP address: the TV's local IP address
Device Port: 9922
ssh user: prisoner
description: LG TV
Set default: Yes
Save: Yes
```

Developer Mode connections always use port `9922` and user `prisoner`. Leave the password empty. Check the saved configuration:

```bash
ares-setup-device --list
```

### 3. Obtain the SSH key and verify the connection

Keep **Key Server** enabled in the TV's Developer Mode app:

```bash
ares-novacom --device myTV --getkey
```

Enter the six-character passphrase from the TV, then verify the connection:

```bash
ares-device --system-info --device myTV
```

The connection is working when the command reports the TV model, SDK, and firmware version.

### 4. Package, install, and launch

After verifying the connection, run the repository deployment script from the project root. Replace `myTV` with the name registered through `ares-setup-device`.

On Windows with PowerShell 7:

```powershell
& .\.agents\skills\webos-tv-debug\scripts\deploy-to-tv.ps1 -Device myTV -AppDir .\dist
```

On macOS:

```bash
./.agents/skills/webos-tv-debug/scripts/deploy-to-tv.sh myTV "$(pwd -P)/dist"
```

To open the Inspector as well, append `-Inspect` on Windows or `--inspect` on macOS. The deployment scripts create the IPK in a temporary directory and do not modify the local `appinfo.json` version for overwrite installation.

The equivalent manual commands are:

```bash
# Package
ares-package dist

# Install; replace myTV with the registered device name
ares-install --device myTV com.odyssey.webos.iptv_0.1.0_all.ipk

# Launch
ares-launch --device myTV com.odyssey.webos.iptv
```

The default build does not include a private `config.js` in the IPK. Add a source directly on the TV after first launch. If a preconfigured source is required, build locally, place the configuration in `dist/config.js`, confirm the TV can reach it, and do not commit or share that directory or IPK. `*.ipk`, `dist/`, and the local `config.js` are ignored by Git.

Run the package, install, and launch commands again after code changes to overwrite the development installation.

### 5. Physical TV Inspector

With the app running on the TV:

```bash
ares-inspect \
  --device myTV \
  --app com.odyssey.webos.iptv \
  --open
```

Use the physical TV Inspector for real channel requests, media errors, JavaScript exceptions, and playback state. Close the app with:

```bash
ares-launch --device myTV --close com.odyssey.webos.iptv
```

### Recommended validation scope

| Environment | Suitable for | Do not treat as final proof of |
| --- | --- | --- |
| Browser | Layout, M3U parsing, data logic, mouse interaction | webOS APIs, remote input, TV decoding |
| TV Simulator | 1920×1080 layout, remote keys, focus, lifecycle, Inspector | MPEG-TS, HEVC, 4K, hardware decoding, performance |
| Physical LG TV | Real decoding, channel changes, LAN access, remote input, performance, stability | Final acceptance should be based here |

### Common connection problems

- `ares-novacom --getkey` fails: confirm that Key Server is ON, the IP address is correct, and the passphrase has the correct case.
- The port connection fails: confirm port `9922`, verify both devices are on the same network, and make sure the router does not isolate clients.
- Developer Mode stops working: check **Remain Session** and select **EXTEND** before it expires.
- The app opens but the playlist fails: choose **Edit source** in the second column, verify that the TV can reach the server, and check its firewall and CORS settings.
- Channels are listed but do not play: inspect `MediaError` on the physical TV and verify the stream container, video codec, and audio codec.

Official LG documentation:

- [Developer Mode App](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app)
- [webOS CLI Developer Guide](https://webostv.developer.lge.com/develop/tools/cli-dev-guide)
- [Simulator Developer Guide](https://webostv.developer.lge.com/develop/tools/simulator-dev-guide)

## Remote controls

| Input | Behavior |
| --- | --- |
| Right | Open the channel browser; move through the source, group, and channel columns |
| Left | Open the channel browser when closed; return to the previous column when open; stay in the source column at the left boundary |
| Up / Down | Change channels from the info or hidden state; move focus within the active browser column |
| OK | Reveal hidden UI; advance through source/group columns; play the selected channel |
| Back | Hide visible info or the channel browser; show the system exit confirmation when already hidden |
| Page Up / Page Down | Skip eight channels during desktop development |
| Magic Remote pointer | Synchronize focus on hover and play on click |
| Magic Remote wheel | Move one channel up or down |

When the UI is hidden, Up and Down change channels and show playback information, while Left or Right opens the channel browser. Other ordinary keys and pointer activity only reveal the info view. Back invokes the system exit confirmation. After five seconds without input, the top status, browser, now-playing information, and hints are hidden without pausing or stopping video. If playback fails or ends, OK retries the current channel when the browser is closed; browser navigation remains unchanged while it is open.

## M3U source configuration

Sources managed on the TV are stored in local storage. On first initialization, when no stored source state exists, the app imports the untracked `config.js` playlist as its first source. The TV-managed source list becomes authoritative after initialization.

Recommended initial configuration:

```js
window.IPTV_CONFIG = {
  playlist: {
    name: "Home IPTV",
    url: "http://YOUR_M3U_SERVER/playlist.m3u",
    request: {
      method: "GET"
    }
  },
  epg: {
    url: ""
  },
  playback: {
    startupTimeoutMs: 15000,
    stallTimeoutMs: 12000,
    maxRetries: 2,
    retryDelayMs: 1200,
    channelSwitchDelayMs: 100,
    loadingIndicatorDelayMs: 500
  },
  ui: {
    simpleMode: "auto"
  }
};
```

When `epg.url` is empty, the app reads `x-tvg-url` from the `#EXTM3U` header. Common rtp2httpd `.xml.gz` declarations are converted to their corresponding XML addresses. XMLTV `channel` and `display-name` values are matched against M3U `tvg-id`, `tvg-name`, and channel names. Set `epg.url` only when overriding the M3U declaration.

The `playback` object is optional. The app reloads the current channel when startup exceeds `startupTimeoutMs` or continuous buffering after playback exceeds `stallTimeoutMs`. Retries use `retryDelayMs` and stop after `maxRetries`. `channelSwitchDelayMs` coalesces rapid Up/Down changes, while `loadingIndicatorDelayMs` controls when the compact loading indicator appears. Changing channels or pressing OK manually resets the retry count.

`ui.simpleMode` defaults to `"auto"`, which disables blur filters, heavy shadows, smooth scrolling, and longer animations in the webOS runtime. Use `true` or `"on"` to force it on, or `false` or `"off"` to force it off.

For channel-change timing, inspect `window.__IPTV_PERFORMANCE__`. It contains phase timings and an attempt number for the most recent request, but never includes channel names, playback URLs, request headers, or raw error messages.

Playback failures show redacted diagnostics including `MediaError`, `networkState`, `readyState`, inferred stream type, and retry count. Diagnostics omit channel URLs, query parameters, and request headers. `MEDIA_ERR_SRC_NOT_SUPPORTED` only means that the current target could not open the media; it does not prove the server is unreachable. MPEG-TS and HEVC errors from the Simulator must still be reproduced on a physical TV.

Additional `fetch` options may be configured when required by the source:

```js
window.IPTV_CONFIG = {
  playlist: {
    url: "https://example.com/api/playlist",
    request: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer YOUR_LOCAL_TOKEN"
      },
      credentials: "omit",
      body: JSON.stringify({ format: "m3u" })
    }
  }
};
```

Supported request fields are `method`, `headers`, `body`, `credentials`, `mode`, `redirect`, `referrer`, `referrerPolicy`, and `cache`. Set only `url` when no custom request behavior is needed.

The legacy format remains supported:

```js
window.IPTV_CONFIG = {
  playlistUrl: "http://YOUR_M3U_SERVER/playlist.m3u"
};
```

Source requirements:

- The response body must contain M3U text. Both extended M3U with `#EXTINF` metadata and simple URL-only lists are supported; simple lists receive generated channel names.
- HTTP responses must have a 2xx status.
- Cross-origin sources must allow access from the TV app, for example through an appropriate `Access-Control-Allow-Origin` header.
- Channel entries may use absolute URLs or URLs relative to the final playlist address.
- Stream containers and codecs must be supported by the target TV. Fetching a playlist successfully does not guarantee that every channel can be played.

rtp2httpd is only one possible source. When using it, for example, set `url` to `http://<server>:5140/playlist.m3u`. Any other service that returns valid M3U can be used instead.

After initialization on the TV, edit source names and M3U addresses through the source form. `config.js` is intended for first import and deployments requiring advanced headers or request bodies. Authentication tokens and other private values must remain in the untracked local `config.js` and must never be committed.

## Known limitations

- Favorites and channel search are not implemented yet.
- Simulator media support differs from physical hardware. Final IPTV playback validation must be performed on an LG C5.

## License

Private project. Unauthorized distribution is prohibited.
