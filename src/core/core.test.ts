import {describe, expect, it} from "vitest";
import {parseM3U} from "./m3u";
import {create as createSourceStore, MAX_SOURCES, normalizeUrl} from "./source-store";
import {createInitialState, transition} from "./channel-browser-state";

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
});

describe("channel browser core", () => {
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
    state = transition(state, {type: "MOVE", delta: 2}, context).state;
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
    state = transition(state, {type: "MOVE", delta: 2}, context).state;
    state = transition(state, {type: "RIGHT"}, context).state;
    state = transition(state, {type: "MOVE", delta: 1}, context).state;
    expect(state.focusedChannelIndex).toBe(2);
    state = transition(state, {type: "MOVE", delta: 1}, context).state;
    expect(state.focusedChannelIndex).toBe(1);
    state = transition(state, {type: "MOVE", delta: -1}, context).state;
    expect(state.focusedChannelIndex).toBe(2);
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
    expect(state.focusedGroupIndex).toBe(3);
    expect(state.selectedGroup).toBe("Sports");
    expect(state.focusedChannelIndex).toBe(2);
  });
});
