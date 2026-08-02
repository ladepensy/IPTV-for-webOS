"use strict";

var assert = require("assert");
var storeApi = require("../features/sources/source-store.js");

function createStorage(initial) {
  var values = initial || {};
  var writes = 0;
  return {
    getItem: function (key) { return values[key] || null; },
    setItem: function (key, value) { values[key] = value; writes += 1; },
    getWriteCount: function () { return writes; }
  };
}

var storage = createStorage();
var store = storeApi.create({
  storage: storage,
  legacyConfig: { name: "Legacy", url: "http://example.test/playlist.m3u" },
  now: function () { return 1; },
  random: function () { return 0.5; }
});

assert.strictEqual(store.getSources().length, 1);
assert.strictEqual(store.getActive().id, "source_config");
assert.strictEqual(store.displayName(store.getActive()), "Legacy");

var added = store.add({ name: "Backup", url: "https://example.test/backup.m3u" });
assert.strictEqual(store.getSources().length, 2);
assert.strictEqual(store.getActive().id, "source_config");
store.setActive(added.id);
assert.strictEqual(store.getActive().id, added.id);
var writesAfterActivation = storage.getWriteCount();
store.setActive(added.id);
assert.strictEqual(storage.getWriteCount(), writesAfterActivation);

store.rememberChannel(added.id, { id: "channel-1", name: "One", group: "News" }, 3, "News");
assert.strictEqual(store.getById(added.id).lastChannel.index, 3);
assert.strictEqual(store.getById(added.id).lastChannel.sourceId, added.id);
assert.strictEqual(store.getById(added.id).lastChannel.selectedGroup, "News");
var writesAfterChannel = storage.getWriteCount();
store.rememberChannel(added.id, { id: "channel-1", name: "One", group: "News" }, 3, "News");
assert.strictEqual(storage.getWriteCount(), writesAfterChannel);
store.rememberChannels([
  { id: "source_config", channel: { id: "legacy-1", name: "Legacy One", group: "News" }, index: 1, selectedGroup: "全部" },
  { id: added.id, channel: { id: "channel-2", name: "Two", group: "Sports" }, index: 4, selectedGroup: "Sports" }
]);
assert.strictEqual(storage.getWriteCount(), writesAfterChannel + 1);
assert.strictEqual(store.getById(added.id).lastChannel.selectedGroup, "Sports");

store.update(added.id, { name: "Backup 2", url: "https://example.test/new.m3u" });
assert.strictEqual(store.getById(added.id).lastChannel, null);
var writesAfterUpdate = storage.getWriteCount();
store.update(added.id, { name: "Backup 2", url: "https://example.test/new.m3u" });
assert.strictEqual(storage.getWriteCount(), writesAfterUpdate);

store.remove(added.id);
assert.strictEqual(store.getSources().length, 1);
assert.strictEqual(store.getActive().id, "source_config");
store.remove("source_config");
var reloaded = storeApi.create({
  storage: storage,
  legacyConfig: { name: "Legacy", url: "http://example.test/playlist.m3u" }
});
assert.strictEqual(reloaded.getSources().length, 0);

assert.throws(function () {
  storeApi.normalizeUrl("file:///playlist.m3u");
}, /HTTP/);

var limitedStorage = createStorage();
var limited = storeApi.create({
  storage: limitedStorage,
  now: function () { return Date.now(); },
  random: Math.random
});
for (var index = 0; index < storeApi.MAX_SOURCES; index += 1) {
  limited.add({ name: String(index), url: "http://example.test/" + index + ".m3u" });
}
assert.strictEqual(limited.canAdd(), false);
assert.throws(function () {
  limited.add({ name: "overflow", url: "http://example.test/overflow.m3u" });
}, /上限/);

process.stdout.write("source store tests passed\n");
