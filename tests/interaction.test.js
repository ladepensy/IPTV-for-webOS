"use strict";

var assert = require("assert");
var interactionApi = require("../interaction.js");
var machine = interactionApi.create({
  maxPlaybackRetries: 2,
  getStreamInfo: function () {
    return { label: "HLS", mime: "application/vnd.apple.mpegurl" };
  }
});
var constants = machine.constants;
var channels = [
  { name: "One", group: "Test", url: "http://example.test/one.m3u8" },
  { name: "Two", group: "Test", url: "http://example.test/two.m3u8" },
  { name: "Three", group: "Test", url: "http://example.test/three.m3u8" }
];

function send(state, event) {
  return machine.transition(state, event);
}

var state = machine.createInitialState();
var outcome = send(state, {
  type: "PLAYLIST_READY",
  channels: channels,
  sources: [{ id: "source-home", name: "Home" }],
  activeSourceId: "source-home",
  activeSourceIndex: 0,
  canAddSource: true,
  initialIndex: 0
});
state = outcome.state;
assert.strictEqual(state.uiMode, constants.UI_MODE_INFO);
assert.strictEqual(state.playingIndex, 0);
assert.deepStrictEqual(
  outcome.effects.map(function (item) { return item.type; }),
  ["REMEMBER_CHANNEL", "START_PLAYBACK", "SCHEDULE_UI_HIDE"]
);

outcome = send(state, { type: "START_PLAYBACK_ATTEMPT", expectedPlayingIndex: 0 });
state = outcome.state;
assert.strictEqual(state.playbackAttemptId, 1);
assert.strictEqual(state.playbackStatus, constants.PLAYBACK_LOADING);
assert.strictEqual(outcome.effects[0].type, "EXECUTE_PLAYBACK_ATTEMPT");

outcome = send(state, { type: "KEY_DOWN", delta: 1, inputAt: 123 });
state = outcome.state;
assert.strictEqual(state.channelBrowser.focusedChannelIndex, 1);
assert.strictEqual(state.playingIndex, 1);
assert.strictEqual(state.uiMode, constants.UI_MODE_INFO);
assert.ok(outcome.effects.some(function (item) { return item.type === "SCHEDULE_PLAYBACK_SWITCH"; }));
assert.ok(!outcome.effects.some(function (item) { return item.type === "START_PLAYBACK"; }));
assert.ok(!outcome.effects.some(function (item) { return item.type === "REMEMBER_CHANNEL"; }));
assert.strictEqual(outcome.effects[0].playingIndex, 1);
assert.strictEqual(outcome.effects[0].inputAt, 123);

state = send(state, { type: "KEY_RIGHT" }).state;
assert.strictEqual(state.uiMode, constants.UI_MODE_CHANNELS);
assert.strictEqual(state.channelBrowser.column, 2);
assert.strictEqual(state.channelBrowser.focusedChannelIndex, state.playingIndex);
assert.strictEqual(state.playlistSources.length, 1);
state = send(state, { type: "KEY_LEFT" }).state;
assert.strictEqual(state.channelBrowser.column, 1);
state = send(state, { type: "KEY_DOWN", delta: 1 }).state;
assert.strictEqual(state.channelBrowser.focusedGroupIndex, 2);
state = send(state, { type: "KEY_RIGHT" }).state;
assert.strictEqual(state.channelBrowser.column, 2);
assert.strictEqual(state.channelBrowser.selectedGroup, "Test");
state = send(state, { type: "KEY_DOWN", delta: 1 }).state;
assert.strictEqual(state.channelBrowser.focusedChannelIndex, 2);
assert.strictEqual(state.playingIndex, 1);

outcome = send(state, { type: "KEY_OK", inputAt: 456 });
state = outcome.state;
assert.strictEqual(state.uiMode, constants.UI_MODE_INFO);
assert.strictEqual(state.playingIndex, 2);
assert.ok(outcome.effects.some(function (item) { return item.type === "START_PLAYBACK"; }));
assert.ok(!outcome.effects.some(function (item) { return item.type === "SCHEDULE_PLAYBACK_SWITCH"; }));
var okPlaybackEffect = outcome.effects.filter(function (item) {
  return item.type === "START_PLAYBACK";
})[0];
assert.strictEqual(okPlaybackEffect.source, "remote-ok");
assert.strictEqual(okPlaybackEffect.inputAt, 456);

