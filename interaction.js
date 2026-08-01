(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.IPTVInteraction = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  var constants = {
    UI_MODE_HIDDEN: "hidden",
    UI_MODE_INFO: "info",
    UI_MODE_CHANNELS: "channels",
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
        focusedIndex: 0,
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

    function openChannels(nextState) {
      nextState.uiMode = constants.UI_MODE_CHANNELS;
      if (nextState.playingIndex >= 0) {
        nextState.focusedIndex = nextState.playingIndex;
      }
    }

    function moveChannelFocus(nextState, delta) {
      nextState.focusedIndex = clampChannelIndex(
        nextState.focusedIndex + delta,
        nextState.channels
      );
    }

    function selectChannel(nextState, index) {
      var selectedIndex = clampChannelIndex(index, nextState.channels);
      nextState.focusedIndex = selectedIndex;
      nextState.playingIndex = selectedIndex;
      nextState.uiMode = constants.UI_MODE_INFO;
      nextState.playbackStatus = constants.PLAYBACK_LOADING;
      nextState.playbackRetryCount = 0;
      nextState.playbackHasStarted = false;
      nextState.failedAttemptId = -1;
      nextState.titleMessage = "";
    }

    function transition(current, event) {
      var next = copyState(current);
      var effects = [];
      var channel;

      switch (event.type) {
        case "USER_ACTIVITY":
          if (next.uiMode === constants.UI_MODE_HIDDEN) {
            next.uiMode = constants.UI_MODE_INFO;
          }
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "KEY_LEFT":
          next.uiMode = constants.UI_MODE_INFO;
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "KEY_RIGHT":
          openChannels(next);
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "KEY_UP":
        case "KEY_DOWN":
          if (!next.channels.length) break;
          if (next.uiMode === constants.UI_MODE_CHANNELS) {
            moveChannelFocus(next, event.delta);
            effects.push(effect("SCHEDULE_UI_HIDE"));
            break;
          }

          var currentPlayingIndex = next.playingIndex >= 0
            ? next.playingIndex
            : next.focusedIndex;
          var targetPlayingIndex = clampChannelIndex(
            currentPlayingIndex + event.delta,
            next.channels
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
          if (next.uiMode === constants.UI_MODE_HIDDEN) {
            next.uiMode = constants.UI_MODE_INFO;
            effects.push(effect("SCHEDULE_UI_HIDE"));
            break;
          }
          if (!next.channels.length) break;
          if (next.uiMode !== constants.UI_MODE_CHANNELS) openChannels(next);
          moveChannelFocus(next, event.delta);
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "KEY_OK":
          if (next.uiMode === constants.UI_MODE_HIDDEN) {
            next.uiMode = constants.UI_MODE_INFO;
            effects.push(effect("SCHEDULE_UI_HIDE"));
            break;
          }

          if (
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

          if (next.uiMode === constants.UI_MODE_CHANNELS && next.channels.length) {
            selectChannel(next, next.focusedIndex);
            effects.push(effect("REMEMBER_CHANNEL"));
            effects.push(effect("START_PLAYBACK", {
              source: "remote-ok",
              inputAt: event.inputAt
            }));
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
          if (next.uiMode === constants.UI_MODE_HIDDEN) {
            effects.push(effect("EXIT_APP"));
          } else {
            next.uiMode = constants.UI_MODE_HIDDEN;
            effects.push(effect("CANCEL_UI_HIDE"));
          }
          break;

        case "WHEEL_ACTIVITY":
          if (next.uiMode === constants.UI_MODE_HIDDEN) {
            next.uiMode = constants.UI_MODE_INFO;
            effects.push(effect("SCHEDULE_UI_HIDE"));
            break;
          }
          if (!next.channels.length) break;
          if (next.uiMode !== constants.UI_MODE_CHANNELS) openChannels(next);
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "WHEEL_STEP":
          if (next.uiMode === constants.UI_MODE_HIDDEN) {
            next.uiMode = constants.UI_MODE_INFO;
            effects.push(effect("SCHEDULE_UI_HIDE"));
            break;
          }
          if (!next.channels.length) break;
          if (next.uiMode !== constants.UI_MODE_CHANNELS) openChannels(next);
          moveChannelFocus(next, event.delta);
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "CHANNEL_FOCUS":
          if (!next.channels[event.index]) break;
          next.uiMode = constants.UI_MODE_CHANNELS;
          next.focusedIndex = event.index;
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
          next.uiMode = constants.UI_MODE_HIDDEN;
          break;

        case "PLAYLIST_UNCONFIGURED":
          next.playlistStatus = "unconfigured";
          next.uiMode = constants.UI_MODE_INFO;
          next.titleMessage = "尚未配置播放列表";
          next.playerMessage = "请复制 config.example.js 为 config.js 并填写播放列表地址";
          next.playerDetails = [];
          break;

        case "PLAYLIST_READY":
          next.playlistStatus = "ready";
          next.channels = event.channels;
          next.focusedIndex = event.initialIndex;
          selectChannel(next, event.initialIndex);
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
        "PLAYLIST_READY"
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
