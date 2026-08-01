"use strict";

var assert = require("assert");

function createElement() {
  var attributes = {};
  var listeners = {};
  var classes = {};
  var element = {
    children: [],
    className: "",
    textContent: "",
    scrolled: false,
    classList: {
      toggle: function (name, enabled) { classes[name] = enabled; },
      contains: function (name) { return Boolean(classes[name]); }
    },
    setAttribute: function (name, value) { attributes[name] = value; },
    getAttribute: function (name) { return attributes[name]; },
    addEventListener: function (name, listener) { listeners[name] = listener; },
    emit: function (name) { listeners[name](); },
    appendChild: function (child) {
      if (child.isFragment) this.children = this.children.concat(child.children);
      else this.children.push(child);
    },
    insertBefore: function (child, reference) {
      var index = this.children.indexOf(reference);
      if (index < 0) this.children.push(child);
      else this.children.splice(index, 0, child);
    },
    scrollIntoView: function () { this.scrolled = true; },
    remove: function () {}
  };

  Object.defineProperty(element, "innerHTML", {
    set: function () { element.children = []; }
  });
  return element;
}

global.document = {
  createElement: createElement,
  createDocumentFragment: function () {
    var fragment = createElement();
    fragment.isFragment = true;
    return fragment;
  }
};

var channelPanelApi = require("../features/channels/channel-panel.js");
var panelElement = createElement();
var trackElement = createElement();
var sourceListElement = createElement();
var groupListElement = createElement();
var channelListElement = createElement();
var countElement = createElement();
var columnTitleElement = createElement();
var epgElement = createElement();
var epgTitleElement = createElement();
var epgListElement = createElement();
var focusedIndex = -1;
var selected = null;
var selectedGroup = -1;
var view = channelPanelApi.create({
  panelElement: panelElement,
  trackElement: trackElement,
  sourceListElement: sourceListElement,
  groupListElement: groupListElement,
  channelListElement: channelListElement,
  countElement: countElement,
  columnTitleElement: columnTitleElement,
  epgElement: epgElement,
  epgTitleElement: epgTitleElement,
  epgListElement: epgListElement,
  onSourceFocus: function () {},
  onSourceSelect: function () {},
  onGroupFocus: function () {},
  onGroupSelect: function (index) { selectedGroup = index; },
  onFocus: function (index) { focusedIndex = index; },
  onSelect: function (index, inputAt) { selected = { index: index, inputAt: inputAt }; },
  getInputTime: function () { return 42; }
});
var channels = [
  { name: "One", group: "News", logo: "" },
  { name: "Two", group: "Sports", logo: "" }
];
var programs = [{
  title: "Morning News",
  start: new Date(Date.now() - 60000),
  stop: new Date(Date.now() + 60000)
}];

view.render({
  open: true,
  browserColumn: 2,
  sources: [{ name: "Home M3U" }],
  channels: channels,
  selectedGroup: "News",
  focusedSourceIndex: 0,
  focusedGroupIndex: 1,
  focusedIndex: 0,
  playingIndex: 1,
  programs: programs,
  shouldScroll: true
});

assert.strictEqual(panelElement.classList.contains("is-open"), true);
assert.strictEqual(panelElement.classList.contains("is-column-channels"), true);
assert.strictEqual(panelElement.getAttribute("aria-hidden"), "false");
assert.strictEqual(sourceListElement.children.length, 1);
assert.strictEqual(groupListElement.children.length, 3);
assert.strictEqual(channelListElement.children.length, 1);
assert.strictEqual(countElement.textContent, "1");
assert.strictEqual(columnTitleElement.textContent, "News");
assert.strictEqual(channelListElement.children[0].classList.contains("is-focused"), true);
assert.strictEqual(channelListElement.children[0].scrolled, true);
assert.strictEqual(epgElement.classList.contains("is-visible"), true);
assert.strictEqual(epgTitleElement.textContent, "One");
assert.strictEqual(epgListElement.children.length, 1);

channelListElement.children[0].emit("mouseenter");
channelListElement.children[0].emit("click");
groupListElement.children[2].emit("click");
assert.strictEqual(focusedIndex, 0);
assert.deepStrictEqual(selected, { index: 0, inputAt: 42 });
assert.strictEqual(selectedGroup, 2);

view.render({
  open: false,
  browserColumn: 0,
  sources: [{ name: "Home M3U" }],
  channels: channels,
  selectedGroup: "全部",
  focusedSourceIndex: 0,
  focusedGroupIndex: 0,
  focusedIndex: 0,
  playingIndex: 1,
  programs: [],
  shouldScroll: false
});
assert.strictEqual(panelElement.getAttribute("aria-hidden"), "true");

process.stdout.write("channel panel tests passed\n");