outcome = send(state, { type: "KEY_BACK" });
assert.strictEqual(outcome.effects[0].type, "CANCEL_UI_HIDE");
assert.strictEqual(outcome.state.uiMode, constants.UI_MODE_HIDDEN);

state = outcome.state;
outcome = send(state, { type: "POINTER_MOVE" });
assert.strictEqual(outcome.state.uiMode, constants.UI_MODE_HIDDEN);
assert.deepStrictEqual(outcome.effects, []);

state = outcome.state;
outcome = send(state, { type: "KEY_BACK" });
assert.strictEqual(outcome.effects[0].type, "EXIT_APP");
assert.strictEqual(outcome.state.uiMode, constants.UI_MODE_HIDDEN);

state = outcome.state;
state.uiMode = constants.UI_MODE_CHANNELS;
outcome = send(state, { type: "KEY_BACK" });
state = outcome.state;
assert.strictEqual(state.uiMode, constants.UI_MODE_HIDDEN);
assert.strictEqual(outcome.effects[0].type, "CANCEL_UI_HIDE");

state.uiMode = constants.UI_MODE_HIDDEN;
outcome = send(state, { type: "KEY_UP", delta: -1 });
state = outcome.state;
assert.strictEqual(state.uiMode, constants.UI_MODE_INFO);
assert.strictEqual(state.channelBrowser.focusedChannelIndex, 1);
assert.strictEqual(state.playingIndex, 1);
assert.ok(outcome.effects.some(function (item) { return item.type === "SCHEDULE_PLAYBACK_SWITCH"; }));

state.playbackStatus = constants.PLAYBACK_FAILED;
state.uiMode = constants.UI_MODE_HIDDEN;
outcome = send(state, { type: "KEY_OK" });
assert.strictEqual(outcome.state.uiMode, constants.UI_MODE_INFO);
assert.ok(!outcome.effects.some(function (item) { return item.type === "START_PLAYBACK"; }));

state = outcome.state;
outcome = send(state, { type: "KEY_OK" });
assert.strictEqual(outcome.state.playingIndex, 1);
assert.strictEqual(outcome.state.playbackRetryCount, 0);
assert.ok(outcome.effects.some(function (item) { return item.type === "START_PLAYBACK"; }));

state = outcome.state;
state.uiMode = constants.UI_MODE_CHANNELS;
state.channelBrowser.column = 2;
state.playbackStatus = constants.PLAYBACK_FAILED;
state.channelBrowser.focusedChannelIndex = 2;
outcome = send(state, { type: "KEY_OK" });
assert.strictEqual(outcome.state.uiMode, constants.UI_MODE_INFO);
assert.strictEqual(outcome.state.playingIndex, 2);

state = outcome.state;
state.playbackAttemptId = 5;
state.playbackStatus = constants.PLAYBACK_LOADING;
outcome = send(state, { type: "PLAYBACK_PLAYING", attemptId: 4 });
assert.strictEqual(outcome.state.playbackStatus, constants.PLAYBACK_LOADING);

state = machine.createInitialState();
state.playlistSources = [{ id: "source-home", name: "Home" }];
state.activeSourceId = "source-home";
state.canAddSource = true;
state.uiMode = constants.UI_MODE_CHANNELS;
state.channelBrowser.focusedSourceIndex = 1;
outcome = send(state, { type: "KEY_OK" });
assert.strictEqual(outcome.state.uiMode, constants.UI_MODE_SOURCE_FORM);
assert.ok(outcome.effects.some(function (item) { return item.type === "OPEN_SOURCE_FORM"; }));

