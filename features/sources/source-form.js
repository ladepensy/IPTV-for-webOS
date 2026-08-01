(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.IPTVSourceForm = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  function create(options) {
    var rootElement = options.rootElement;
    var titleElement = options.titleElement;
    var subtitleElement = options.subtitleElement;
    var nameInput = options.nameInput;
    var urlInput = options.urlInput;
    var errorElement = options.errorElement;
    var saveButton = options.saveButton;
    var cancelButton = options.cancelButton;
    var deleteButton = options.deleteButton;
    var mode = "add";
    var source = null;
    var required = false;
    var open = false;
    var initial = { name: "", url: "" };

    function showError(message) {
      errorElement.textContent = message || "";
      errorElement.hidden = !message;
    }

    function getValue() {
      return {
        name: String(nameInput.value || "").trim(),
        url: String(urlInput.value || "").trim()
      };
    }

    function isDirty() {
      var value = getValue();
      return value.name !== initial.name || value.url !== initial.url;
    }

    function focusFirst() {
      setTimeout(function () {
        (nameInput.value ? nameInput : urlInput).focus();
      }, 0);
    }

    function show(settings) {
      mode = settings.mode === "edit" ? "edit" : "add";
      source = settings.source || null;
      required = Boolean(settings.required);
      initial = {
        name: source ? String(source.name || "") : "",
        url: source ? String(source.url || "") : ""
      };
      nameInput.value = initial.name;
      urlInput.value = initial.url;
      titleElement.textContent = mode === "edit" ? "编辑播放源" : "添加播放源";
      subtitleElement.textContent = mode === "edit"
        ? "修改当前 M3U 播放源"
        : "添加一个电视可访问的 M3U 地址";
      saveButton.textContent = mode === "edit" ? "保存修改" : "添加并播放";
      cancelButton.hidden = required;
      deleteButton.hidden = mode !== "edit";
      showError(settings.error || "");
      rootElement.classList.add("is-open");
      rootElement.setAttribute("aria-hidden", "false");
      open = true;
      focusFirst();
    }

    function hide() {
      rootElement.classList.remove("is-open");
      rootElement.setAttribute("aria-hidden", "true");
      open = false;
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }
    }

    function submit() {
      var value = getValue();
      try {
        value.url = options.normalizeUrl(value.url);
      } catch (error) {
        showError(error.message);
        urlInput.focus();
        return;
      }
      showError("");
      options.onSave({ mode: mode, source: source, value: value });
    }

    function cancel() {
      if (required) {
        options.onExit();
        return;
      }
      if (isDirty() && !options.confirm("放弃未保存的修改？")) return;
      hide();
      options.onCancel();
    }

    function remove() {
      if (!source || !options.confirm("确定删除这个播放源？")) return;
      hide();
      options.onDelete(source);
    }

    saveButton.addEventListener("click", submit);
    cancelButton.addEventListener("click", cancel);
    deleteButton.addEventListener("click", remove);

    function handleKey(event) {
      if (!open) return false;
      var code = event.keyCode;
      if (code === 461 || code === 27) {
        event.preventDefault();
        cancel();
        return true;
      }
      if (code === 13) {
        if (event.target === nameInput || event.target === urlInput) return false;
        event.preventDefault();
        if (document.activeElement && typeof document.activeElement.click === "function") {
          document.activeElement.click();
        }
        return true;
      }
      if (code !== 38 && code !== 40) return false;
      event.preventDefault();
      var controls = [nameInput, urlInput, saveButton];
      if (!cancelButton.hidden) controls.push(cancelButton);
      if (!deleteButton.hidden) controls.push(deleteButton);
      var index = controls.indexOf(document.activeElement);
      if (index < 0) index = 0;
      index = Math.max(0, Math.min(controls.length - 1, index + (code === 38 ? -1 : 1)));
      controls[index].focus();
      return true;
    }

    return {
      show: show,
      hide: hide,
      showError: showError,
      isOpen: function () { return open; },
      handleKey: handleKey
    };
  }

  return { create: create };
});
