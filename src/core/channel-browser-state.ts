import type {Channel, LastChannel, SourceView} from "./types";

export const COLUMN_SOURCES = 0;
export const COLUMN_GROUPS = 1;
export const COLUMN_CHANNELS = 2;
export const ALL_GROUP_ID = "__all__";
export const FAVORITES_GROUP_ID = "__favorites__";
export const OTHER_GROUP_ID = "__other__";
export const CHANNEL_CONTROL_PLAY = 0;
export const CHANNEL_CONTROL_FAVORITE = 1;

export interface ChannelBrowserState {
  column: number;
  focusedSourceIndex: number;
  focusedGroupIndex: number;
  focusedChannelIndex: number;
  focusedChannelControl: number;
  selectedGroup: string;
}

export interface ChannelBrowserContext {
  sources: SourceView[];
  canAddSource: boolean;
  channels: Channel[];
  favoriteChannelKeys?: string[];
}

export interface BrowserEvent {
  type: string;
  delta?: number;
  index?: number;
  playingIndex?: number;
  initialChannelIndex?: number;
  initialSourceIndex?: number;
  initialGroup?: string;
  activeSourceIndex?: number;
  selectedGroup?: string;
  control?: number;
}

export interface BrowserAction {
  type: string;
  index?: number;
  group?: string;
}

export function createInitialState(initialChannelIndex = 0, initialSourceIndex = 0): ChannelBrowserState {
  return {
    column: COLUMN_SOURCES,
    focusedSourceIndex: Math.max(0, Number(initialSourceIndex) || 0),
    focusedGroupIndex: 1,
    focusedChannelIndex: Math.max(0, Number(initialChannelIndex) || 0),
    focusedChannelControl: CHANNEL_CONTROL_PLAY,
    selectedGroup: ALL_GROUP_ID
  };
}

export function copyState(source: ChannelBrowserState): ChannelBrowserState {
  return {...source};
}

function clamp(index: number, length: number): number {
  return length ? Math.max(0, Math.min(length - 1, index)) : 0;
}

function wrap(index: number, length: number): number {
  return length ? ((index % length) + length) % length : 0;
}

export function getGroups(channels: Channel[]): string[] {
  const groups = [ALL_GROUP_ID, FAVORITES_GROUP_ID];
  channels.forEach((channel) => {
    const group = channel.group || OTHER_GROUP_ID;
    if (groups.indexOf(group) < 0) groups.push(group);
  });
  return groups;
}

export function getChannelFavoriteKey(channel: Channel): string {
  if (channel.url) return `url:${channel.url}`;
  return `channel:${channel.id}|${channel.group}|${channel.name}`;
}

export function getRememberedChannelIndex(channels: Channel[], saved: Partial<LastChannel> | null): number {
  if (!saved) return 0;
  if (saved.url) {
    const urlIndex = channels.findIndex((channel) => channel.url === saved.url);
    if (urlIndex >= 0) return urlIndex;
  }

  const savedIndex = Number(saved.index);
  if (savedIndex >= 0 && savedIndex < channels.length) {
    const indexedChannel = channels[savedIndex];
    const idMatches = !saved.channelId || indexedChannel.id === saved.channelId;
    const nameMatches = !saved.name || indexedChannel.name === saved.name;
    const groupMatches = !saved.group || indexedChannel.group === saved.group;
    if (idMatches && nameMatches && groupMatches) return savedIndex;
  }

  if (saved.name) {
    const matches = channels
      .map((channel, index) => ({channel, index}))
      .filter(({channel}) => channel.name === saved.name && channel.group === saved.group);
    if (matches.length === 1) return matches[0].index;
  }

  if (saved.channelId) {
    const matches = channels
      .map((channel, index) => ({channel, index}))
      .filter(({channel}) => channel.id === saved.channelId);
    if (matches.length === 1) return matches[0].index;
  }

  return savedIndex >= 0 && savedIndex < channels.length ? savedIndex : 0;
}

function isFavorite(channel: Channel, favoriteChannelKeys: string[] = []): boolean {
  return favoriteChannelKeys.indexOf(getChannelFavoriteKey(channel)) >= 0;
}

export function getVisibleChannelIndices(
  state: ChannelBrowserState,
  channels: Channel[],
  favoriteChannelKeys: string[] = []
): number[] {
  const indices: number[] = [];
  channels.forEach((channel, index) => {
    if (
      state.selectedGroup === ALL_GROUP_ID ||
      (state.selectedGroup === FAVORITES_GROUP_ID && isFavorite(channel, favoriteChannelKeys)) ||
      (channel.group || OTHER_GROUP_ID) === state.selectedGroup
    ) indices.push(index);
  });
  return indices;
}