state = machine.createInitialState();
state.playlistSources = [{ id: "source-home", name: "Home" }];
state.activeSourceId = "source-home";
state.uiMode = constants.UI_MODE_CHANNELS;
state.channelBrowser.column = 1;
state.channelBrowser.focusedGroupIndex = 0;
outcome = send(state, { type: "KEY_OK" });
assert.strictEqual(outcome.state.uiMode, constants.UI_MODE_SOURCE_FORM);
assert.ok(outcome.effects.some(function (item) {
  return item.type === "OPEN_SOURCE_FORM" && item.mode === "edit";
}));

state = machine.createInitialState();
state.playlistSources = [
  { id: "source-home", name: "Home" },
  { id: "source-backup", name: "Backup" }
];
state.activeSourceId = "source-home";
state.uiMode = constants.UI_MODE_CHANNELS;
state.channelBrowser.focusedSourceIndex = 1;
outcome = send(state, { type: "KEY_OK" });
assert.ok(outcome.effects.some(function (item) {
  return item.type === "LOAD_SOURCE" && item.index === 1;
}));

state = machine.createInitialState();
state.playlistSources = [{ id: "failed", name: "Failed" }];
state.canAddSource = true;
state.uiMode = constants.UI_MODE_CHANNELS;
outcome = send(state, { type: "KEY_DOWN", delta: 1 });
assert.strictEqual(outcome.state.channelBrowser.focusedSourceIndex, 1);

var groupedState = machine.createInitialState();
groupedState = send(groupedState, {
  type: "PLAYLIST_READY",
  channels: [
    { name: "News One", group: "News", url: "news-one" },
    { name: "Sports One", group: "Sports", url: "sports-one" },
    { name: "News Two", group: "News", url: "news-two" },
    { name: "Sports Two", group: "Sports", url: "sports-two" }
  ],
  sources: [{ id: "source-home", name: "Home" }],
  activeSourceId: "source-home",
  initialIndex: 2
}).state;
groupedState = send(groupedState, { type: "KEY_DOWN", delta: 1 }).state;
assert.strictEqual(groupedState.playingIndex, 3);
groupedState = send(groupedState, { type: "KEY_DOWN", delta: 1 }).state;
assert.strictEqual(groupedState.playingIndex, 0);
groupedState = send(groupedState, { type: "KEY_UP", delta: -1 }).state;
assert.strictEqual(groupedState.playingIndex, 3);

groupedState.playingIndex = 2;
groupedState.channelBrowser.focusedChannelIndex = 2;
groupedState.channelBrowser.selectedGroup = "News";
groupedState = send(groupedState, { type: "KEY_DOWN", delta: 1 }).state;
assert.strictEqual(groupedState.playingIndex, 0);
groupedState = send(groupedState, { type: "KEY_UP", delta: -1 }).state;
assert.strictEqual(groupedState.playingIndex, 2);

var restoredState = machine.createInitialState();
restoredState = send(restoredState, {
  type: "PLAYLIST_READY",
  channels: [
    { name: "News", group: "News", url: "news" },
    { name: "Sports One", group: "Sports", url: "sports-one" },
    { name: "Sports Two", group: "Sports", url: "sports-two" }
  ],
  sources: [
    { id: "source-primary", name: "Primary" },
    { id: "source-backup", name: "Backup" }
  ],
  activeSourceId: "source-backup",
  activeSourceIndex: 1,
  initialIndex: 2,
  initialGroup: "Sports"
}).state;
restoredState = send(restoredState, { type: "KEY_OK" }).state;
assert.strictEqual(restoredState.uiMode, constants.UI_MODE_CHANNELS);
assert.strictEqual(restoredState.channelBrowser.column, 2);
assert.strictEqual(restoredState.channelBrowser.focusedSourceIndex, 1);
assert.strictEqual(restoredState.channelBrowser.focusedGroupIndex, 3);
assert.strictEqual(restoredState.channelBrowser.selectedGroup, "Sports");
assert.strictEqual(restoredState.channelBrowser.focusedChannelIndex, 2);

process.stdout.write("interaction tests passed\n");
