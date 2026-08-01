(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.IPTVChannelBrowserState = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  var COLUMN_SOURCES = 0;
  var COLUMN_GROUPS = 1;
  var COLUMN_CHANNELS = 2;

  function createInitialState(initialChannelIndex) {
    return {
      column: COLUMN_SOURCES,
      focusedSourceIndex: 0,
      focusedGroupIndex: 0,
      focusedChannelIndex: Math.max(0, Number(initialChannelIndex) || 0),
      selectedGroup: "全部"
    };
  }

  function copyState(source) {
    return {
      column: source.column,
      focusedSourceIndex: source.focusedSourceIndex,
      focusedGroupIndex: source.focusedGroupIndex,
      focusedChannelIndex: source.focusedChannelIndex,
      selectedGroup: source.selectedGroup
    };
  }

  function clamp(index, length) {
    if (!length) return 0;
    return Math.max(0, Math.min(length - 1, index));
  }

  function getGroups(channels) {
    var groups = ["全部"];
    channels.forEach(function (channel) {
      var group = channel.group || "其他";
      if (groups.indexOf(group) < 0) groups.push(group);
    });
    return groups;
  }

  function getVisibleChannelIndices(state, channels) {
    var indices = [];
    channels.forEach(function (channel, index) {
      if (state.selectedGroup === "全部" || channel.group === state.selectedGroup) {
        indices.push(index);
      }
    });
    return indices;
  }

  function enterFocusedGroup(next, channels) {
    var groups = getGroups(channels);
    next.focusedGroupIndex = clamp(next.focusedGroupIndex, groups.length);
    next.selectedGroup = groups[next.focusedGroupIndex] || "全部";
    var visibleIndices = getVisibleChannelIndices(next, channels);
    if (visibleIndices.indexOf(next.focusedChannelIndex) < 0 && visibleIndices.length) {
      next.focusedChannelIndex = visibleIndices[0];
    }
    next.column = COLUMN_CHANNELS;
  }

  function move(next, delta, context) {
    if (next.column === COLUMN_SOURCES) {
      next.focusedSourceIndex = clamp(
        next.focusedSourceIndex + delta,
        context.sources.length
      );
      return;
    }

    if (next.column === COLUMN_GROUPS) {
      next.focusedGroupIndex = clamp(
        next.focusedGroupIndex + delta,
        getGroups(context.channels).length
      );
      return;
    }

    var visibleIndices = getVisibleChannelIndices(next, context.channels);
    var position = visibleIndices.indexOf(next.focusedChannelIndex);
    if (position < 0) position = 0;
    position = clamp(position + delta, visibleIndices.length);
    if (visibleIndices.length) next.focusedChannelIndex = visibleIndices[position];
  }

  function result(state, action) {
    return { state: state, action: action || null };
  }

  function transition(current, event, context) {
    var next = copyState(current);
    var groups = getGroups(context.channels);

    switch (event.type) {
      case "RESET":
        return result(createInitialState(event.initialChannelIndex));

      case "OPEN":
        next.column = COLUMN_SOURCES;
        if (event.playingIndex >= 0) next.focusedChannelIndex = event.playingIndex;
        return result(next);

      case "MOVE":
        move(next, event.delta, context);
        return result(next);

      case "LEFT":
        if (next.column === COLUMN_SOURCES) return result(next, { type: "CLOSE" });
        next.column -= 1;
        return result(next);

      case "RIGHT":
        if (next.column === COLUMN_SOURCES) {
          next.column = COLUMN_GROUPS;
          return result(next);
        }
        if (next.column === COLUMN_GROUPS) enterFocusedGroup(next, context.channels);
        return result(next);

      case "CONFIRM":
        if (next.column === COLUMN_SOURCES) {
          next.column = COLUMN_GROUPS;
          return result(next, {
            type: "SOURCE_SELECTED",
            index: next.focusedSourceIndex
          });
        }
        if (next.column === COLUMN_GROUPS) {
          enterFocusedGroup(next, context.channels);
          return result(next, {
            type: "GROUP_SELECTED",
            index: next.focusedGroupIndex,
            group: next.selectedGroup
          });
        }
        return result(next, {
          type: "CHANNEL_SELECTED",
          index: next.focusedChannelIndex
        });

      case "SOURCE_FOCUS":
        if (!context.sources[event.index]) return result(next);
        next.column = COLUMN_SOURCES;
        next.focusedSourceIndex = event.index;
        return result(next);

      case "SOURCE_SELECT":
        if (!context.sources[event.index]) return result(next);
        next.focusedSourceIndex = event.index;
        next.column = COLUMN_GROUPS;
        return result(next, { type: "SOURCE_SELECTED", index: event.index });

      case "GROUP_FOCUS":
        if (!groups[event.index]) return result(next);
        next.column = COLUMN_GROUPS;
        next.focusedGroupIndex = event.index;
        return result(next);

      case "GROUP_SELECT":
        if (!groups[event.index]) return result(next);
        next.focusedGroupIndex = event.index;
        enterFocusedGroup(next, context.channels);
        return result(next, {
          type: "GROUP_SELECTED",
          index: event.index,
          group: next.selectedGroup
        });

      case "CHANNEL_FOCUS":
        if (!context.channels[event.index]) return result(next);
        next.column = COLUMN_CHANNELS;
        next.focusedChannelIndex = event.index;
        return result(next);

      default:
        return result(next);
    }
  }

  return {
    constants: {
      COLUMN_SOURCES: COLUMN_SOURCES,
      COLUMN_GROUPS: COLUMN_GROUPS,
      COLUMN_CHANNELS: COLUMN_CHANNELS
    },
    createInitialState: createInitialState,
    copyState: copyState,
    getGroups: getGroups,
    getVisibleChannelIndices: getVisibleChannelIndices,
    transition: transition
  };
});
