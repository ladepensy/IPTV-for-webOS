import {describe, expect, it} from "vitest";
import {parseM3U} from "./m3u";
import {create as createSourceStore, MAX_SOURCES, normalizeUrl} from "./source-store";
import {
  ALL_GROUP_ID,
  CHANNEL_CONTROL_FAVORITE,
  createInitialState,
  FAVORITES_GROUP_ID,
  getChannelFavoriteKey,
  getGroups,
  getRememberedChannelIndex,
  OTHER_GROUP_ID,
  transition
} from "./channel-browser-state";

function createStorage() {
  const values: Record<string, string> = {};
  return {
    getItem: (key: string) => values[key] || null,
    setItem: (key: string, value: string) => { values[key] = value; }
  };
}

describe("M3U core", () => {
  it("parses metadata, relative channel URLs and EPG discovery", () => {
    const result = parseM3U([
      '#EXTM3U x-tvg-url="guide.xml"',
      '#EXTINF:-1 tvg-id="news" group-title="新闻",News',
      "streams/news.m3u8"
    ].join("\n"), "https://example.test/playlist/list.m3u");
    expect(result.epgUrl).toBe("https://example.test/playlist/guide.xml");
    expect(result.channels[0]).toMatchObject({id: "news", name: "News", group: "新闻"});
    expect(result.channels[0].url).toBe("https://example.test/playlist/streams/news.m3u8");
  });
});

describe("source store core", () => {
  it("migrates legacy config and preserves source constraints", () => {
    const store = createSourceStore({
      storage: createStorage(),
      legacyConfig: {url: "https://example.test/list.m3u", name: "Home"},
      now: () => 1,
      random: () => 0.5
    });
    expect(store.getActive()?.name).toBe("Home");
    for (let index = 1; index < MAX_SOURCES; index += 1) {
      store.add({url: `https://example.test/${index}.m3u`});
    }
    expect(store.canAdd()).toBe(false);
    expect(() => normalizeUrl("file:///playlist.m3u")).toThrow(/HTTP/);
  });

  it("remembers the exact channel stream URL", () => {
    const store = createSourceStore({
      storage: createStorage(),
      legacyConfig: {url: "https://example.test/list.m3u", name: "Home"}
    });
    store.rememberChannel("source_config", {
      id: "news",
      name: "News",
      group: "News",
      logo: "",
      url: "https://example.test/news-hd"
    }, 1);
    expect(store.getActive()?.lastChannel?.url).toBe("https://example.test/news-hd");
  });
});

