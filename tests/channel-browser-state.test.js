"use strict";

var assert = require("assert");
var browserApi = require("../features/channels/channel-browser-state.js");
var context = {
  sources: [{ name: "Home" }],
  canAddSource: true,
  channels: [
    { name: "News One", group: "News" },
    { name: "Sports One", group: "Sports" },
    { name: "Sports Two", group: "Sports" }
  ]
};
var state = browserApi.createInitialState(0);
var outcome;

outcome = browserApi.transition(state, { type: "OPEN", playingIndex: 1 }, context);
state = outcome.state;
assert.strictEqual(state.column, browserApi.constants.COLUMN_SOURCES);
assert.strictEqual(state.focusedChannelIndex, 1);

var restoredState = browserApi.transition(state, {
  type: "RESET",
  initialChannelIndex: 2,
  initialSourceIndex: 0,
  initialGroup: "Sports"
}, context).state;
assert.strictEqual(restoredState.selectedGroup, "Sports");
assert.strictEqual(restoredState.focusedGroupIndex, 3);
assert.strictEqual(restoredState.focusedChannelIndex, 2);
restoredState = browserApi.transition(restoredState, {
  type: "OPEN",
  playingIndex: 1,
  activeSourceIndex: 0,
  selectedGroup: "Sports"
}, context).state;
assert.strictEqual(restoredState.focusedSourceIndex, 0);
assert.strictEqual(restoredState.focusedGroupIndex, 3);
assert.strictEqual(restoredState.focusedChannelIndex, 1);

outcome = browserApi.transition(state, { type: "CONFIRM" }, context);
state = outcome.state;
assert.strictEqual(outcome.action.type, "SOURCE_SELECTED");
assert.strictEqual(state.column, browserApi.constants.COLUMN_GROUPS);

assert.strictEqual(state.focusedGroupIndex, 1);
state = browserApi.transition(state, { type: "MOVE", delta: 2 }, context).state;
assert.strictEqual(state.focusedGroupIndex, 3);
outcome = browserApi.transition(state, { type: "CONFIRM" }, context);
state = outcome.state;
assert.strictEqual(outcome.action.type, "GROUP_SELECTED");
assert.strictEqual(outcome.action.group, "Sports");
assert.strictEqual(state.column, browserApi.constants.COLUMN_CHANNELS);
assert.strictEqual(state.focusedChannelIndex, 1);

state = browserApi.transition(state, { type: "MOVE", delta: 1 }, context).state;
assert.strictEqual(state.focusedChannelIndex, 2);
state = browserApi.transition(state, { type: "MOVE", delta: 1 }, context).state;
assert.strictEqual(state.focusedChannelIndex, 1);
state = browserApi.transition(state, { type: "MOVE", delta: -1 }, context).state;
assert.strictEqual(state.focusedChannelIndex, 2);
outcome = browserApi.transition(state, { type: "CONFIRM" }, context);
assert.strictEqual(outcome.action.type, "CHANNEL_SELECTED");
assert.strictEqual(outcome.action.index, 2);

state = browserApi.transition(state, { type: "LEFT" }, context).state;
assert.strictEqual(state.column, browserApi.constants.COLUMN_GROUPS);
state = browserApi.transition(state, { type: "LEFT" }, context).state;
assert.strictEqual(state.column, browserApi.constants.COLUMN_SOURCES);
outcome = browserApi.transition(state, { type: "LEFT" }, context);
assert.strictEqual(outcome.action.type, "CLOSE");

state = browserApi.createInitialState(0);
state = browserApi.transition(state, { type: "MOVE", delta: 1 }, context).state;
outcome = browserApi.transition(state, { type: "CONFIRM" }, context);
assert.strictEqual(outcome.action.type, "ADD_SOURCE");
assert.strictEqual(outcome.state.column, browserApi.constants.COLUMN_SOURCES);

state = browserApi.createInitialState(0);
state = browserApi.transition(state, { type: "RIGHT" }, context).state;
state = browserApi.transition(state, { type: "MOVE", delta: -1 }, context).state;
outcome = browserApi.transition(state, { type: "CONFIRM" }, context);
assert.strictEqual(outcome.action.type, "EDIT_SOURCE");
assert.strictEqual(outcome.state.column, browserApi.constants.COLUMN_GROUPS);

process.stdout.write("channel browser state tests passed\n");
