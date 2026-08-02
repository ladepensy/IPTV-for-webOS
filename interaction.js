(function (root, factory) {
  "use strict";

  if (typeof module === "object" && module.exports) {
    module.exports = { createForChannelBrowser: factory };
    return;
  }
  if (root) root.IPTVInteraction = factory(root.IPTVChannelBrowserState);
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
    var t = options.t || function (key) { return key; };
    var ALL_GROUP_ID = channelBrowserApi.constants.ALL_GROUP_ID || "__all__";
    var FAVORITES_GROUP_ID = channelBrowserApi.constants.FAVORITES_GROUP_ID || "__favorites__";
    var OTHER_GROUP_ID = channelBrowserApi.constants.OTHER_GROUP_ID || "__other__";

    function createInitialState() {
      return {
        uiMode: constants.UI_MODE_INFO,
        playlistStatus: "loading",
        channels: [],
        playlistSources: [],
        activeSourceId: "",
        canAddSource: true,
        favoriteChannelKeys: [],
        channelBrowser: channelBrowserApi.createInitialState(0),
        playingIndex: -1,
        playbackStatus: constants.PLAYBACK_IDLE,
        playbackAttemptId: 0,
        playbackRetryCount: 0,
        playbackHasStarted: false,
        failedAttemptId: -1,
        titleMessage: t("channel.loading"),
        playerMessage: t("playlist.fetching"),
        playerDetails: []
      };
    }

    function copyState(source) {
      var result = {};
      Object.keys(source).forEach(function (key) {
        result[key] = source[key];
      });
      result.channelBrowser = channelBrowserApi.copyState(source.channelBrowser);
      result.favoriteChannelKeys = (source.favoriteChannelKeys || []).slice();
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

    function getWrappedChannelIndex(index, delta, channels, selectedGroup, favoriteChannelKeys) {
      if (!channels.length) return 0;
      var currentIndex = clampChannelIndex(index, channels);
      var currentGroup = selectedGroup || ALL_GROUP_ID;
      var groupIndices = [];
      channels.forEach(function (channel, channelIndex) {
        var isFavorite = (favoriteChannelKeys || []).indexOf(channelBrowserApi.getChannelFavoriteKey(channel)) >= 0;
        if (
          currentGroup === ALL_GROUP_ID ||
          (currentGroup === FAVORITES_GROUP_ID && isFavorite) ||
          (channel.group || OTHER_GROUP_ID) === currentGroup
        ) {
          groupIndices.push(channelIndex);
        }
      });
      var position = groupIndices.indexOf(currentIndex);
      if (position < 0) {
        currentGroup = channels[currentIndex].group || OTHER_GROUP_ID;
        groupIndices = [];
        channels.forEach(function (channel, channelIndex) {
          if ((channel.group || OTHER_GROUP_ID) === currentGroup) groupIndices.push(channelIndex);
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
        canAddSource: nextState.canAddSource,
        favoriteChannelKeys: nextState.favoriteChannelKeys
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

    function toggleFavorite(nextState, index, effects) {
      var channel = nextState.channels[index];
      if (!channel) return;
      var key = channelBrowserApi.getChannelFavoriteKey(channel);
      var favoriteIndex = nextState.favoriteChannelKeys.indexOf(key);
      if (favoriteIndex >= 0) {
        nextState.favoriteChannelKeys.splice(favoriteIndex, 1);
      } else {
        nextState.favoriteChannelKeys.push(key);
      }
      updateChannelBrowser(nextState, { type: "FAVORITES_CHANGED", index: index });
      effects.push(effect("PERSIST_FAVORITES"));
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
        return;
      }
      if (action.type === "FAVORITE_TOGGLED") {
        toggleFavorite(nextState, action.index, effects);
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
            updateChannelBrowser(next, { type: "LEFT" });
          } else {
            openChannels(next);
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
            next.channelBrowser.selectedGroup,
            next.favoriteChannelKeys
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
              if (confirmAction.index === next.playingIndex) {
                next.uiMode = constants.UI_MODE_INFO;
              } else {
                selectChannel(next, confirmAction.index);
                effects.push(effect("REMEMBER_CHANNEL"));
                effects.push(effect("START_PLAYBACK", {
                  source: "remote-ok",
                  inputAt: event.inputAt
                }));
              }
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
          updateChannelBrowser(next, {
            type: "CHANNEL_FOCUS",
            index: event.index,
            control: event.control
          });
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "FAVORITE_CLICK":
          if (!next.channels[event.index]) break;
          next.uiMode = constants.UI_MODE_CHANNELS;
          updateChannelBrowser(next, {
            type: "CHANNEL_FOCUS",
            index: event.index,
            control: channelBrowserApi.constants.CHANNEL_CONTROL_FAVORITE
          });
          toggleFavorite(next, event.index, effects);
          effects.push(effect("SCHEDULE_UI_HIDE"));
          break;

        case "CHANNEL_CLICK":
          if (!next.channels[event.index]) break;
          if (Number(event.index) === next.playingIndex) {
            next.uiMode = constants.UI_MODE_INFO;
          } else {
            selectChannel(next, event.index);
            effects.push(effect("REMEMBER_CHANNEL"));
            effects.push(effect("START_PLAYBACK", {
              source: "pointer",
              inputAt: event.inputAt
            }));
          }
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
            next.titleMessage = t("playlist.loadingSource");
            next.playerMessage = t("playlist.fetching");
            next.playerDetails = [];
          }
          break;

        case "ACTIVE_SOURCE_REMOVED":
          next.channels = [];
          next.favoriteChannelKeys = [];
          next.playingIndex = -1;
          next.playbackStatus = constants.PLAYBACK_IDLE;
          next.playbackRetryCount = 0;
          next.playbackHasStarted = false;
          next.titleMessage = t("playlist.switchingSource");
          next.playerMessage = t("playlist.fetching");
          next.playerDetails = [];
          break;

        case "PLAYLIST_UNCONFIGURED":
          next.playlistStatus = "unconfigured";
          next.channels = [];
          next.playlistSources = [];
          next.activeSourceId = "";
          next.favoriteChannelKeys = [];
          next.playingIndex = -1;
          next.playbackStatus = constants.PLAYBACK_IDLE;
          next.uiMode = constants.UI_MODE_INFO;
          next.titleMessage = t("playlist.unconfigured");
          next.playerMessage = t("playlist.addPrompt");
          next.playerDetails = [];
          break;

        case "PLAYLIST_READY":
          next.playlistStatus = "ready";
          next.channels = event.channels;
          next.playlistSources = event.sources || next.playlistSources;
          next.activeSourceId = event.activeSourceId || next.activeSourceId;
          next.canAddSource = event.canAddSource !== false;
          next.favoriteChannelKeys = (event.favoriteChannelKeys || []).slice();
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
          next.titleMessage = t("playlist.loadFailed");
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
          next.playerMessage = t("playback.connecting", { name: channel.name });
          next.playerDetails = [
            t("playback.streamType", { value: getStreamInfo(channel.url).label }),
            t("playback.attempt", { current: next.playbackRetryCount + 1, total: maxPlaybackRetries + 1 })
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
          next.playerMessage = t("playback.mediaDetected");
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
            ? t("playback.retrying")
            : t("playback.failed");
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
          next.playerMessage = t("playback.ended");
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