function enterFocusedGroup(next: ChannelBrowserState, context: ChannelBrowserContext): void {
  const channels = context.channels;
  const groups = getGroups(channels);
  next.focusedGroupIndex = Math.max(1, clamp(next.focusedGroupIndex, groups.length + 1));
  next.selectedGroup = groups[next.focusedGroupIndex - 1] || ALL_GROUP_ID;
  const visibleIndices = getVisibleChannelIndices(next, channels, context.favoriteChannelKeys);
  if (visibleIndices.indexOf(next.focusedChannelIndex) < 0 && visibleIndices.length) {
    next.focusedChannelIndex = visibleIndices[0];
  }
  next.focusedChannelControl = CHANNEL_CONTROL_PLAY;
  next.column = COLUMN_CHANNELS;
}

function restoreGroup(next: ChannelBrowserState, group: unknown, context: ChannelBrowserContext): void {
  const channels = context.channels;
  const groups = getGroups(channels);
  const selectedGroup = String(group || ALL_GROUP_ID);
  const groupIndex = groups.indexOf(selectedGroup);
  const channel = channels[next.focusedChannelIndex];
  const selectedChannelMatches = selectedGroup === ALL_GROUP_ID ||
    (selectedGroup === FAVORITES_GROUP_ID
      ? Boolean(channel && isFavorite(channel, context.favoriteChannelKeys))
      : (channel?.group || OTHER_GROUP_ID) === selectedGroup);
  if (groupIndex < 0 || !selectedChannelMatches) {
    next.selectedGroup = ALL_GROUP_ID;
    next.focusedGroupIndex = 1;
    return;
  }
  next.selectedGroup = selectedGroup;
  next.focusedGroupIndex = groupIndex + 1;
}

function move(next: ChannelBrowserState, delta: number, context: ChannelBrowserContext): void {
  if (next.column === COLUMN_SOURCES) {
    next.focusedSourceIndex = clamp(next.focusedSourceIndex + delta, context.sources.length + (context.canAddSource ? 1 : 0));
    return;
  }
  if (next.column === COLUMN_GROUPS) {
    next.focusedGroupIndex = clamp(next.focusedGroupIndex + delta, getGroups(context.channels).length + 1);
    return;
  }
  const visibleIndices = getVisibleChannelIndices(next, context.channels, context.favoriteChannelKeys);
  let position = visibleIndices.indexOf(next.focusedChannelIndex);
  if (position < 0) position = 0;
  position = wrap(position + delta, visibleIndices.length);
  if (visibleIndices.length) next.focusedChannelIndex = visibleIndices[position];
}

function result(state: ChannelBrowserState, action: BrowserAction | null = null) {
  return {state, action};
}

