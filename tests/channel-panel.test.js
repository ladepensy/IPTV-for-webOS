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
      toggle: function (name, enabled) {
        classes[name] = enabled;
      },
      contains: function (name) {
        return Boolean(classes[name]);
      }
    },
    setAttribute: function (name, value) {
      attributes[name] = value;
    },
    getAttribute: function (name) {
      return attributes[name];
    },
    addEventListener: function (name, listener) {
      listeners[name] = listener;
    },
    emit: function (name) {
      listeners[name]();
    },
    appendChild: function (child) {
      if (child.isFragment) {
        this.children = this.children.concat(child.children);
      } else {
        this.children.push(child);
      }
    },
    scrollIntoView: function () {
      this.scrolled = true;
    }
  };

  Object.defineProperty(element, "innerHTML", {
    set: function () {
      element.children = [];
    }
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
var listElement = createElement();
var countElement = createElement();
var focusedIndex = -1;
var selected = null;
var view = channelPanelApi.create({
  panelElement: panelElement,
  listElement: listElement,
  countElement: countElement,
  onFocus: function (index) {
    focusedIndex = index;
  },
  onSelect: function (index, inputAt) {
    selected = { index: index, inputAt: inputAt };
  },
  getInputTime: function () {
    return 42;
  }
});
var channels = [
  { name: "One", group: "Test", logo: "" },
  { name: "Two", group: "Test", logo: "" }
];

view.render({
  open: true,
  channels: channels,
  focusedIndex: 1,
  playingIndex: 0,
  shouldScroll: true
});

assert.strictEqual(panelElement.classList.contains("is-open"), true);
assert.strictEqual(panelElement.getAttribute("aria-hidden"), "false");
assert.strictEqual(countElement.textContent, "2");
assert.strictEqual(listElement.children.length, 2);
assert.strictEqual(listElement.children[1].classList.contains("is-focused"), true);
assert.strictEqual(listElement.children[0].classList.contains("is-playing"), true);
assert.strictEqual(listElement.children[1].scrolled, true);

listElement.children[1].emit("mouseenter");
listElement.children[1].emit("click");
assert.strictEqual(focusedIndex, 1);
assert.deepStrictEqual(selected, { index: 1, inputAt: 42 });

view.render({
  open: false,
  channels: channels,
  focusedIndex: 1,
  playingIndex: 0,
  shouldScroll: false
});
assert.strictEqual(panelElement.getAttribute("aria-hidden"), "true");

process.stdout.write("channel panel tests passed\n");
