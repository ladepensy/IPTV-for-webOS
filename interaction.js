(function (root, factory) {
  "use strict";

  var channelBrowserApi = typeof module === "object" && module.exports
    ? require("./features/channels/channel-browser-state.js")
    : root.IPTVChannelBrowserState;
  var api = factory(channelBrowserApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.IPTVInteraction = api;
})(typeof window !== "undefined" ? window : this, function (channelBrowserApi) {
  "use strict";

  if (!channelBrowserApi) throw new Error("IPTVChannelBrowserState is required");

  var constants = {
    UI_MODE_HIDDEN: "hidden",
    UI_MODE_INFO: "info",
    UI_MODE_CHANNELS: "channels",
    UI_MODE_SOURCE_FORM: "source-form",
    PLAYBACK_IDLE: "idle",
    PLAYBACK_LOADING: "loading",
    PLAYBACK_PLAYING: "playing",
    PLAYBACK_BUFFERING: "buffering",
    PLAYBACK_RETRYING: "retrying",
    PLAYBACK_FAILED: "failed",
    PLAYBACK_ENDED: "ended"
  };

  function create(options) {
    var maxPlaybackRetries = options.maxPlaybackRetries;
    var getStreamInfo = options.getStreamInfo;

    function createInitialState() {
      return {
        uiMode: constants.UI_MODE_INFO,
        playlistStatus: "loading",
        channels: [],
        playlistSources: [],
        activeSourceId: "",
        canAddSource: true,
        channelBrowser: channelBrowserApi.createInitialState(0),
        playingIndex: -1,
        playbackStatus: constants.PLAYBACK_IDLE,
        playbackAttemptId: 0,
        playbackRetryCount: 0,
        playbackHasStarted: false,
        failedAttemptId: -1,
        titleMessage: "正在载入频道…",
        playerMessage: "正在获取播放列表",
        playerDetails: []
      };
    }

    function copyState(source) {
      var result = {};
      Object.keys(source).forEach(function (key) {
        result[key] = source[key];
      });
      result.channelBrowser = channelBrowserApi.copyState(source.channelBrowser);
      return result;
    }

    function effect(type, data) {
      var result = data || {};
      result.type = type;
      return result;
    }

    function transitionResult(nextState, effects) {
      return {
        state: nextState,
        effects: effects || []
      };
    }

    function clampChannelIndex(index, channels) {
      if (!channels.length) return 0;
      return Math.max(0, Math.min(channels.length - 1, index));
    }

    function getWrappedChannelIndex(index, delta, channels, selectedGroup) {
      if (!channels.length) return 0;
      var currentIndex = clampChannelIndex(index, channels);
      var currentGroup = selectedGroup || "全部";
      var groupIndices = [];
      channels.forEach(function (channel, channelIndex) {
        if (currentGroup === "全部" || (channel.group || "其他") === currentGroup) {
          groupIndices.push(channelIndex);
        }
      });
      var position = groupIndices.indexOf(currentIndex);
      if (position < 0) {
        currentGroup = channels[currentIndex].group || "其他";
        groupIndices = [];
        channels.forEach(function (channel, channelIndex) {
          if ((channel.group || "其他") === currentGroup) groupIndices.push(channelIndex);
        });
        position = groupIndices.indexOf(currentIndex);
      }
      var targetPosition = ((position + delta) % groupIndices.length + groupIndices.length) % groupIndices.length;
      return groupIndices[targetPosition];
    }

    function getBrowserContext(nextState) {
      return {
        channels: nextState.channels,
        sources: nextState.playlistSources,
        canAddSource: nextState.canAddSource
      };
    }

    function updateChannelBrowser(nextState, event) {
      var outcome = channelBrowserApi.transition(
        nextState.channelBrowser,
        event,
        getBrowserContext(nextState)
      );
      nextState.channelBrowser = outcome.state;
      return outcome.action;
    }

    function openChannels(nextState) {
      var activeSourceIndex = 0;
      nextState.playlistSources.some(function (source, index) {
        if (source.id !== nextState.activeSourceId) return false;
        activeSourceIndex = index;
        return true;
      });
      nextState.uiMode = constants.UI_MODE_CHANNELS;
      updateChannelBrowser(nextState, {
        type: "OPEN",
        playingIndex: nextState.playingIndex,
        activeSourceIndex: activeSourceIndex,
        selectedGroup: nextState.channelBrowser.selectedGroup
      });
      nextState.channelBrowser.column = nextState.playingIndex >= 0 && nextState.channels[nextState.playingIndex]
        ? channelBrowserApi.constants.COLUMN_CHANNELS
        : channelBrowserApi.constants.COLUMN_SOURCES;
    }

    function selectChannel(nextState, index) {
      var selectedIndex = clampChannelIndex(index, nextState.channels);
      updateChannelBrowser(nextState, { type: "CHANNEL_FOCUS", index: selectedIndex });
      nextState.playingIndex = selectedIndex;
      nextState.uiMode = constants.UI_MODE_INFO;
      nextState.playbackStatus = constants.PLAYBACK_LOADING;
      nextState.playbackRetryCount = 0;
      nextState.playbackHasStarted = false;
      nextState.failedAttemptId = -1;
      nextState.titleMessage = "";
    }

    function handleBrowserAction(nextState, action, effects) {
      if (!action) return;
      if (action.type === "ADD_SOURCE") {
        nextState.uiMode = constants.UI_MODE_SOURCE_FORM;
        effects.push(effect("CANCEL_UI_HIDE"));
        effects.push(effect("OPEN_SOURCE_FORM", { mode: "add" }));
        return;
      }
      if (action.type === "EDIT_SOURCE") {
        nextState.uiMode = constants.UI_MODE_SOURCE_FORM;
        effects.push(effect("CANCEL_UI_HIDE"));
        effects.push(effect("OPEN_SOURCE_FORM", { mode: "edit" }));
        return;
      }
      if (action.type === "SOURCE_SELECTED") {
        var source = nextState.playlistSources[action.index];
        if (source && source.id !== nextState.activeSourceId) {
          effects.push(effect("LOAD_SOURCE", { index: action.index }));
        }
      }
    }

    function transition(current, event) {
      var next = copyState(current);
      var effects = [];
      var channel;

      switch (event.type) {
        case "USER_ACTIVITY":
          if (next.uiMode === constants.UI_MODE_SOURCE_FORM) break;
          if (next.uiMode === constants.UI_MODE_HIDDEN) {
            next.uiMode = constants.UI_MODE_INFO;
          }
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "POINTER_MOVE":
          if (next.uiMode === constants.UI_MODE_SOURCE_FORM) break;
          if (next.uiMode !== constants.UI_MODE_HIDDEN) {
            effects.push(effect("SCHEDULE_UI_HIDE"));
          }
          break;

        case "KEY_LEFT":
          if (next.uiMode === constants.UI_MODE_SOURCE_FORM) break;
          if (next.uiMode === constants.UI_MODE_CHANNELS) {
            var leftAction = updateChannelBrowser(next, { type: "LEFT" });
            if (leftAction && leftAction.type === "CLOSE") {
              next.uiMode = constants.UI_MODE_INFO;
            }
          } else {
            next.uiMode = constants.UI_MODE_INFO;
          }
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "KEY_RIGHT":
          if (next.uiMode === constants.UI_MODE_SOURCE_FORM) break;
          if (next.uiMode !== constants.UI_MODE_CHANNELS) {
            openChannels(next);
          } else {
            updateChannelBrowser(next, { type: "RIGHT" });
          }
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "KEY_UP":
        case "KEY_DOWN":
          if (next.uiMode === constants.UI_MODE_SOURCE_FORM) break;
          if (next.uiMode === constants.UI_MODE_CHANNELS) {
            updateChannelBrowser(next, { type: "MOVE", delta: event.delta });
            effects.push(effect("SCHEDULE_UI_HIDE"));
            break;
          }
          if (!next.channels.length) break;

          var currentPlayingIndex = next.playingIndex >= 0
            ? next.playingIndex
            : next.channelBrowser.focusedChannelIndex;
          var targetPlayingIndex = getWrappedChannelIndex(
            currentPlayingIndex,
            event.delta,
            next.channels,
            next.channelBrowser.selectedGroup
          );

          next.uiMode = constants.UI_MODE_INFO;
          if (targetPlayingIndex !== next.playingIndex) {
            selectChannel(next, targetPlayingIndex);
            effects.push(effect("SCHEDULE_PLAYBACK_SWITCH", {
              playingIndex: targetPlayingIndex,
              inputAt: event.inputAt
            }));
          }
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "KEY_PAGE_UP":
        case "KEY_PAGE_DOWN":
          if (next.uiMode === constants.UI_MODE_SOURCE_FORM) break;
          if (next.uiMode === constants.UI_MODE_HIDDEN) {
            next.uiMode = constants.UI_MODE_INFO;
            effects.push(effect("SCHEDULE_UI_HIDE"));
            break;
          }
          if (next.uiMode !== constants.UI_MODE_CHANNELS) {
            if (!next.channels.length) break;
            openChannels(next);
          }
          updateChannelBrowser(next, { type: "MOVE", delta: event.delta });
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "KEY_OK":
          if (next.uiMode === constants.UI_MODE_SOURCE_FORM) break;
          if (next.uiMode === constants.UI_MODE_HIDDEN) {
            next.uiMode = constants.UI_MODE_INFO;
            effects.push(effect("SCHEDULE_UI_HIDE"));
            break;
          }

          if (
            next.uiMode !== constants.UI_MODE_CHANNELS &&
            (next.playbackStatus === constants.PLAYBACK_FAILED ||
              next.playbackStatus === constants.PLAYBACK_ENDED) &&
            next.playingIndex >= 0
          ) {
            selectChannel(next, next.playingIndex);
            effects.push(effect("REMEMBER_CHANNEL"));
            effects.push(effect("START_PLAYBACK", {
              source: "remote-ok",
              inputAt: event.inputAt
            }));
            effects.push(effect("SCHEDULE_UI_HIDE"));
            break;
          }

          if (next.uiMode === constants.UI_MODE_CHANNELS) {
            var confirmAction = updateChannelBrowser(next, { type: "CONFIRM" });
            handleBrowserAction(next, confirmAction, effects);
            if (confirmAction && confirmAction.type === "CHANNEL_SELECTED") {
              selectChannel(next, confirmAction.index);
              effects.push(effect("REMEMBER_CHANNEL"));
              effects.push(effect("START_PLAYBACK", {
                source: "remote-ok",
                inputAt: event.inputAt
              }));
            }
            effects.push(effect("SCHEDULE_UI_HIDE"));
          } else if (next.channels.length) {
            openChannels(next);
            effects.push(effect("SCHEDULE_UI_HIDE"));
          } else {
            if (next.uiMode === constants.UI_MODE_HIDDEN) {
              next.uiMode = constants.UI_MODE_INFO;
            }
            effects.push(effect("SCHEDULE_UI_HIDE"));
          }
          break;

        case "KEY_BACK":
          if (next.uiMode === constants.UI_MODE_SOURCE_FORM) break;
          if (next.uiMode === constants.UI_MODE_HIDDEN) {
            effects.push(effect("EXIT_APP"));
          } else {
            next.uiMode = constants.UI_MODE_HIDDEN;
            effects.push(effect("CANCEL_UI_HIDE"));
          }
          break;

        case "WHEEL_ACTIVITY":
          if (next.uiMode === constants.UI_MODE_SOURCE_FORM) break;
          if (next.uiMode === constants.UI_MODE_HIDDEN) {
            next.uiMode = constants.UI_MODE_INFO;
            effects.push(effect("SCHEDULE_UI_HIDE"));
            break;
          }
          if (next.uiMode !== constants.UI_MODE_CHANNELS) {
            if (!next.channels.length && !next.playlistSources.length) break;
            openChannels(next);
          }
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "WHEEL_STEP":
          if (next.uiMode === constants.UI_MODE_SOURCE_FORM) break;
          if (next.uiMode === constants.UI_MODE_HIDDEN) {
            next.uiMode = constants.UI_MODE_INFO;
            effects.push(effect("SCHEDULE_UI_HIDE"));
            break;
          }
          if (next.uiMode !== constants.UI_MODE_CHANNELS) {
            if (!next.channels.length && !next.playlistSources.length) break;
            openChannels(next);
          }
          updateChannelBrowser(next, { type: "MOVE", delta: event.delta });
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "SOURCE_FOCUS":
          next.uiMode = constants.UI_MODE_CHANNELS;
          updateChannelBrowser(next, { type: "SOURCE_FOCUS", index: event.index });
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "SOURCE_SELECT":
          next.uiMode = constants.UI_MODE_CHANNELS;
          var sourceAction = updateChannelBrowser(next, { type: "SOURCE_SELECT", index: event.index });
          handleBrowserAction(next, sourceAction, effects);
          if (next.uiMode !== constants.UI_MODE_SOURCE_FORM) effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "GROUP_FOCUS":
          next.uiMode = constants.UI_MODE_CHANNELS;
          updateChannelBrowser(next, { type: "GROUP_FOCUS", index: event.index });
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "GROUP_SELECT":
          next.uiMode = constants.UI_MODE_CHANNELS;
          var groupAction = updateChannelBrowser(next, { type: "GROUP_SELECT", index: event.index });
          handleBrowserAction(next, groupAction, effects);
          if (next.uiMode !== constants.UI_MODE_SOURCE_FORM) effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "CHANNEL_FOCUS":
          if (!next.channels[event.index]) break;
          next.uiMode = constants.UI_MODE_CHANNELS;
          updateChannelBrowser(next, { type: "CHANNEL_FOCUS", index: event.index });
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "CHANNEL_CLICK":
          if (!next.channels[event.index]) break;
          selectChannel(next, event.index);
          effects.push(effect("REMEMBER_CHANNEL"));
          effects.push(effect("START_PLAYBACK", {
            source: "pointer",
            inputAt: event.inputAt
          }));
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "UI_TIMEOUT":
          if (next.uiMode !== constants.UI_MODE_SOURCE_FORM) {
            next.uiMode = constants.UI_MODE_HIDDEN;
          }
          break;

        case "SOURCES_UPDATED":
          next.playlistSources = event.sources || [];
          next.activeSourceId = event.activeSourceId || "";
          next.canAddSource = event.canAddSource !== false;
          if (!event.preserveBrowser) {
            updateChannelBrowser(next, {
              type: "RESET",
              initialChannelIndex: next.playingIndex,
              initialSourceIndex: Math.max(0, Number(event.activeSourceIndex) || 0)
            });
          }
          break;

        case "SOURCE_FORM_CLOSED":
          next.uiMode = event.returnMode === constants.UI_MODE_INFO
            ? constants.UI_MODE_INFO
            : constants.UI_MODE_CHANNELS;
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "SOURCE_FORM_OPENED":
          next.uiMode = constants.UI_MODE_SOURCE_FORM;
          effects.push(effect("CANCEL_UI_HIDE"));
          break;

        case "PLAYLIST_LOADING":
          next.playlistStatus = "loading";
          if (!next.channels.length) {
            next.titleMessage = "正在载入播放源…";
            next.playerMessage = "正在获取播放列表";
            next.playerDetails = [];
          }
          break;

        case "ACTIVE_SOURCE_REMOVED":
          next.channels = [];
          next.playingIndex = -1;
          next.playbackStatus = constants.PLAYBACK_IDLE;
          next.playbackRetryCount = 0;
          next.playbackHasStarted = false;
          next.titleMessage = "正在切换播放源…";
          next.playerMessage = "正在获取播放列表";
          next.playerDetails = [];
          break;

        case "PLAYLIST_UNCONFIGURED":
          next.playlistStatus = "unconfigured";
          next.channels = [];
          next.playlistSources = [];
          next.activeSourceId = "";
          next.playingIndex = -1;
          next.playbackStatus = constants.PLAYBACK_IDLE;
          next.uiMode = constants.UI_MODE_INFO;
          next.titleMessage = "尚未配置播放列表";
          next.playerMessage = "请添加一个 M3U 播放源";
          next.playerDetails = [];
          break;

        case "PLAYLIST_READY":
          next.playlistStatus = "ready";
          next.channels = event.channels;
          next.playlistSources = event.sources || next.playlistSources;
          next.activeSourceId = event.activeSourceId || next.activeSourceId;
          next.canAddSource = event.canAddSource !== false;
          updateChannelBrowser(next, {
            type: "RESET",
            initialChannelIndex: event.initialIndex,
            initialSourceIndex: event.activeSourceIndex,
            initialGroup: event.initialGroup
          });
          selectChannel(next, event.initialIndex);
          if (event.openChannels) {
            next.uiMode = constants.UI_MODE_CHANNELS;
            next.channelBrowser.column = channelBrowserApi.constants.COLUMN_CHANNELS;
          }
          effects.push(effect("REMEMBER_CHANNEL"));
          effects.push(effect("START_PLAYBACK"));
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "PLAYLIST_FAILED":
          next.playlistStatus = "failed";
          next.uiMode = constants.UI_MODE_INFO;
          next.titleMessage = "播放列表加载失败";
          next.playerMessage = event.message;
          next.playerDetails = [];
          break;

        case "START_PLAYBACK_ATTEMPT":
          if (next.playingIndex < 0 || !next.channels[next.playingIndex]) break;
          if (
            event.expectedPlayingIndex !== undefined &&
            event.expectedPlayingIndex !== next.playingIndex
          ) {
            break;
          }
          next.playbackAttemptId += 1;
          next.failedAttemptId = -1;
          next.playbackHasStarted = false;
          next.playbackStatus = constants.PLAYBACK_LOADING;
          channel = next.channels[next.playingIndex];
          next.playerMessage = "正在连接 " + channel.name;
          next.playerDetails = [
            "流类型：" + getStreamInfo(channel.url).label,
            "尝试：" + (next.playbackRetryCount + 1) + "/" + (maxPlaybackRetries + 1)
          ];
          effects.push(effect("EXECUTE_PLAYBACK_ATTEMPT", {
            attemptId: next.playbackAttemptId,
            playingIndex: next.playingIndex
          }));
          break;

        case "PLAYBACK_PLAYING":
          if (event.attemptId !== next.playbackAttemptId) break;
          next.playbackStatus = constants.PLAYBACK_PLAYING;
          next.playbackHasStarted = true;
          next.failedAttemptId = -1;
          effects.push(effect("CLEAR_PLAYBACK_TIMERS"));
          break;

        case "PLAYBACK_BUFFERING":
          if (
            event.attemptId !== next.playbackAttemptId ||
            next.failedAttemptId === event.attemptId
          ) {
            break;
          }
          next.playbackStatus = constants.PLAYBACK_BUFFERING;
          next.playerMessage = event.message;
          next.playerDetails = event.details;
          if (next.playbackHasStarted) {
            effects.push(effect("SCHEDULE_STALL_TIMEOUT", {
              attemptId: next.playbackAttemptId
            }));
          }
          break;

        case "PLAYBACK_METADATA":
          if (
            event.attemptId !== next.playbackAttemptId ||
            next.failedAttemptId === event.attemptId ||
            next.playbackHasStarted
          ) {
            break;
          }
          next.playerMessage = "媒体已识别，正在起播…";
          next.playerDetails = event.details;
          break;

        case "PLAYBACK_FAILURE":
          if (
            event.attemptId !== next.playbackAttemptId ||
            next.failedAttemptId === event.attemptId
          ) {
            break;
          }
          next.failedAttemptId = event.attemptId;
          next.playbackHasStarted = false;
          next.playbackRetryCount = event.retryCount;
          next.playbackStatus = event.willRetry
            ? constants.PLAYBACK_RETRYING
            : constants.PLAYBACK_FAILED;
          next.playerMessage = event.willRetry
            ? "播放异常，正在重试…"
            : "频道播放失败，请按 OK 重试或切换频道";
          next.playerDetails = event.details;
          effects.push(effect("CLEAR_PLAYBACK_TIMERS"));
          if (event.willRetry) {
            effects.push(effect("SCHEDULE_PLAYBACK_RETRY", {
              attemptId: event.attemptId,
              playingIndex: next.playingIndex
            }));
          }
          break;

        case "PLAYBACK_ENDED":
          if (event.attemptId !== next.playbackAttemptId) break;
          next.playbackStatus = constants.PLAYBACK_ENDED;
          next.playbackHasStarted = false;
          next.playerMessage = "频道播放已结束，按 OK 重新播放";
          next.playerDetails = event.details;
          effects.push(effect("CLEAR_PLAYBACK_TIMERS"));
          break;

        default:
          break;
      }

      return transitionResult(next, effects);
    }

    function shouldScrollForEvent(event) {
      return [
        "KEY_RIGHT",
        "KEY_UP",
        "KEY_DOWN",
        "KEY_PAGE_UP",
        "KEY_PAGE_DOWN",
        "WHEEL_ACTIVITY",
        "WHEEL_STEP",
        "PLAYLIST_READY",
        "SOURCES_UPDATED"
      ].indexOf(event.type) >= 0;
    }

    return {
      constants: constants,
      createInitialState: createInitialState,
      transition: transition,
      shouldScrollForEvent: shouldScrollForEvent
    };
  }

  return {
    constants: constants,
    create: create
  };
});
