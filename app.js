(function () {
  "use strict";

  var config = window.IPTV_CONFIG || {};
  var playlistConfig = config.playlist || {};
  var PLAYLIST_URL = playlistConfig.url || config.playlistUrl || "";
  var PLAYLIST_REQUEST = playlistConfig.request || config.playlistRequest || {};
  var playbackConfig = config.playback || {};
  var STARTUP_TIMEOUT_MS = getNumberOption(playbackConfig.startupTimeoutMs, 15000, 5000, 60000);
  var STALL_TIMEOUT_MS = getNumberOption(playbackConfig.stallTimeoutMs, 12000, 5000, 60000);
  var MAX_PLAYBACK_RETRIES = getNumberOption(playbackConfig.maxRetries, 2, 0, 5);
  var RETRY_DELAY_MS = getNumberOption(playbackConfig.retryDelayMs, 1200, 0, 10000);
  var channels = [];
  var focusedIndex = 0;
  var playingIndex = -1;
  var playbackAttemptId = 0;
  var playbackRetryCount = 0;
  var playbackHasStarted = false;
  var startupTimer = null;
  var stallTimer = null;
  var retryTimer = null;
  var failedAttemptId = -1;
  var wheelAccumulator = 0;
  var lastWheelEventAt = 0;
  var lastWheelStepAt = 0;

  var channelList = document.getElementById("channel-list");
  var channelCount = document.getElementById("channel-count");
  var currentTitle = document.getElementById("current-title");
  var connectionState = document.getElementById("connection-state");
  var player = document.getElementById("player");
  var playerPlaceholder = document.getElementById("player-placeholder");
  var playerMessage = document.getElementById("player-message");
  var playerDiagnostics = document.getElementById("player-diagnostics");
  var nowPlayingTitle = document.getElementById("now-playing-title");
  var nowPlayingGroup = document.getElementById("now-playing-group");
  var clock = document.getElementById("clock");

  function getNumberOption(value, fallback, minimum, maximum) {
    var parsed = Number(value);
    if (!isFinite(parsed)) return fallback;
    return Math.max(minimum, Math.min(maximum, Math.round(parsed)));
  }

  function parseAttributes(line) {
    var attributes = {};
    var expression = /([\w-]+)="([^"]*)"/g;
    var match;

    while ((match = expression.exec(line)) !== null) {
      attributes[match[1]] = match[2];
    }

    return attributes;
  }

  function resolveUrl(url, baseUrl) {
    try {
      return new URL(url, baseUrl).href;
    } catch (error) {
      return url;
    }
  }

  function parseM3U(text, baseUrl) {
    var lines = text.split(/\r?\n/);
    var result = [];
    var pending = null;

    lines.forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line) return;

      if (line.indexOf("#EXTINF:") === 0) {
        var commaIndex = line.indexOf(",");
        var metadata = commaIndex >= 0 ? line.slice(0, commaIndex) : line;
        var attributes = parseAttributes(metadata);

        pending = {
          id: attributes["tvg-id"] || "",
          name:
            (commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : "") ||
            attributes["tvg-name"] ||
            "未命名频道",
          logo: attributes["tvg-logo"] || "",
          group: attributes["group-title"] || "其他",
          url: ""
        };
        return;
      }

      if (line.charAt(0) !== "#") {
        var channel = pending || {
          id: "",
          name: "频道 " + String(result.length + 1).padStart(3, "0"),
          logo: "",
          group: "其他",
          url: ""
        };

        channel.url = resolveUrl(line, baseUrl);
        result.push(channel);
        pending = null;
      }
    });

    return result;
  }

  function buildPlaylistRequestOptions() {
    var options = {
      method: (PLAYLIST_REQUEST.method || "GET").toUpperCase(),
      cache: PLAYLIST_REQUEST.cache || "no-store"
    };
    var optionalFields = [
      "headers",
      "body",
      "credentials",
      "mode",
      "redirect",
      "referrer",
      "referrerPolicy"
    ];

    optionalFields.forEach(function (field) {
      if (PLAYLIST_REQUEST[field] !== undefined) {
        options[field] = PLAYLIST_REQUEST[field];
      }
    });

    return options;
  }

  function setConnectionState(label, stateClass) {
    connectionState.textContent = label;
    connectionState.className = "status-pill" + (stateClass ? " " + stateClass : "");
  }

  function setPlayerStatus(message, details) {
    playerMessage.textContent = message;
    if (details && details.length) {
      playerDiagnostics.textContent = details.join("\n");
      playerDiagnostics.hidden = false;
    } else {
      playerDiagnostics.textContent = "";
      playerDiagnostics.hidden = true;
    }
  }

  function getStreamInfo(url) {
    var path = "";
    try {
      path = new URL(url).pathname.toLowerCase();
    } catch (error) {
      path = String(url || "").split("?")[0].toLowerCase();
    }

    if (/\.m3u8$/.test(path)) return { label: "HLS", mime: "application/vnd.apple.mpegurl" };
    if (/\.mpd$/.test(path)) return { label: "DASH", mime: "application/dash+xml" };
    if (/\.(ts|m2ts)$/.test(path)) return { label: "MPEG-TS", mime: "video/mp2t" };
    if (/\.mp4$/.test(path)) return { label: "MP4", mime: "video/mp4" };
    if (/\.webm$/.test(path)) return { label: "WebM", mime: "video/webm" };
    return { label: "由电视自动探测", mime: "" };
  }

  function getMediaErrorName(error) {
    var names = {
      1: "MEDIA_ERR_ABORTED",
      2: "MEDIA_ERR_NETWORK",
      3: "MEDIA_ERR_DECODE",
      4: "MEDIA_ERR_SRC_NOT_SUPPORTED"
    };
    return error && names[error.code] ? names[error.code] : "无媒体错误码";
  }

  function getNetworkStateName(value) {
    return ["EMPTY", "IDLE", "LOADING", "NO_SOURCE"][value] || String(value);
  }

  function getReadyStateName(value) {
    return ["HAVE_NOTHING", "HAVE_METADATA", "HAVE_CURRENT_DATA", "HAVE_FUTURE_DATA", "HAVE_ENOUGH_DATA"][value] || String(value);
  }

  function sanitizeErrorMessage(error) {
    if (!error) return "";
    var message = String(error.message || error.name || "");
    return message.replace(/https?:\/\/[^\s]+/gi, "[地址已隐藏]").slice(0, 160);
  }

  function buildPlaybackDiagnostics(reason, error) {
    var channel = channels[playingIndex];
    var stream = getStreamInfo(channel ? channel.url : "");
    var support = stream.mime && player.canPlayType ? player.canPlayType(stream.mime) : "";
    var details = [
      "原因：" + reason,
      "媒体错误：" + getMediaErrorName(player.error),
      "网络状态：" + getNetworkStateName(player.networkState),
      "就绪状态：" + getReadyStateName(player.readyState),
      "流类型：" + stream.label + (support ? "（" + support + "）" : ""),
      "重试：" + playbackRetryCount + "/" + MAX_PLAYBACK_RETRIES
    ];
    var safeMessage = sanitizeErrorMessage(error);
    if (safeMessage) details.push("浏览器信息：" + safeMessage);

    window.__IPTV_DIAGNOSTICS__ = {
      reason: reason,
      mediaError: getMediaErrorName(player.error),
      networkState: getNetworkStateName(player.networkState),
      readyState: getReadyStateName(player.readyState),
      streamType: stream.label,
      retryCount: playbackRetryCount,
      maxRetries: MAX_PLAYBACK_RETRIES
    };
    return details;
  }

  function clearPlaybackTimers() {
    clearTimeout(startupTimer);
    clearTimeout(stallTimer);
    clearTimeout(retryTimer);
    startupTimer = null;
    stallTimer = null;
    retryTimer = null;
  }

  function stopPlayback() {
    playbackAttemptId += 1;
    clearPlaybackTimers();
    playbackHasStarted = false;
    failedAttemptId = -1;
    player.pause();
    player.removeAttribute("src");
    player.load();
  }

  function scheduleStallTimeout() {
    clearTimeout(stallTimer);
    if (!playbackHasStarted) return;
    var attemptId = playbackAttemptId;
    stallTimer = setTimeout(function () {
      if (attemptId === playbackAttemptId) {
        handlePlaybackFailure("缓冲超过 " + Math.round(STALL_TIMEOUT_MS / 1000) + " 秒");
      }
    }, STALL_TIMEOUT_MS);
  }

  function handlePlaybackFailure(reason, error) {
    var attemptId = playbackAttemptId;
    if (playingIndex < 0 || failedAttemptId === attemptId) return;
    failedAttemptId = attemptId;
    clearPlaybackTimers();

    var willRetry = playbackRetryCount < MAX_PLAYBACK_RETRIES;
    if (willRetry) playbackRetryCount += 1;
    var details = buildPlaybackDiagnostics(reason, error);
    playerPlaceholder.classList.remove("is-hidden");

    if (willRetry) {
      setPlayerStatus("播放异常，正在重试…", details);
      retryTimer = setTimeout(function () {
        if (playingIndex >= 0) startPlaybackAttempt();
      }, RETRY_DELAY_MS);
      return;
    }

    setPlayerStatus("频道播放失败，请按 OK 重试或切换频道", details);
  }

  function startPlaybackAttempt() {
    var channel = channels[playingIndex];
    if (!channel) return;

    playbackAttemptId += 1;
    var attemptId = playbackAttemptId;
    failedAttemptId = -1;
    playbackHasStarted = false;
    clearPlaybackTimers();

    playerPlaceholder.classList.remove("is-hidden");
    setPlayerStatus("正在连接 " + channel.name, [
      "流类型：" + getStreamInfo(channel.url).label,
      "尝试：" + (playbackRetryCount + 1) + "/" + (MAX_PLAYBACK_RETRIES + 1)
    ]);

    player.pause();
    player.src = channel.url;
    player.load();

    startupTimer = setTimeout(function () {
      if (attemptId === playbackAttemptId && !playbackHasStarted) {
        handlePlaybackFailure("起播超过 " + Math.round(STARTUP_TIMEOUT_MS / 1000) + " 秒");
      }
    }, STARTUP_TIMEOUT_MS);

    var playPromise = player.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function (error) {
        if (attemptId !== playbackAttemptId || (error && error.name === "AbortError")) return;
        handlePlaybackFailure("play() 被拒绝", error);
      });
    }
  }

  function renderChannels() {
    var fragment = document.createDocumentFragment();
    channelList.innerHTML = "";

    channels.forEach(function (channel, index) {
      var item = document.createElement("button");
      var number = document.createElement("span");
      var copy = document.createElement("span");
      var name = document.createElement("span");
      var group = document.createElement("span");

      item.type = "button";
      item.className = "channel-item";
      item.setAttribute("role", "option");
      item.setAttribute("data-index", String(index));

      number.className = "channel-number";
      number.textContent = String(index + 1).padStart(3, "0");

      copy.className = "channel-copy";
      name.className = "channel-name";
      name.textContent = channel.name;
      group.className = "channel-group";
      group.textContent = channel.group;

      copy.appendChild(name);
      copy.appendChild(group);
      item.appendChild(number);
      item.appendChild(copy);
      item.addEventListener("mouseenter", function () {
        focusedIndex = index;
        updateFocus(false);
      });
      item.addEventListener("focus", function () {
        focusedIndex = index;
        updateFocus(false);
      });
      item.addEventListener("click", function () {
        focusedIndex = index;
        playFocusedChannel();
      });
      fragment.appendChild(item);
    });

    channelList.appendChild(fragment);
    channelCount.textContent = String(channels.length);
    updateFocus();
  }

  function updateFocus(shouldScroll) {
    var items = channelList.querySelectorAll(".channel-item");

    Array.prototype.forEach.call(items, function (item, index) {
      item.classList.toggle("is-focused", index === focusedIndex);
      item.classList.toggle("is-playing", index === playingIndex);
      item.setAttribute("aria-selected", index === focusedIndex ? "true" : "false");
    });

    if (shouldScroll !== false && items[focusedIndex]) {
      items[focusedIndex].scrollIntoView({ block: "nearest" });
    }
  }

  function moveFocus(delta) {
    if (!channels.length) return;
    focusedIndex = Math.max(0, Math.min(channels.length - 1, focusedIndex + delta));
    updateFocus(true);
  }

  function playFocusedChannel() {
    var channel = channels[focusedIndex];
    if (!channel) return;

    clearPlaybackTimers();
    playbackRetryCount = 0;
    playingIndex = focusedIndex;
    currentTitle.textContent = channel.name;
    nowPlayingTitle.textContent = channel.name;
    nowPlayingGroup.textContent = channel.group;
    updateFocus();
    startPlaybackAttempt();
  }

  function loadPlaylist() {
    if (!PLAYLIST_URL) {
      currentTitle.textContent = "尚未配置播放列表";
      playerMessage.textContent = "请复制 config.example.js 为 config.js 并填写播放列表地址";
      setConnectionState("未配置", "is-error");
      return;
    }

    setConnectionState("连接中", "");

    fetch(PLAYLIST_URL, buildPlaylistRequestOptions())
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.text().then(function (text) {
          return {
            text: text,
            baseUrl: response.url || PLAYLIST_URL
          };
        });
      })
      .then(function (playlist) {
        channels = parseM3U(playlist.text, playlist.baseUrl);
        if (!channels.length) {
          throw new Error("播放列表中没有频道");
        }

        currentTitle.textContent = "选择一个频道";
        setPlayerStatus("按方向键选择频道，按 OK 播放");
        setConnectionState("已连接", "is-online");
        renderChannels();
      })
      .catch(function (error) {
        currentTitle.textContent = "播放列表加载失败";
        setPlayerStatus(error.message + " · 请确认 M3U 数据源可访问");
        setConnectionState("连接失败", "is-error");
      });
  }

  function handleBack() {
    if (playingIndex >= 0) {
      stopPlayback();
      playingIndex = -1;
      playerPlaceholder.classList.remove("is-hidden");
      setPlayerStatus("播放已停止");
      nowPlayingTitle.textContent = "尚未选择频道";
      nowPlayingGroup.textContent = "按方向键选择，按 OK 播放";
      updateFocus();
      return;
    }

    if (window.webOS && window.webOS.platformBack) {
      window.webOS.platformBack();
    } else {
      window.close();
    }
  }

  document.addEventListener("keydown", function (event) {
    switch (event.keyCode) {
      case 38:
        event.preventDefault();
        moveFocus(-1);
        break;
      case 40:
        event.preventDefault();
        moveFocus(1);
        break;
      case 13:
        event.preventDefault();
        playFocusedChannel();
        break;
      case 33:
        event.preventDefault();
        moveFocus(-8);
        break;
      case 34:
        event.preventDefault();
        moveFocus(8);
        break;
      case 461:
      case 27:
        event.preventDefault();
        handleBack();
        break;
      default:
        break;
    }
  });

  document.addEventListener("wheel", function (event) {
    if (!channels.length) return;
    event.preventDefault();
    var now = Date.now();
    if (now - lastWheelEventAt > 500 || (wheelAccumulator > 0 && event.deltaY < 0) || (wheelAccumulator < 0 && event.deltaY > 0)) {
      wheelAccumulator = 0;
    }
    lastWheelEventAt = now;
    wheelAccumulator += event.deltaY;

    if (Math.abs(wheelAccumulator) < 80 || now - lastWheelStepAt < 120) return;
    moveFocus(wheelAccumulator > 0 ? 1 : -1);
    wheelAccumulator = 0;
    lastWheelStepAt = now;
  }, { passive: false });

  player.addEventListener("playing", function () {
    clearTimeout(startupTimer);
    clearTimeout(stallTimer);
    startupTimer = null;
    stallTimer = null;
    playbackHasStarted = true;
    playerPlaceholder.classList.add("is-hidden");
  });

  player.addEventListener("waiting", function () {
    setPlayerStatus("正在缓冲…", buildPlaybackDiagnostics("播放器等待数据"));
    playerPlaceholder.classList.remove("is-hidden");
    scheduleStallTimeout();
  });

  player.addEventListener("stalled", function () {
    setPlayerStatus("媒体数据暂时中断…", buildPlaybackDiagnostics("网络数据停滞"));
    playerPlaceholder.classList.remove("is-hidden");
    scheduleStallTimeout();
  });

  player.addEventListener("loadedmetadata", function () {
    if (!playbackHasStarted) {
      setPlayerStatus("媒体已识别，正在起播…", buildPlaybackDiagnostics("已读取媒体信息"));
    }
  });

  player.addEventListener("error", function () {
    handlePlaybackFailure("媒体元素报告错误", player.error);
  });

  player.addEventListener("ended", function () {
    if (playingIndex >= 0) {
      setPlayerStatus("频道播放已结束，按 OK 重新播放", buildPlaybackDiagnostics("媒体播放结束"));
      playerPlaceholder.classList.remove("is-hidden");
    }
  });

  function updateClock() {
    var now = new Date();
    clock.textContent =
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0");
  }

  updateClock();
  setInterval(updateClock, 30000);
  loadPlaylist();
})();
