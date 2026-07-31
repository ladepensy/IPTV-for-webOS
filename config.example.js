window.IPTV_CONFIG = {
  playlist: {
    url: "http://YOUR_M3U_SERVER/playlist.m3u",
    request: {
      method: "GET"
    }
  },
  playback: {
    startupTimeoutMs: 15000,
    stallTimeoutMs: 12000,
    maxRetries: 2,
    retryDelayMs: 1200
  }
};
