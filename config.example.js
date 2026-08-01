window.IPTV_CONFIG = {
  playlist: {
    name: "家庭 IPTV",
    url: "http://YOUR_M3U_SERVER/playlist.m3u",
    request: {
      method: "GET"
    }
  },
  epg: {
    // 留空时自动读取 #EXTM3U 的 x-tvg-url；也可在这里覆盖 XMLTV 地址。
    url: ""
  },
  playback: {
    startupTimeoutMs: 15000,
    stallTimeoutMs: 12000,
    maxRetries: 2,
    retryDelayMs: 1200,
    channelSwitchDelayMs: 220,
    loadingIndicatorDelayMs: 500
  },
  ui: {
    simpleMode: "auto"
  }
};
