# Media diagnostics

## Decision sequence

Diagnose in this order:

1. **Playlist configuration**: confirm a source exists without printing its private value.
2. **Playlist response**: record HTTP status, content type, CORS header, and parsed channel count.
3. **Channel response**: record status, content type, redirect behavior, and whether bytes arrive.
4. **Browser capability**: inspect `video.canPlayType`, `video.error`, `networkState`, and `readyState`.
5. **Container and codecs**: distinguish MPEG-TS, HLS, MP4, H.264, HEVC, MPEG-2, and audio codecs.
6. **Target difference**: reproduce on a real TV before concluding a Simulator media failure affects production hardware.

Sanitize URLs to protocol, host category, port, and path suffix. Never print embedded credentials, query tokens, headers, or local config contents.

## Common interpretation

`MediaError.code === 4`, `MEDIA_ERR_SRC_NOT_SUPPORTED`, `FormatUnsupported`, or `DEMUXER_ERROR_COULD_NOT_OPEN` means the target media stack could not open or recognize the source. It does not prove the server is offline.

If the playlist and channel both return HTTP 200 but Simulator reports the errors above for `video/mp2t`, classify it as a Simulator/container capability failure unless evidence shows corrupt bytes. Test the same channel on a real TV.

HLS availability and codec support are separate. A target may understand an HLS manifest but still reject HEVC, MPEG-2, AC3, or another track. Browser transmuxing through MSE can help H.264/AAC MPEG-TS sources but cannot manufacture an unavailable decoder.

## App instrumentation

Preserve the rejected `video.play()` error during diagnosis. Add or inspect handlers for:

```js
video.play().catch(function (error) {
  console.error(error.name, error.message);
});

video.addEventListener("error", function () {
  console.error(video.error && video.error.code, video.error && video.error.message);
});
```

Do not leave private URLs or authorization headers in logs.

Official references:

- https://webostv.developer.lge.com/develop/tools/simulator-introduction
- https://webostv.developer.lge.com/develop/specifications/streaming-protocol-drm
