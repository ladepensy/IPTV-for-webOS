"use strict";

var assert = require("assert");
var formApi = require("../features/sources/source-form.js");
var storeApi = require("../features/sources/source-store.js");

function createElement() {
  var listeners = {};
  var classes = {};
  return {
    value: "",
    textContent: "",
    hidden: false,
    classList: {
      add: function (name) { classes[name] = true; },
      remove: function (name) { classes[name] = false; },
      contains: function (name) { return Boolean(classes[name]); }
    },
    setAttribute: function () {},
    addEventListener: function (name, listener) { listeners[name] = listener; },
    click: function () { if (listeners.click) listeners.click(); },
    focus: function () { global.document.activeElement = this; },
    blur: function () { global.document.activeElement = null; }
  };
}

global.document = { activeElement: null };
var elements = {
  rootElement: createElement(),
  titleElement: createElement(),
  subtitleElement: createElement(),
  nameInput: createElement(),
  urlInput: createElement(),
  errorElement: createElement(),
  saveButton: createElement(),
  cancelButton: createElement(),
  deleteButton: createElement()
};
var saved = null;
var deleted = null;
var exited = false;
var view = formApi.create({
  rootElement: elements.rootElement,
  titleElement: elements.titleElement,
  subtitleElement: elements.subtitleElement,
  nameInput: elements.nameInput,
  urlInput: elements.urlInput,
  errorElement: elements.errorElement,
  saveButton: elements.saveButton,
  cancelButton: elements.cancelButton,
  deleteButton: elements.deleteButton,
  normalizeUrl: storeApi.normalizeUrl,
  confirm: function () { return true; },
  onSave: function (value) { saved = value; },
  onCancel: function () {},
  onDelete: function (source) { deleted = source; },
  onExit: function () { exited = true; }
});

view.show({ mode: "add", required: true });
assert.strictEqual(elements.cancelButton.hidden, true);
assert.strictEqual(elements.deleteButton.hidden, true);
elements.urlInput.value = "not-a-url";
elements.saveButton.click();
assert.strictEqual(saved, null);
assert.strictEqual(elements.errorElement.hidden, false);

elements.nameInput.value = "Home";
elements.urlInput.value = "http://example.test/playlist.m3u";
elements.saveButton.click();
assert.strictEqual(saved.value.name, "Home");

view.show({
  mode: "edit",
  source: { id: "one", name: "One", url: "http://example.test/one.m3u" }
});
assert.strictEqual(elements.cancelButton.hidden, false);
assert.strictEqual(elements.deleteButton.hidden, false);
elements.deleteButton.click();
assert.strictEqual(deleted.id, "one");

view.show({ mode: "add", required: true });
elements.cancelButton.click();
assert.strictEqual(exited, true);

process.stdout.write("source form tests passed\n");
