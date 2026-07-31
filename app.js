(function () {
  "use strict";

  var config = window.IPTV_CONFIG || {};
  var PLAYLIST_URL = config.playlistUrl || "";
  var channels = [];
  var focusedIndex = 0;
  var playingIndex = -1;

  var channelList = document.getElementById("channel-list");
  var channelCount = document.getElementById("channel-count");
  var currentTitle = document.getElementById("current-title");
  var connectionState = document.getElementById("connection-state");
  var player = document.getElementById("player");
  var playerPlaceholder = document.getElementById("player-placeholder");
  var playerMessage = document.getElementById("player-message");
  var nowPlayingTitle = document.getElementById("now-playing-title");
  var nowPlayingGroup = document.getElementById("now-playing-group");
  var clock = document.getElementById("clock");

  function parseAttributes(line) {
    var attributes = {};
    var expression = /([\w-]+)="([^"]*)"/g;
    var match;

    while ((match = expression.exec(line)) !== null) {
      attributes[match[1]] = match[2];
    }

    return attributes;
  }

  function parseM3U(text) {
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

      if (line.charAt(0) !== "#" && pending) {
        pending.url = line;
        result.push(pending);
        pending = null;
      }
    });

    return result;
  }

  function setConnectionState(label, stateClass) {
    connectionState.textContent = label;
    connectionState.className = "status-pill" + (stateClass ? " " + stateClass : "");
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

  function updateFocus() {
    var items = channelList.querySelectorAll(".channel-item");

    Array.prototype.forEach.call(items, function (item, index) {
      item.classList.toggle("is-focused", index === focusedIndex);
      item.classList.toggle("is-playing", index === playingIndex);
      item.setAttribute("aria-selected", index === focusedIndex ? "true" : "false");
    });

    if (items[focusedIndex]) {
      items[focusedIndex].scrollIntoView({ block: "nearest" });
    }
  }

  function moveFocus(delta) {
    if (!channels.length) return;
    focusedIndex = Math.max(0, Math.min(channels.length - 1, focusedIndex + delta));
    updateFocus();
  }

  function playFocusedChannel() {
    var channel = channels[focusedIndex];
    if (!channel) return;

    playingIndex = focusedIndex;
    currentTitle.textContent = channel.name;
    nowPlayingTitle.textContent = channel.name;
    nowPlayingGroup.textContent = channel.group;
    playerMessage.textContent = "正在连接 " + channel.name;
    playerPlaceholder.classList.remove("is-hidden");
    updateFocus();

    player.pause();
    player.src = channel.url;
    player.load();

    var playPromise = player.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function () {
        playerMessage.textContent = "播放启动失败，请按 OK 重试";
      });
    }
  }

  function loadPlaylist() {
    if (!PLAYLIST_URL) {
      currentTitle.textContent = "尚未配置播放列表";
      playerMessage.textContent = "请复制 config.example.js 为 config.js 并填写播放列表地址";
      setConnectionState("未配置", "is-error");
      return;
    }

    setConnectionState("连接中", "");

    fetch(PLAYLIST_URL, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.text();
      })
      .then(function (text) {
        channels = parseM3U(text);
        if (!channels.length) {
          throw new Error("播放列表中没有频道");
        }

        currentTitle.textContent = "选择一个频道";
        playerMessage.textContent = "按方向键选择频道，按 OK 播放";
        setConnectionState("已连接", "is-online");
        renderChannels();
      })
      .catch(function (error) {
        currentTitle.textContent = "播放列表加载失败";
        playerMessage.textContent = error.message + " · 请确认 IPTV 服务器在线";
        setConnectionState("连接失败", "is-error");
      });
  }

  function handleBack() {
    if (!player.paused) {
      player.pause();
      player.removeAttribute("src");
      player.load();
      playingIndex = -1;
      playerPlaceholder.classList.remove("is-hidden");
      playerMessage.textContent = "播放已停止";
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

  player.addEventListener("playing", function () {
    playerPlaceholder.classList.add("is-hidden");
  });

  player.addEventListener("waiting", function () {
    playerMessage.textContent = "正在缓冲…";
    playerPlaceholder.classList.remove("is-hidden");
  });

  player.addEventListener("error", function () {
    playerMessage.textContent = "频道播放失败，请切换频道或重试";
    playerPlaceholder.classList.remove("is-hidden");
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
