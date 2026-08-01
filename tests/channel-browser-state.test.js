"use strict";

var assert = require("assert");
var browserApi = require("../features/channels/channel-browser-state.js");
var context = {
  sources: [{ name: "Home" }],
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

outcome = browserApi.transition(state, { type: "CONFIRM" }, context);
state = outcome.state;
assert.strictEqual(outcome.action.type, "SOURCE_SELECTED");
assert.strictEqual(state.column, browserApi.constants.COLUMN_GROUPS);

state = browserApi.transition(state, { type: "MOVE", delta: 2 }, context).state;
assert.strictEqual(state.focusedGroupIndex, 2);
outcome = browserApi.transition(state, { type: "CONFIRM" }, context);
state = outcome.state;
assert.strictEqual(outcome.action.type, "GROUP_SELECTED");
assert.strictEqual(outcome.action.group, "Sports");
assert.strictEqual(state.column, browserApi.constants.COLUMN_CHANNELS);
assert.strictEqual(state.focusedChannelIndex, 1);

state = browserApi.transition(state, { type: "MOVE", delta: 1 }, context).state;
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

process.stdout.write("channel browser state tests passed\n");