export function transition(current: ChannelBrowserState, event: BrowserEvent, context: ChannelBrowserContext) {
  const next = copyState(current);
  const groups = getGroups(context.channels);
  const eventIndex = Number(event.index);

  switch (event.type) {
    case "RESET": {
      const reset = createInitialState(event.initialChannelIndex, event.initialSourceIndex);
      restoreGroup(reset, event.initialGroup, context);
      return result(reset);
    }
    case "OPEN":
      next.column = COLUMN_SOURCES;
      if (Number(event.playingIndex) >= 0) next.focusedChannelIndex = Number(event.playingIndex);
      if (Number(event.activeSourceIndex) >= 0) next.focusedSourceIndex = Number(event.activeSourceIndex);
      restoreGroup(next, event.selectedGroup || next.selectedGroup, context);
      return result(next);
    case "MOVE":
      move(next, Number(event.delta) || 0, context);
      return result(next);
    case "LEFT":
      if (next.column === COLUMN_SOURCES) return result(next);
      if (next.column === COLUMN_CHANNELS && next.focusedChannelControl === CHANNEL_CONTROL_FAVORITE) {
        next.focusedChannelControl = CHANNEL_CONTROL_PLAY;
        return result(next);
      }
      next.column -= 1;
      return result(next);
    case "RIGHT":
      if (next.column === COLUMN_SOURCES) {
        if (!context.sources[next.focusedSourceIndex]) return result(next);
        next.column = COLUMN_GROUPS;
      } else if (next.column === COLUMN_GROUPS && next.focusedGroupIndex > 0) {
        enterFocusedGroup(next, context);
      } else if (next.column === COLUMN_CHANNELS) {
        const visibleIndices = getVisibleChannelIndices(next, context.channels, context.favoriteChannelKeys);
        if (visibleIndices.indexOf(next.focusedChannelIndex) >= 0) {
          next.focusedChannelControl = CHANNEL_CONTROL_FAVORITE;
        }
      }
      return result(next);
    case "CONFIRM":
      if (next.column === COLUMN_SOURCES) {
        if (!context.sources[next.focusedSourceIndex]) {
          return context.canAddSource && next.focusedSourceIndex === context.sources.length
            ? result(next, {type: "ADD_SOURCE"}) : result(next);
        }
        next.column = COLUMN_GROUPS;
        return result(next, {type: "SOURCE_SELECTED", index: next.focusedSourceIndex});
      }
      if (next.column === COLUMN_GROUPS) {
        if (next.focusedGroupIndex === 0) return result(next, {type: "EDIT_SOURCE"});
        enterFocusedGroup(next, context);
        return result(next, {type: "GROUP_SELECTED", index: next.focusedGroupIndex - 1, group: next.selectedGroup});
      }
      if (
        getVisibleChannelIndices(next, context.channels, context.favoriteChannelKeys)
          .indexOf(next.focusedChannelIndex) < 0
      ) return result(next);
      return result(next, {
        type: next.focusedChannelControl === CHANNEL_CONTROL_FAVORITE ? "FAVORITE_TOGGLED" : "CHANNEL_SELECTED",
        index: next.focusedChannelIndex
      });
    case "SOURCE_FOCUS":
      if (!context.sources[eventIndex] && !(context.canAddSource && eventIndex === context.sources.length)) return result(next);
      next.column = COLUMN_SOURCES;
      next.focusedSourceIndex = eventIndex;
      return result(next);
    case "SOURCE_SELECT":
      if (!context.sources[eventIndex]) {
        if (context.canAddSource && eventIndex === context.sources.length) {
          next.focusedSourceIndex = eventIndex;
          next.column = COLUMN_SOURCES;
          return result(next, {type: "ADD_SOURCE"});
        }
        return result(next);
      }
      next.focusedSourceIndex = eventIndex;
      next.column = COLUMN_GROUPS;
      return result(next, {type: "SOURCE_SELECTED", index: eventIndex});
    case "GROUP_FOCUS":
      if (eventIndex < 0 || eventIndex > groups.length) return result(next);
      next.column = COLUMN_GROUPS;
      next.focusedGroupIndex = eventIndex;
      return result(next);
    case "GROUP_SELECT":
      if (eventIndex < 0 || eventIndex > groups.length) return result(next);
      next.focusedGroupIndex = eventIndex;
      if (eventIndex === 0) {
        next.column = COLUMN_GROUPS;
        return result(next, {type: "EDIT_SOURCE"});
      }
      enterFocusedGroup(next, context);
      return result(next, {type: "GROUP_SELECTED", index: eventIndex - 1, group: next.selectedGroup});
    case "CHANNEL_FOCUS":
      if (!context.channels[eventIndex]) return result(next);
      next.column = COLUMN_CHANNELS;
      next.focusedChannelIndex = eventIndex;
      next.focusedChannelControl = Number(event.control) === CHANNEL_CONTROL_FAVORITE
        ? CHANNEL_CONTROL_FAVORITE
        : CHANNEL_CONTROL_PLAY;
      return result(next);
    case "FAVORITES_CHANGED": {
      if (next.selectedGroup !== FAVORITES_GROUP_ID) return result(next);
      const visibleIndices = getVisibleChannelIndices(next, context.channels, context.favoriteChannelKeys);
      if (visibleIndices.indexOf(next.focusedChannelIndex) >= 0) return result(next);
      if (!visibleIndices.length) {
        next.focusedChannelControl = CHANNEL_CONTROL_PLAY;
        return result(next);
      }
      const nextIndex = visibleIndices.find((index) => index > next.focusedChannelIndex);
      if (visibleIndices.length) {
        next.focusedChannelIndex = nextIndex === undefined ? visibleIndices[visibleIndices.length - 1] : nextIndex;
      }
      return result(next);
    }
    default:
      return result(next);
  }
}

export const channelBrowserApi = {
  constants: {
    COLUMN_SOURCES, COLUMN_GROUPS, COLUMN_CHANNELS, ALL_GROUP_ID, FAVORITES_GROUP_ID, OTHER_GROUP_ID,
    CHANNEL_CONTROL_PLAY, CHANNEL_CONTROL_FAVORITE
  },
  createInitialState,
  copyState,
  getGroups,
  getChannelFavoriteKey,
  getRememberedChannelIndex,
  getVisibleChannelIndices,
  transition
};