describe("channel browser core", () => {
  it("uses locale-independent IDs for built-in groups", () => {
    expect(createInitialState().selectedGroup).toBe(ALL_GROUP_ID);
    expect(getGroups([{id: "one", name: "One", group: "", logo: "", url: "one"}]))
      .toEqual([ALL_GROUP_ID, FAVORITES_GROUP_ID, OTHER_GROUP_ID]);
  });

  it("uses the stream URL to distinguish channels that share a tvg-id", () => {
    const hd = {id: "news", name: "News HD", group: "News", logo: "", url: "https://example.test/news-hd"};
    const sd = {id: "news", name: "News SD", group: "News", logo: "", url: "https://example.test/news-sd"};
    expect(getChannelFavoriteKey(hd)).not.toBe(getChannelFavoriteKey(sd));
  });

  it("restores the exact stream when channels share an id and name", () => {
    const channels = [
      {id: "news", name: "News", group: "News", logo: "", url: "https://example.test/news-sd"},
      {id: "news", name: "News", group: "News", logo: "", url: "https://example.test/news-hd"}
    ];
    expect(getRememberedChannelIndex(channels, {
      channelId: "news",
      url: "https://example.test/news-hd",
      name: "News",
      group: "News",
      index: 1
    })).toBe(1);
    expect(getRememberedChannelIndex(channels, {
      channelId: "news",
      name: "News",
      group: "News",
      index: 1
    })).toBe(1);
  });

  it("keeps remote navigation deterministic", () => {
    const context = {
      sources: [{id: "home"}],
      canAddSource: true,
      channels: [
        {id: "one", name: "One", group: "News", logo: "", url: "one"},
        {id: "two", name: "Two", group: "Sports", logo: "", url: "two"}
      ]
    };
    let state = transition(createInitialState(), {type: "RIGHT"}, context).state;
    state = transition(state, {type: "MOVE", delta: 3}, context).state;
    const outcome = transition(state, {type: "CONFIRM"}, context);
    expect(outcome.action).toMatchObject({type: "GROUP_SELECTED", group: "Sports"});
    expect(outcome.state.focusedChannelIndex).toBe(1);
  });

  it("wraps within the selected channel group", () => {
    const context = {
      sources: [{id: "home"}],
      canAddSource: true,
      channels: [
        {id: "news", name: "News", group: "News", logo: "", url: "news"},
        {id: "sports-one", name: "Sports One", group: "Sports", logo: "", url: "sports-one"},
        {id: "sports-two", name: "Sports Two", group: "Sports", logo: "", url: "sports-two"}
      ]
    };
    let state = createInitialState(1);
    state = transition(state, {type: "RIGHT"}, context).state;
    state = transition(state, {type: "MOVE", delta: 3}, context).state;
    state = transition(state, {type: "RIGHT"}, context).state;
    state = transition(state, {type: "MOVE", delta: 1}, context).state;
    expect(state.focusedChannelIndex).toBe(2);
    state = transition(state, {type: "MOVE", delta: 1}, context).state;
    expect(state.focusedChannelIndex).toBe(1);
    state = transition(state, {type: "MOVE", delta: -1}, context).state;
    expect(state.focusedChannelIndex).toBe(2);
  });

  it("navigates to the favorite control and advances focus after removal", () => {
    const channels = [
      {id: "one", name: "One", group: "News", logo: "", url: "one"},
      {id: "two", name: "Two", group: "News", logo: "", url: "two"},
      {id: "three", name: "Three", group: "News", logo: "", url: "three"}
    ];
    const favoriteChannelKeys = [getChannelFavoriteKey(channels[0]), getChannelFavoriteKey(channels[2])];
    const context = {
      sources: [{id: "home"}],
      canAddSource: true,
      channels,
      favoriteChannelKeys
    };
    let state = createInitialState();
    state = transition(state, {type: "RIGHT"}, context).state;
    state = transition(state, {type: "MOVE", delta: 1}, context).state;
    state = transition(state, {type: "RIGHT"}, context).state;
    expect(state.selectedGroup).toBe(FAVORITES_GROUP_ID);
    expect(state.focusedChannelIndex).toBe(0);

    state = transition(state, {type: "RIGHT"}, context).state;
    expect(state.focusedChannelControl).toBe(CHANNEL_CONTROL_FAVORITE);
    state = transition(state, {type: "MOVE", delta: -1}, context).state;
    expect(state.focusedChannelIndex).toBe(2);
    expect(state.focusedChannelControl).toBe(CHANNEL_CONTROL_FAVORITE);
    state = transition(state, {type: "MOVE", delta: 1}, context).state;
    expect(state.focusedChannelIndex).toBe(0);
    expect(transition(state, {type: "CONFIRM"}, context).action)
      .toMatchObject({type: "FAVORITE_TOGGLED", index: 0});

    const updatedContext = {...context, favoriteChannelKeys: [getChannelFavoriteKey(channels[2])]};
    state = transition(state, {type: "FAVORITES_CHANGED"}, updatedContext).state;
    expect(state.focusedChannelIndex).toBe(2);
    expect(state.focusedChannelControl).toBe(CHANNEL_CONTROL_FAVORITE);

    const emptyContext = {...context, favoriteChannelKeys: []};
    state = transition(state, {type: "FAVORITES_CHANGED"}, emptyContext).state;
    expect(state.focusedChannelControl).not.toBe(CHANNEL_CONTROL_FAVORITE);
    expect(transition(state, {type: "CONFIRM"}, emptyContext).action).toBeNull();
  });

  it("restores the source, group and playing channel focus", () => {
    const context = {
      sources: [{id: "primary"}, {id: "backup"}],
      canAddSource: true,
      channels: [
        {id: "news", name: "News", group: "News", logo: "", url: "news"},
        {id: "sports-one", name: "Sports One", group: "Sports", logo: "", url: "sports-one"},
        {id: "sports-two", name: "Sports Two", group: "Sports", logo: "", url: "sports-two"}
      ]
    };
    let state = transition(createInitialState(), {
      type: "RESET",
      initialChannelIndex: 2,
      initialSourceIndex: 1,
      initialGroup: "Sports"
    }, context).state;
    state = transition(state, {
      type: "OPEN",
      playingIndex: 2,
      activeSourceIndex: 1,
      selectedGroup: "Sports"
    }, context).state;
    expect(state.focusedSourceIndex).toBe(1);
    expect(state.focusedGroupIndex).toBe(4);
    expect(state.selectedGroup).toBe("Sports");
    expect(state.focusedChannelIndex).toBe(2);
  });
});
