(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.IPTVChannelPanel = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  function create(options) {
    var panelElement = options.panelElement;
    var listElement = options.listElement;
    var countElement = options.countElement;
    var onFocus = options.onFocus;
    var onSelect = options.onSelect;
    var getInputTime = options.getInputTime;
    var channels = [];
    var channelItems = [];
    var renderedFocusedIndex = -1;
    var renderedPlayingIndex = -1;

    function createChannelItem(channel, index) {
      var item = document.createElement("button");
      var art = document.createElement("span");
      var number = document.createElement("span");
      var copy = document.createElement("span");
      var name = document.createElement("span");
      var group = document.createElement("span");

      item.type = "button";
      item.className = "channel-item";
      item.setAttribute("role", "option");
      item.setAttribute("data-index", String(index));
      item.setAttribute("aria-selected", "false");

      art.className = "channel-art";
      if (channel.logo) {
        var logo = document.createElement("img");
        logo.alt = "";
        logo.loading = "lazy";
        logo.src = channel.logo;
        logo.addEventListener("error", function () {
          logo.remove();
          art.textContent = (channel.name || "?").slice(0, 1).toUpperCase();
        });
        art.appendChild(logo);
      } else {
        art.textContent = (channel.name || "?").slice(0, 1).toUpperCase();
      }

      number.className = "channel-number";
      number.textContent = String(index + 1).padStart(3, "0");

      copy.className = "channel-copy";
      name.className = "channel-name";
      name.textContent = channel.name;
      group.className = "channel-group";
      group.textContent = channel.group;

      copy.appendChild(name);
      copy.appendChild(group);
      item.appendChild(art);
      item.appendChild(number);
      item.appendChild(copy);
      item.addEventListener("mouseenter", function () {
        onFocus(index);
      });
      item.addEventListener("focus", function () {
        onFocus(index);
      });
      item.addEventListener("click", function () {
        onSelect(index, getInputTime());
      });
      return item;
    }

    function setChannels(nextChannels) {
      var fragment = document.createDocumentFragment();
      channels = nextChannels;
      channelItems = [];
      renderedFocusedIndex = -1;
      renderedPlayingIndex = -1;
      listElement.innerHTML = "";

      channels.forEach(function (channel, index) {
        var item = createChannelItem(channel, index);
        channelItems.push(item);
        fragment.appendChild(item);
      });

      listElement.appendChild(fragment);
      countElement.textContent = String(channels.length);
    }

    function updateItemState(index, className, enabled) {
      var item = channelItems[index];
      if (!item) return;
      item.classList.toggle(className, enabled);
      if (className === "is-focused") {
        item.setAttribute("aria-selected", enabled ? "true" : "false");
      }
    }

    function render(view) {
      panelElement.classList.toggle("is-open", view.open);
      panelElement.setAttribute("aria-hidden", view.open ? "false" : "true");

      if (channels !== view.channels) setChannels(view.channels);
      if (!view.open) return;

      if (renderedFocusedIndex !== view.focusedIndex) {
        updateItemState(renderedFocusedIndex, "is-focused", false);
        updateItemState(view.focusedIndex, "is-focused", true);
        renderedFocusedIndex = view.focusedIndex;
      }

      if (renderedPlayingIndex !== view.playingIndex) {
        updateItemState(renderedPlayingIndex, "is-playing", false);
        updateItemState(view.playingIndex, "is-playing", true);
        renderedPlayingIndex = view.playingIndex;
      }

      if (view.shouldScroll && channelItems[view.focusedIndex]) {
        channelItems[view.focusedIndex].scrollIntoView({ block: "nearest" });
      }
    }

    return {
      render: render
    };
  }

  return {
    create: create
  };
});
