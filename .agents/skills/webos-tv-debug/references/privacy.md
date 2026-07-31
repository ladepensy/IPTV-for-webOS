# Privacy-safe webOS debugging

Apply these rules before environment discovery, launch, packaging, Inspector use, screenshots, or media diagnosis.

## Establish scope

1. Resolve the app from the current workspace or a user-provided path by locating `appinfo.json`.
2. Do not infer the app location from the absolute path used to load this Skill. A project-local Skill may move with the repository, and a globally installed Skill may be unrelated to the current app.
3. Treat paths remembered from another machine or conversation as hints only. Verify them locally before use.
4. Let `ares-launch --simulator VERSION APP_DIR` try CLI defaults first.
5. If discovery is necessary, inspect names and metadata only in this order:
   - user-provided roots;
   - current workspace and adjacent project-owned environment directories;
   - platform application locations such as `/Applications` and `~/Applications`;
   - a bounded metadata query such as `mdfind 'kMDItemFSName == "*webOS*Simulator*.app"c'` on macOS.
6. Never recursively search an entire home directory or read unrelated file contents. If several matching versions remain, list abbreviated candidates and ask the user to choose.

Never expand an account-bearing absolute path in user-facing prose or code blocks, even when the path is known from the current tool environment. Use `$APP_DIR`, `$SIMULATOR_DIR`, repository-relative paths, or `~/...`. Initialize variables locally, for example `APP_DIR=$(pwd -P)`, without printing their values. Do not echo the Skill's load path. Pass a locally verified absolute path to local commands only when required, and summarize tool output that contains it.

## Protect secrets and local configuration

Treat these values as sensitive:

- `config.js` and equivalent untracked configuration;
- playlist and channel URLs, including paths, query strings, fragments, and embedded credentials;
- authorization headers, cookies, request bodies, API tokens, passphrases, and SSH/private keys;
- TV IP addresses, private hostnames, device identifiers, and exact LAN topology;
- raw Inspector, Console, Network, media-player, and service logs;
- IPKs because they may contain local configuration.

Check whether a configuration file exists without reading or printing it. If configuration semantics must be inspected, ask the user to provide a redacted example or inspect only the public example file. Never include sensitive files in diffs, tool output, screenshots, test fixtures, or commits.

## Report sanitized evidence

Prefer these fields:

- request stage, HTTP status, response content type, CORS presence, redirect count, and channel count;
- protocol class (`HTTP`, `HTTPS`, local file), host class (`loopback`, `private LAN`, `public`), and media extension/container without the host or path;
- `MediaError.code`, normalized error name, `networkState`, `readyState`, `canPlayType`, container, and codec family;
- Simulator version, app ID, CLI availability, and success/failure of each lifecycle step.

Replace URLs, query values, header values, cookies, tokens, IP addresses, and credentials with category labels. Do not paste raw logs and redact them after exposure; extract only the safe fields needed for the diagnosis.

## Handle screenshots and UI inspection

Prefer process arguments, accessibility text, sanitized Inspector evaluation, and targeted state checks over screenshots. Before capturing a screenshot, tell the user that all visible content in the app window may enter the current Codex task context. Avoid capture when the screen contains private channel names, account data, URLs, QR codes, or credentials unless visual verification is necessary and the user has been informed.

Do not attach or publish a screenshot merely because it was captured for verification. Summarize the safe result unless the image itself is required.

## Explain network boundaries

A Simulator launch is local, but the launched app can still contact endpoints from its configuration. Before launch, state without revealing addresses that the app may request its configured playlist, channel media, images, EPG, or update service. Browser tests should use synthetic configuration and fake media endpoints instead of the user's real configuration whenever possible.

## Handle packages and temporary artifacts

A Simulator source launch does not need an IPK. When packaging is required, use a uniquely created temporary directory, do not inspect or upload package contents, and report only package name and lifecycle result. Keep deployment-only packages out of Git. Delete known temporary artifacts through the script's scoped cleanup; never use a broad path or unresolved variable as a deletion target.

## Final privacy check

Before reporting results, verify that the response contains no private URLs, exact LAN addresses, credentials, local configuration contents, raw logs, or unnecessary account-identifying paths. State which evidence was inspected, whether a screenshot was captured, which network categories were contacted, and whether an IPK or temporary artifact was created.
