(function () {
  "use strict";

  var config = window.IPTV_CONFIG || {};
  var playlistConfig = config.playlist || {};
  var epgConfig = config.epg || {};
  var sourceStore = window.IPTVSourceStore.create({
    storage: window.localStorage,
    legacyConfig: {
      name: playlistConfig.name || "",
      url: playlistConfig.url || config.playlistUrl || "",
      request: playlistConfig.request || config.playlistRequest || {},
      epgUrl: epgConfig.url || "",
      epgRequest: epgConfig.request || {}
    }
  });
  var activeSource = sourceStore.getActive();
  var PLAYLIST_URL = "";
  var PLAYLIST_REQUEST = {};
  var EPG_URL = "";
  var EPG_REQUEST = {};
  var playbackConfig = config.playback || {};
  var STARTUP_TIMEOUT_MS = getNumberOption(playbackConfig.startupTimeoutMs, 15000, 5000, 60000);
  var STALL_TIMEOUT_MS = getNumberOption(playbackConfig.stallTimeoutMs, 12000, 5000, 60000);
  var MAX_PLAYBACK_RETRIES = getNumberOption(playbackConfig.maxRetries, 2, 0, 5);
  var RETRY_DELAY_MS = getNumberOption(playbackConfig.retryDelayMs, 1200, 0, 10000);
  var CHANNEL_SWITCH_DELAY_MS = getNumberOption(
    playbackConfig.channelSwitchDelayMs,
    100,
    100,
    1000
  );
  var LOADING_INDICATOR_DELAY_MS = getNumberOption(
    playbackConfig.loadingIndicatorDelayMs,
    500,
    0,
    2000
  );
  var uiConfig = config.ui || {};
  var UI_HIDE_DELAY_MS = 5000;
  var CHANNEL_REMEMBER_DELAY_MS = 1500;
  var LAST_CHANNEL_STORAGE_KEY = "home-iptv:last-channel";
  var playlistLoadId = 0;

  applySourceConfig(activeSource);

  var interaction = window.IPTVInteraction.create({
    maxPlaybackRetries: MAX_PLAYBACK_RETRIES,
    getStreamInfo: getStreamInfo
  });
  var UI_MODE_HIDDEN = interaction.constants.UI_MODE_HIDDEN;
  var UI_MODE_CHANNELS = interaction.constants.UI_MODE_CHANNELS;
  var UI_MODE_SOURCE_FORM = interaction.constants.UI_MODE_SOURCE_FORM;
  var PLAYBACK_PLAYING = interaction.constants.PLAYBACK_PLAYING;
  var PLAYBACK_RETRYING = interaction.constants.PLAYBACK_RETRYING;
  var state = interaction.createInitialState();

  var startupTimer = null;
  var stallTimer = null;
  var retryTimer = null;
  var channelSwitchTimer = null;
  var channelRememberTimer = null;
  var loadingIndicatorTimer = null;
  var loadingIndicatorAttemptId = -1;
  var uiHideTimer = null;
  var activeMediaAttemptId = -1;
  var activeMediaIndex = -1;
  var hasPlayedMedia = false;
  var pendingPlaybackMetric = null;
  var activePlaybackMetric = null;
  var wheelAccumulator = 0;
  var lastWheelEventAt = 0;
  var lastWheelStepAt = 0;
  var lastPointerActivityAt = 0;
  var discoveredEpgUrl = "";
  var epgProgramsByChannel = {};
  var pendingChannelMemories = {};

  var uiLayer = document.getElementById("ui-layer");
  var currentTitle = document.getElementById("current-title");
  var connectionState = document.getElementById("connection-state");
  var player = document.getElementById("player");
  var playerPlaceholder = document.getElementById("player-placeholder");
  var playerMessage = document.getElementById("player-message");
  var playerDiagnostics = document.getElementById("player-diagnostics");
  var nowPlayingTitle = document.getElementById("now-playing-title");
  var nowPlayingGroup = document.getElementById("now-playing-group");
  var nowPlayingProgramTitle = document.getElementById("now-playing-program-title");
  var nowPlayingProgramTime = document.getElementById("now-playing-program-time");
  var nowPlayingProgress = document.getElementById("now-playing-progress");
  var nowPlayingProgressValue = document.getElementById("now-playing-progress-value");
  var okHintLabel = document.getElementById("ok-hint-label");
  var clock = document.getElementById("clock");
  var channelPanelView = window.IPTVChannelPanel.create({
    panelElement: document.getElementById("channel-panel"),
    trackElement: document.getElementById("channel-browser-track"),
    sourceListElement: document.getElementById("source-list"),
    groupListElement: document.getElementById("group-list"),
    channelListElement: document.getElementById("channel-list"),
    countElement: document.getElementById("channel-count"),
    columnTitleElement: document.getElementById("channel-column-title"),
    epgElement: document.getElementById("epg-popover"),
    epgTitleElement: document.getElementById("epg-channel-title"),
    epgListElement: document.getElementById("epg-program-list"),
    onSourceFocus: function (index) {
      dispatch({ type: "SOURCE_FOCUS", index: index });
    },
    onSourceSelect: function (index) {
      dispatch({ type: "SOURCE_SELECT", index: index });
    },
    onGroupFocus: function (index) {
      dispatch({ type: "GROUP_FOCUS", index: index });
    },
    onGroupSelect: function (index) {
      dispatch({ type: "GROUP_SELECT", index: index });
    },
    onFocus: function (index) {
      dispatch({ type: "CHANNEL_FOCUS", index: index });
    },
    onSelect: function (index, inputAt) {
      dispatch({
        type: "CHANNEL_CLICK",
        index: index,
        inputAt: inputAt
      });
    },
    getInputTime: getMonotonicTime
  });
  var sourceFormView = window.IPTVSourceForm.create({
    rootElement: document.getElementById("source-form-overlay"),
    titleElement: document.getElementById("source-form-title"),
    subtitleElement: document.getElementById("source-form-subtitle"),
    nameInput: document.getElementById("source-name-input"),
    urlInput: document.getElementById("source-url-input"),
    errorElement: document.getElementById("source-form-error"),
    saveButton: document.getElementById("source-save-button"),
    cancelButton: document.getElementById("source-cancel-button"),
    deleteButton: document.getElementById("source-delete-button"),
    normalizeUrl: window.IPTVSourceStore.normalizeUrl,
    confirm: function (message) { return window.confirm(message); },
    onSave: saveSourceForm,
    onCancel: function () {
      dispatch({ type: "SOURCE_FORM_CLOSED" });
    },
    onDelete: deleteSource,
    onExit: exitApp
  });

  function applySourceConfig(source) {
    activeSource = source || null;
    PLAYLIST_URL = activeSource ? activeSource.url : "";
    PLAYLIST_REQUEST = activeSource ? activeSource.request || {} : {};
    EPG_URL = activeSource ? activeSource.epgUrl || "" : "";
    EPG_REQUEST = activeSource ? activeSource.epgRequest || {} : {};
  }

  function getSourceViews() {
    return sourceStore.getSources().map(function (source) {
      return {
        id: source.id,
        name: source.name,
        displayName: sourceStore.displayName(source),
        url: source.url
      };
    });
  }

  function getActiveSourceIndex(sources) {
    var activeId = activeSource ? activeSource.id : "";
    for (var index = 0; index < sources.length; index += 1) {
      if (sources[index].id === activeId) return index;
    }
    return 0;
  }

  function publishSources(options) {
    options = options || {};
    var sources = getSourceViews();
    dispatch({
      type: "SOURCES_UPDATED",
      sources: sources,
      activeSourceId: activeSource ? activeSource.id : "",
      activeSourceIndex: getActiveSourceIndex(sources),
      canAddSource: sourceStore.canAdd(),
      preserveBrowser: Boolean(options.preserveBrowser)
    });
  }

  function showSourceForm(mode, source, error, required) {
    dispatch({ type: "SOURCE_FORM_OPENED" });
    sourceFormView.show({
      mode: mode,
      source: source || null,
      error: error || "",
      required: Boolean(required)
    });
  }

  function saveSourceForm(payload) {
    var source;
    var previousUrl = payload.source ? payload.source.url : "";
    flushRememberedChannels();
    try {
      source = payload.mode === "edit"
        ? sourceStore.update(payload.source.id, payload.value)
        : sourceStore.add(payload.value);
    } catch (error) {
      sourceFormView.showError(error.message);
      return;
    }

    sourceFormView.hide();
    if (payload.mode === "edit" && previousUrl === source.url &&
        activeSource && activeSource.id === source.id) {
      applySourceConfig(source);
      publishSources({ preserveBrowser: true });
      dispatch({ type: "SOURCE_FORM_CLOSED" });
      return;
    }

    loadPlaylist(source, {
      openChannels: payload.mode === "edit",
      reopenOnFailure: true
    });
  }

  function deleteSource(source) {
    flushRememberedChannels();
    var storedActive = sourceStore.getActive();
    var deletingActive = Boolean(
      (activeSource && activeSource.id === source.id) ||
      (storedActive && storedActive.id === source.id)
    );
    sourceStore.remove(source.id);
    var nextSource = sourceStore.getActive();
    if (!deletingActive) {
      publishSources();
      dispatch({ type: "SOURCE_FORM_CLOSED" });
      return;
    }

    if (nextSource) {
      stopCurrentSourcePlayback();
      applySourceConfig(nextSource);
      publishSources();
      dispatch({ type: "ACTIVE_SOURCE_REMOVED" });
      loadPlaylist(nextSource, { openChannels: true, reopenOnFailure: true });
      return;
    }

    playlistLoadId += 1;
    applySourceConfig(null);
    stopCurrentSourcePlayback();
    publishSources();
    dispatch({ type: "PLAYLIST_UNCONFIGURED" });
    showSourceForm("add", null, "", true);
  }

  function stopCurrentSourcePlayback() {
    clearPlaybackTimers();
    cancelPendingPlaybackSwitch();
    player.pause();
    player.removeAttribute("src");
    player.load();
    hasPlayedMedia = false;
  }

  function getNumberOption(value, fallback, minimum, maximum) {
    var parsed = Number(value);
    if (!isFinite(parsed)) return fallback;
    return Math.max(minimum, Math.min(maximum, Math.round(parsed)));
  }

  function isWebOSRuntime() {
    return Boolean(
      window.PalmSystem ||
      /(?:webos|web0s)/i.test(window.navigator && window.navigator.userAgent || "")
    );
  }

  function shouldUseSimpleUi() {
    if (uiConfig.simpleMode === true || uiConfig.simpleMode === "on") return true;
    if (uiConfig.simpleMode === false || uiConfig.simpleMode === "off") return false;
    return isWebOSRuntime();
  }

  if (shouldUseSimpleUi()) {
    document.documentElement.classList.add("webos-simple-ui");
  }

  function dispatch(event) {
    var previousState = state;
    var transitionResult = interaction.transition(state, event);
    state = transitionResult.state;
    renderState(previousState, event);
    transitionResult.effects.forEach(runEffect);
  }

  function runEffect(currentEffect) {
    switch (currentEffect.type) {
      case "SCHEDULE_UI_HIDE":
        scheduleUiHide();
        break;
      case "CANCEL_UI_HIDE":
        clearTimeout(uiHideTimer);
        uiHideTimer = null;
        break;
      case "EXIT_APP":
        exitApp();
        break;
      case "OPEN_SOURCE_FORM":
        showSourceForm(
          currentEffect.mode,
          currentEffect.mode === "edit" ? activeSource : null,
          "",
          !sourceStore.getSources().length
        );
        break;
      case "LOAD_SOURCE":
        var selectedSourceView = state.playlistSources[currentEffect.index];
        var selectedSource = selectedSourceView
          ? sourceStore.getById(selectedSourceView.id)
          : null;
        if (selectedSource) {
          loadPlaylist(selectedSource, { openChannels: true, reopenOnFailure: true });
        }
        break;
      case "REMEMBER_CHANNEL":
        rememberChannel(state.channels[state.playingIndex], state.playingIndex);
        break;
      case "SCHEDULE_PLAYBACK_SWITCH":
        schedulePlaybackSwitch(currentEffect);
        break;
      case "START_PLAYBACK":
        cancelPendingPlaybackSwitch();
        beginPlaybackMetric(
          currentEffect.source || "automatic",
          currentEffect.inputAt
        );
        dispatch({
          type: "START_PLAYBACK_ATTEMPT",
          expectedPlayingIndex: state.playingIndex
        });
        break;
      case "EXECUTE_PLAYBACK_ATTEMPT":
        startPlaybackAttempt(currentEffect.attemptId, currentEffect.playingIndex);
        break;
      case "CLEAR_PLAYBACK_TIMERS":
        clearPlaybackTimers();
        break;
      case "SCHEDULE_STALL_TIMEOUT":
        scheduleStallTimeout(currentEffect.attemptId);
        break;
      case "SCHEDULE_PLAYBACK_RETRY":
        schedulePlaybackRetry(currentEffect.attemptId, currentEffect.playingIndex);
        break;
      default:
        break;
    }
  }

  function renderState(previousState, event) {
    var panelIsOpen = state.uiMode === UI_MODE_CHANNELS;
    var uiIsHidden = state.uiMode === UI_MODE_HIDDEN;
    var sourceFormIsOpen = state.uiMode === UI_MODE_SOURCE_FORM;
    var playingChannel = state.channels[state.playingIndex];
    var browserState = state.channelBrowser;

    uiLayer.classList.toggle("is-hidden", uiIsHidden);
    uiLayer.classList.toggle("is-source-form-open", sourceFormIsOpen);
    channelPanelView.render({
      open: panelIsOpen,
      browserColumn: browserState.column,
      sources: state.playlistSources,
      activeSourceId: state.activeSourceId,
      canAddSource: state.canAddSource,
      channels: state.channels,
      selectedGroup: browserState.selectedGroup,
      focusedSourceIndex: browserState.focusedSourceIndex,
      focusedGroupIndex: browserState.focusedGroupIndex,
      focusedIndex: browserState.focusedChannelIndex,
      playingIndex: state.playingIndex,
      programs: getChannelEpgPrograms(state.channels[browserState.focusedChannelIndex]),
      shouldScroll: panelIsOpen &&
        interaction.shouldScrollForEvent(event) &&
        (previousState.uiMode !== UI_MODE_CHANNELS ||
          previousState.channelBrowser.focusedChannelIndex !==
            browserState.focusedChannelIndex)
    });

    if (panelIsOpen && browserState.column === 0) {
      okHintLabel.textContent = browserState.focusedSourceIndex >= state.playlistSources.length
        ? "添加播放源"
        : "选择播放源";
    } else if (panelIsOpen && browserState.column === 1) {
      okHintLabel.textContent = browserState.focusedGroupIndex === 0
        ? "编辑播放源"
        : "选择分组";
    } else if (panelIsOpen) {
      okHintLabel.textContent = "播放频道";
    } else if (
      state.playbackStatus === interaction.constants.PLAYBACK_FAILED ||
      state.playbackStatus === interaction.constants.PLAYBACK_ENDED
    ) {
      okHintLabel.textContent = "重试";
    } else {
      okHintLabel.textContent = "播放";
    }

    if (state.playlistStatus === "loading") {
      setConnectionState("连接中", "");
    } else if (state.playlistStatus === "ready") {
      setConnectionState("已连接", "is-online");
    } else if (state.playlistStatus === "unconfigured") {
      setConnectionState("未配置", "is-error");
    } else {
      setConnectionState("连接失败", "is-error");
    }

    if (playingChannel) {
      currentTitle.textContent = playingChannel.name;
      nowPlayingTitle.textContent = playingChannel.name;
      nowPlayingGroup.textContent = playingChannel.group;
      renderNowPlayingProgram(playingChannel);
    } else {
      currentTitle.textContent = state.titleMessage;
      nowPlayingTitle.textContent = state.titleMessage;
      renderNowPlayingProgram(null);
    }

    if (
      previousState.playerMessage !== state.playerMessage ||
      previousState.playerDetails !== state.playerDetails
    ) {
      setPlayerStatus(state.playerMessage, state.playerDetails);
    }

    updatePlaybackOverlay(event);
  }

  function scheduleUiHide() {
    clearTimeout(uiHideTimer);
    uiHideTimer = setTimeout(function () {
      uiHideTimer = null;
      dispatch({ type: "UI_TIMEOUT" });
    }, UI_HIDE_DELAY_MS);
  }

  function exitApp() {
    flushRememberedChannels();
    if (window.webOS && typeof window.webOS.platformBack === "function") {
      window.webOS.platformBack();
      return;
    }

    if (window.PalmSystem && typeof window.PalmSystem.platformBack === "function") {
      window.PalmSystem.platformBack();
      return;
    }

    window.close();
  }

  function getPlaylistKey(value) {
    var hash = 0;
    var text = String(value || "");
    var index;

    for (index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) | 0;
    }

    return String(hash >>> 0);
  }

  function getInitialChannelIndex(channels, source) {
    var saved = source && source.lastChannel ? source.lastChannel : null;
    var matchedIndex = -1;

    if (!saved) {
      try {
        var legacySaved = JSON.parse(window.localStorage.getItem(LAST_CHANNEL_STORAGE_KEY) || "null");
        if (legacySaved && legacySaved.playlistKey === getPlaylistKey(source ? source.url : "")) {
          saved = legacySaved;
        }
      } catch (error) {
        saved = null;
      }
    }

    if (!saved) return 0;

    if (saved.channelId) {
      channels.some(function (channel, index) {
        if (channel.id === saved.channelId) {
          matchedIndex = index;
          return true;
        }
        return false;
      });
    }

    if (matchedIndex < 0 && saved.name) {
      channels.some(function (channel, index) {
        if (channel.name === saved.name && channel.group === saved.group) {
          matchedIndex = index;
          return true;
        }
        return false;
      });
    }

    if (matchedIndex < 0 && Number(saved.index) >= 0 && Number(saved.index) < channels.length) {
      matchedIndex = Number(saved.index);
    }

    return matchedIndex >= 0 ? matchedIndex : 0;
  }

  function rememberChannel(channel, index) {
    if (!channel || !activeSource) return;
    pendingChannelMemories[activeSource.id] = {
      id: activeSource.id,
      channel: {
        id: channel.id || "",
        name: channel.name || "",
        group: channel.group || ""
      },
      index: index
    };
    clearTimeout(channelRememberTimer);
    channelRememberTimer = setTimeout(flushRememberedChannels, CHANNEL_REMEMBER_DELAY_MS);
  }

  function flushRememberedChannels() {
    clearTimeout(channelRememberTimer);
    channelRememberTimer = null;
    var entries = Object.keys(pendingChannelMemories).map(function (id) {
      return pendingChannelMemories[id];
    });
    pendingChannelMemories = {};
    if (entries.length) sourceStore.rememberChannels(entries);
  }

  function parseM3U(text, baseUrl) {
    var result = window.IPTVCore.parseM3U(text, baseUrl);
    discoveredEpgUrl = result.epgUrl;
    return result.channels;
  }

  function buildPlaylistRequestOptions(requestConfig) {
    requestConfig = requestConfig || PLAYLIST_REQUEST;
    var options = {
      method: (requestConfig.method || "GET").toUpperCase(),
      cache: requestConfig.cache || "no-store"
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
      if (requestConfig[field] !== undefined) {
        options[field] = requestConfig[field];
      }
    });

    return options;
  }

  function buildEpgRequestOptions(requestConfig) {
    requestConfig = requestConfig || EPG_REQUEST;
    var options = {
      method: (requestConfig.method || "GET").toUpperCase(),
      cache: requestConfig.cache || "no-store"
    };
    ["headers", "body", "credentials", "mode", "redirect", "referrer", "referrerPolicy"]
      .forEach(function (field) {
        if (requestConfig[field] !== undefined) options[field] = requestConfig[field];
      });
    return options;
  }

  function parseXmltv(text) {
    epgProgramsByChannel = window.IPTVCore.parseXmltv(text);
  }

  function getChannelEpgPrograms(channel) {
    if (!channel) return [];
    var keys = [channel.id, channel.name];
    var result = [];
    keys.some(function (key) {
      var normalized = String(key || "").trim().toLowerCase();
      if (normalized && epgProgramsByChannel[normalized]) {
        result = epgProgramsByChannel[normalized];
        return true;
      }
      return false;
    });
    return result;
  }

  function formatProgramTime(date) {
    return String(date.getHours()).padStart(2, "0") +
      ":" +
      String(date.getMinutes()).padStart(2, "0");
  }

  function getCurrentProgram(channel, now) {
    var currentTime = now.getTime();
    var programs = getChannelEpgPrograms(channel);
    for (var index = 0; index < programs.length; index += 1) {
      if (
        programs[index].start.getTime() <= currentTime &&
        programs[index].stop.getTime() > currentTime
      ) {
        return programs[index];
      }
    }
    return null;
  }

  function renderNowPlayingProgram(channel) {
    var now = new Date();
    var program = getCurrentProgram(channel, now);
    var progress = 0;

    if (program) {
      var duration = program.stop.getTime() - program.start.getTime();
      if (duration > 0) {
        progress = Math.max(0, Math.min(100,
          ((now.getTime() - program.start.getTime()) / duration) * 100
        ));
      }
      nowPlayingProgramTitle.textContent = program.title;
      nowPlayingProgramTime.textContent =
        formatProgramTime(program.start) + " – " + formatProgramTime(program.stop);
    } else {
      nowPlayingProgramTitle.textContent = "暂无当前节目信息";
      nowPlayingProgramTime.textContent = "";
    }

    nowPlayingProgress.setAttribute("aria-valuenow", String(Math.round(progress)));
    nowPlayingProgressValue.style.width = progress.toFixed(1) + "%";
  }

  function loadEpg(url, requestConfig, expectedLoadId) {
    if (!url) return;
    var requestUrl = url.replace(/\.gz(?=($|\?))/i, "");
    fetch(requestUrl, buildEpgRequestOptions(requestConfig))
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.text();
      })
      .then(function (text) {
        if (expectedLoadId !== playlistLoadId) return;
        parseXmltv(text);
        renderState(state, { type: "EPG_READY" });
      })
      .catch(function () {
        if (expectedLoadId === playlistLoadId) epgProgramsByChannel = {};
      });
  }

  function getPlaylistDisplayName(source) {
    return sourceStore.displayName(source || activeSource || {});
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

  function getMonotonicTime() {
    if (window.performance && typeof window.performance.now === "function") {
      return window.performance.now();
    }
    return Date.now();
  }

  function roundDuration(value) {
    return value === null || value === undefined
      ? null
      : Math.max(0, Math.round(value));
  }

  function publishPlaybackMetric(metric) {
    var inputAt = metric.inputAt;
    var sourceAssignedAt = metric.sourceAssignedAt;

    window.__IPTV_PERFORMANCE__ = {
      source: metric.source,
      attemptId: metric.attemptId,
      keyToRequestMs: inputAt === null
        ? null
        : roundDuration(metric.requestAt - inputAt),
      keyToSourceMs: inputAt === null || sourceAssignedAt === null
        ? null
        : roundDuration(sourceAssignedAt - inputAt),
      sourceToMetadataMs: sourceAssignedAt === null || metric.metadataAt === null
        ? null
        : roundDuration(metric.metadataAt - sourceAssignedAt),
      sourceToCanPlayMs: sourceAssignedAt === null || metric.canPlayAt === null
        ? null
        : roundDuration(metric.canPlayAt - sourceAssignedAt),
      sourceToPlayingMs: sourceAssignedAt === null || metric.playingAt === null
        ? null
        : roundDuration(metric.playingAt - sourceAssignedAt)
    };
  }

  function beginPlaybackMetric(source, inputAt) {
    pendingPlaybackMetric = {
      source: source,
      inputAt: typeof inputAt === "number" ? inputAt : null,
      requestAt: getMonotonicTime(),
      attemptId: null,
      sourceAssignedAt: null,
      metadataAt: null,
      canPlayAt: null,
      playingAt: null
    };
    publishPlaybackMetric(pendingPlaybackMetric);
  }

  function attachPlaybackMetric(attemptId) {
    activePlaybackMetric = pendingPlaybackMetric || {
      source: "retry",
      inputAt: null,
      requestAt: getMonotonicTime(),
      attemptId: null,
      sourceAssignedAt: null,
      metadataAt: null,
      canPlayAt: null,
      playingAt: null
    };
    pendingPlaybackMetric = null;
    activePlaybackMetric.attemptId = attemptId;
    publishPlaybackMetric(activePlaybackMetric);
  }

  function recordPlaybackMetric(stage, attemptId) {
    if (!activePlaybackMetric || activePlaybackMetric.attemptId !== attemptId) return;
    if (stage === "source") activePlaybackMetric.sourceAssignedAt = getMonotonicTime();
    if (stage === "metadata") activePlaybackMetric.metadataAt = getMonotonicTime();
    if (stage === "canplay") activePlaybackMetric.canPlayAt = getMonotonicTime();
    if (stage === "playing") activePlaybackMetric.playingAt = getMonotonicTime();
    publishPlaybackMetric(activePlaybackMetric);
  }

  function cancelPendingPlaybackSwitch() {
    clearTimeout(channelSwitchTimer);
    channelSwitchTimer = null;
  }

  function schedulePlaybackSwitch(currentEffect) {
    cancelPendingPlaybackSwitch();
    clearPlaybackTimers();
    if (hasPlayedMedia) hidePlaybackOverlay();
    beginPlaybackMetric("remote-navigation", currentEffect.inputAt);

    channelSwitchTimer = setTimeout(function () {
      channelSwitchTimer = null;
      if (state.playingIndex !== currentEffect.playingIndex) return;

      if (
        activeMediaIndex === currentEffect.playingIndex &&
        activeMediaAttemptId === state.playbackAttemptId &&
        player.readyState >= 2
      ) {
        pendingPlaybackMetric = null;
        dispatch({
          type: "PLAYBACK_PLAYING",
          attemptId: activeMediaAttemptId
        });
        return;
      }

      pendingPlaybackMetric.requestAt = getMonotonicTime();
      publishPlaybackMetric(pendingPlaybackMetric);
      rememberChannel(state.channels[state.playingIndex], state.playingIndex);
      dispatch({
        type: "START_PLAYBACK_ATTEMPT",
        expectedPlayingIndex: currentEffect.playingIndex
      });
    }, CHANNEL_SWITCH_DELAY_MS);
  }

  function clearLoadingIndicatorTimer() {
    clearTimeout(loadingIndicatorTimer);
    loadingIndicatorTimer = null;
    loadingIndicatorAttemptId = -1;
  }

  function hidePlaybackOverlay() {
    clearLoadingIndicatorTimer();
    playerPlaceholder.classList.remove("is-compact");
    playerPlaceholder.classList.add("is-hidden");
  }

  function showFullPlaybackOverlay() {
    clearLoadingIndicatorTimer();
    playerPlaceholder.classList.remove("is-hidden", "is-compact");
  }

  function showCompactPlaybackOverlay() {
    clearLoadingIndicatorTimer();
    playerPlaceholder.classList.remove("is-hidden");
    playerPlaceholder.classList.add("is-compact");
  }

  function scheduleCompactPlaybackOverlay(attemptId) {
    if (loadingIndicatorTimer && loadingIndicatorAttemptId === attemptId) return;
    clearLoadingIndicatorTimer();
    playerPlaceholder.classList.add("is-hidden");
    playerPlaceholder.classList.remove("is-compact");
    loadingIndicatorAttemptId = attemptId;
    loadingIndicatorTimer = setTimeout(function () {
      loadingIndicatorTimer = null;
      loadingIndicatorAttemptId = -1;
      if (
        attemptId === state.playbackAttemptId &&
        state.playbackStatus !== PLAYBACK_PLAYING
      ) {
        showCompactPlaybackOverlay();
      }
    }, LOADING_INDICATOR_DELAY_MS);
  }

  function updatePlaybackOverlay(event) {
    if (state.playbackStatus === PLAYBACK_PLAYING) {
      hasPlayedMedia = true;
      hidePlaybackOverlay();
      return;
    }

    if (state.playbackStatus === interaction.constants.PLAYBACK_FAILED ||
        state.playbackStatus === interaction.constants.PLAYBACK_ENDED) {
      showFullPlaybackOverlay();
      return;
    }

    if (!hasPlayedMedia) {
      showFullPlaybackOverlay();
      return;
    }

    if (event.type === "PLAYBACK_BUFFERING") {
      scheduleCompactPlaybackOverlay(state.playbackAttemptId);
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

  function buildPlaybackDiagnostics(reason, error, retryCount) {
    var channel = state.channels[state.playingIndex];
    var stream = getStreamInfo(channel ? channel.url : "");
    var support = stream.mime && player.canPlayType ? player.canPlayType(stream.mime) : "";
    var details = [
      "原因：" + reason,
      "媒体错误：" + getMediaErrorName(player.error),
      "网络状态：" + getNetworkStateName(player.networkState),
      "就绪状态：" + getReadyStateName(player.readyState),
      "流类型：" + stream.label + (support ? "（" + support + "）" : ""),
      "重试：" + retryCount + "/" + MAX_PLAYBACK_RETRIES
    ];
    var safeMessage = sanitizeErrorMessage(error);
    if (safeMessage) details.push("浏览器信息：" + safeMessage);

    window.__IPTV_DIAGNOSTICS__ = {
      reason: reason,
      mediaError: getMediaErrorName(player.error),
      networkState: getNetworkStateName(player.networkState),
      readyState: getReadyStateName(player.readyState),
      streamType: stream.label,
      retryCount: retryCount,
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

  function scheduleStallTimeout(attemptId) {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(function () {
      if (attemptId === state.playbackAttemptId && state.playbackHasStarted) {
        reportPlaybackFailure(
          "缓冲超过 " + Math.round(STALL_TIMEOUT_MS / 1000) + " 秒",
          null,
          attemptId
        );
      }
    }, STALL_TIMEOUT_MS);
  }

  function schedulePlaybackRetry(attemptId, playingIndex) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(function () {
      retryTimer = null;
      if (
        state.playbackStatus === PLAYBACK_RETRYING &&
        state.playbackAttemptId === attemptId &&
        state.playingIndex === playingIndex
      ) {
        beginPlaybackMetric("retry", null);
        dispatch({
          type: "START_PLAYBACK_ATTEMPT",
          expectedPlayingIndex: playingIndex
        });
      }
    }, RETRY_DELAY_MS);
  }

  function reportPlaybackFailure(reason, error, attemptId) {
    if (
      state.playingIndex < 0 ||
      attemptId !== state.playbackAttemptId ||
      state.failedAttemptId === attemptId
    ) {
      return;
    }

    var willRetry = state.playbackRetryCount < MAX_PLAYBACK_RETRIES;
    var retryCount = willRetry
      ? state.playbackRetryCount + 1
      : state.playbackRetryCount;

    dispatch({
      type: "PLAYBACK_FAILURE",
      attemptId: attemptId,
      willRetry: willRetry,
      retryCount: retryCount,
      details: buildPlaybackDiagnostics(reason, error, retryCount)
    });
  }

  function startPlaybackAttempt(attemptId, playingIndex) {
    var channel = state.channels[playingIndex];
    if (!channel || attemptId !== state.playbackAttemptId) return;

    clearPlaybackTimers();
    activeMediaAttemptId = attemptId;
    activeMediaIndex = playingIndex;
    attachPlaybackMetric(attemptId);
    if (hasPlayedMedia) {
      scheduleCompactPlaybackOverlay(attemptId);
    } else {
      showFullPlaybackOverlay();
    }
    player.pause();
    player.src = channel.url;
    recordPlaybackMetric("source", attemptId);
    player.load();

    startupTimer = setTimeout(function () {
      if (
        attemptId === state.playbackAttemptId &&
        !state.playbackHasStarted
      ) {
        reportPlaybackFailure(
          "起播超过 " + Math.round(STARTUP_TIMEOUT_MS / 1000) + " 秒",
          null,
          attemptId
        );
      }
    }, STARTUP_TIMEOUT_MS);

    var playPromise = player.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function (error) {
        if (attemptId !== state.playbackAttemptId || (error && error.name === "AbortError")) return;
        reportPlaybackFailure("play() 被拒绝", error, attemptId);
      });
    }
  }

  function loadPlaylist(source, options) {
    options = options || {};
    if (!source || !source.url) {
      dispatch({ type: "PLAYLIST_UNCONFIGURED" });
      return;
    }

    var currentLoadId = ++playlistLoadId;
    dispatch({ type: "PLAYLIST_LOADING" });
    fetch(source.url, buildPlaylistRequestOptions(source.request))
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.text().then(function (text) {
          return {
            text: text,
            baseUrl: response.url || source.url
          };
        });
      })
      .then(function (playlist) {
        if (currentLoadId !== playlistLoadId) return;
        discoveredEpgUrl = "";
        var channels = parseM3U(playlist.text, playlist.baseUrl);
        if (!channels.length) {
          throw new Error("播放列表中没有频道");
        }

        sourceStore.setActive(source.id);
        var storedSource = sourceStore.getById(source.id) || source;
        applySourceConfig(storedSource);
        epgProgramsByChannel = {};
        var sourceViews = getSourceViews();
        dispatch({
          type: "PLAYLIST_READY",
          channels: channels,
          sources: sourceViews,
          activeSourceId: storedSource.id,
          activeSourceIndex: getActiveSourceIndex(sourceViews),
          canAddSource: sourceStore.canAdd(),
          playlistName: getPlaylistDisplayName(storedSource),
          initialIndex: getInitialChannelIndex(channels, storedSource),
          openChannels: Boolean(options.openChannels)
        });
        loadEpg(
          storedSource.epgUrl || discoveredEpgUrl,
          storedSource.epgRequest,
          currentLoadId
        );
      })
      .catch(function (error) {
        if (currentLoadId !== playlistLoadId) return;
        dispatch({
          type: "PLAYLIST_FAILED",
          message: error.message + " · 请确认 M3U 数据源可访问"
        });
        publishSources();
        if (options.reopenOnFailure) {
          showSourceForm("edit", sourceStore.getById(source.id) || source, error.message, false);
        }
      });
  }

  document.addEventListener("keydown", function (event) {
    if (sourceFormView.isOpen()) {
      sourceFormView.handleKey(event);
      return;
    }
    var inputAt = getMonotonicTime();
    switch (event.keyCode) {
      case 37:
        event.preventDefault();
        dispatch({ type: "KEY_LEFT" });
        break;
      case 39:
        event.preventDefault();
        dispatch({ type: "KEY_RIGHT" });
        break;
      case 38:
        event.preventDefault();
        dispatch({ type: "KEY_UP", delta: -1, inputAt: inputAt });
        break;
      case 40:
        event.preventDefault();
        dispatch({ type: "KEY_DOWN", delta: 1, inputAt: inputAt });
        break;
      case 13:
        event.preventDefault();
        dispatch({ type: "KEY_OK", inputAt: inputAt });
        break;
      case 33:
        event.preventDefault();
        dispatch({ type: "KEY_PAGE_UP", delta: -8 });
        break;
      case 34:
        event.preventDefault();
        dispatch({ type: "KEY_PAGE_DOWN", delta: 8 });
        break;
      case 461:
      case 27:
        event.preventDefault();
        dispatch({ type: "KEY_BACK" });
        break;
      default:
        dispatch({ type: "USER_ACTIVITY" });
        break;
    }
  });

  document.addEventListener("wheel", function (event) {
    event.preventDefault();
    var wasHidden = state.uiMode === UI_MODE_HIDDEN;
    dispatch({ type: "WHEEL_ACTIVITY" });
    if (wasHidden || !state.channels.length) {
      wheelAccumulator = 0;
      return;
    }

    var now = Date.now();
    if (
      now - lastWheelEventAt > 500 ||
      (wheelAccumulator > 0 && event.deltaY < 0) ||
      (wheelAccumulator < 0 && event.deltaY > 0)
    ) {
      wheelAccumulator = 0;
    }
    lastWheelEventAt = now;
    wheelAccumulator += event.deltaY;

    if (Math.abs(wheelAccumulator) < 80 || now - lastWheelStepAt < 120) return;
    dispatch({ type: "WHEEL_STEP", delta: wheelAccumulator > 0 ? 1 : -1 });
    wheelAccumulator = 0;
    lastWheelStepAt = now;
  }, { passive: false });

  document.addEventListener("mousemove", function () {
    var now = Date.now();
    if (now - lastPointerActivityAt < 250) return;
    lastPointerActivityAt = now;
    dispatch({ type: "POINTER_MOVE" });
  });

  player.addEventListener("playing", function () {
    if (channelSwitchTimer) return;
    recordPlaybackMetric("playing", activeMediaAttemptId);
    dispatch({
      type: "PLAYBACK_PLAYING",
      attemptId: activeMediaAttemptId
    });
  });

  player.addEventListener("waiting", function () {
    if (channelSwitchTimer) return;
    var attemptId = activeMediaAttemptId;
    dispatch({
      type: "PLAYBACK_BUFFERING",
      attemptId: attemptId,
      message: "正在缓冲…",
      details: buildPlaybackDiagnostics("播放器等待数据", null, state.playbackRetryCount)
    });
  });

  player.addEventListener("stalled", function () {
    if (channelSwitchTimer) return;
    var attemptId = activeMediaAttemptId;
    dispatch({
      type: "PLAYBACK_BUFFERING",
      attemptId: attemptId,
      message: "媒体数据暂时中断…",
      details: buildPlaybackDiagnostics("网络数据停滞", null, state.playbackRetryCount)
    });
  });

  player.addEventListener("loadedmetadata", function () {
    if (channelSwitchTimer) return;
    recordPlaybackMetric("metadata", activeMediaAttemptId);
    dispatch({
      type: "PLAYBACK_METADATA",
      attemptId: activeMediaAttemptId,
      details: buildPlaybackDiagnostics("已读取媒体信息", null, state.playbackRetryCount)
    });
  });

  player.addEventListener("canplay", function () {
    if (channelSwitchTimer) return;
    recordPlaybackMetric("canplay", activeMediaAttemptId);
  });

  player.addEventListener("error", function () {
    if (channelSwitchTimer) return;
    reportPlaybackFailure("媒体元素报告错误", player.error, activeMediaAttemptId);
  });

  player.addEventListener("ended", function () {
    if (channelSwitchTimer) return;
    var attemptId = activeMediaAttemptId;
    dispatch({
      type: "PLAYBACK_ENDED",
      attemptId: attemptId,
      details: buildPlaybackDiagnostics("媒体播放结束", null, state.playbackRetryCount)
    });
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) flushRememberedChannels();
  });

  window.addEventListener("pagehide", flushRememberedChannels);

  function updateClock() {
    var now = new Date();
    clock.textContent =
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0");
    renderNowPlayingProgram(state.channels[state.playingIndex]);
  }

  renderState(state, { type: "INITIAL_RENDER" });
  updateClock();
  setInterval(updateClock, 30000);
  publishSources();
  if (activeSource) {
    loadPlaylist(activeSource, { openChannels: false, reopenOnFailure: false });
  } else {
    dispatch({ type: "PLAYLIST_UNCONFIGURED" });
    showSourceForm("add", null, "", true);
  }
})();
