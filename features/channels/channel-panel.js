(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.IPTVChannelPanel = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  function uniqueGroups(channels) {
    var groups = ["全部"];
    channels.forEach(function (channel) {
      var group = channel.group || "其他";
      if (groups.indexOf(group) < 0) groups.push(group);
    });
    return groups;
  }

  function formatTime(value) {
    if (!(value instanceof Date) || isNaN(value.getTime())) return "--:--";
    return String(value.getHours()).padStart(2, "0") + ":" +
      String(value.getMinutes()).padStart(2, "0");
  }

  function create(options) {
    var panelElement = options.panelElement;
    var trackElement = options.trackElement;
    var sourceListElement = options.sourceListElement;
    var groupListElement = options.groupListElement;
    var channelListElement = options.channelListElement || options.listElement;
    var countElement = options.countElement;
    var columnTitleElement = options.columnTitleElement;
    var epgElement = options.epgElement;
    var epgTitleElement = options.epgTitleElement;
    var epgListElement = options.epgListElement;
    var onSourceFocus = options.onSourceFocus || function () {};
    var onSourceSelect = options.onSourceSelect || function () {};
    var onGroupFocus = options.onGroupFocus || function () {};
    var onGroupSelect = options.onGroupSelect || function () {};
    var onFocus = options.onFocus;
    var onSelect = options.onSelect;
    var getInputTime = options.getInputTime;
    var renderedSources = null;
    var renderedChannels = null;
    var renderedGroupSignature = "";
    var sourceItems = [];
    var groupItems = [];
    var channelItems = {};
    var renderedFocusedSourceIndex = -1;
    var renderedFocusedGroupIndex = -1;
    var renderedFocusedIndex = -1;
    var renderedPlayingIndex = -1;
    var renderedSelectedGroup = "";

    function setItemState(item, className, enabled) {
      if (!item) return;
      item.classList.toggle(className, enabled);
      if (className === "is-focused") {
        item.setAttribute("aria-selected", enabled ? "true" : "false");
      }
    }

    function makeItem(className, primary, secondary) {
      var item = document.createElement("button");
      var accent = document.createElement("span");
      var copy = document.createElement("span");
      var title = document.createElement("span");

      item.type = "button";
      item.className = className;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", "false");
      accent.className = "item-accent";
      copy.className = "item-copy";
      title.className = "item-title";
      title.textContent = primary;
      copy.appendChild(title);

      if (secondary) {
        var meta = document.createElement("span");
        meta.className = "item-meta";
        meta.textContent = secondary;
        copy.appendChild(meta);
      }

      item.appendChild(accent);
      item.appendChild(copy);
      return item;
    }

    function setSources(sources) {
      var fragment = document.createDocumentFragment();
      sourceItems = [];
      sourceListElement.innerHTML = "";
      sources.forEach(function (source, index) {
        var item = makeItem("browser-item source-item", source.name || "当前 M3U", "播放列表");
        item.setAttribute("data-index", String(index));
        item.addEventListener("mouseenter", function () { onSourceFocus(index); });
        item.addEventListener("focus", function () { onSourceFocus(index); });
        item.addEventListener("click", function () { onSourceSelect(index); });
        sourceItems.push(item);
        fragment.appendChild(item);
      });
      sourceListElement.appendChild(fragment);
      renderedSources = sources;
      renderedFocusedSourceIndex = -1;
    }

    function countGroupChannels(channels, group) {
      if (group === "全部") return channels.length;
      return channels.filter(function (channel) { return channel.group === group; }).length;
    }

    function setGroups(channels, groups) {
      var fragment = document.createDocumentFragment();
      groupItems = [];
      groupListElement.innerHTML = "";
      groups.forEach(function (group, index) {
        var count = countGroupChannels(channels, group);
        var item = makeItem("browser-item group-item", group, count + " 个频道");
        item.setAttribute("data-index", String(index));
        item.addEventListener("mouseenter", function () { onGroupFocus(index); });
        item.addEventListener("focus", function () { onGroupFocus(index); });
        item.addEventListener("click", function () { onGroupSelect(index); });
        groupItems.push(item);
        fragment.appendChild(item);
      });
      groupListElement.appendChild(fragment);
      renderedGroupSignature = groups.join("\u0000") + "|" + channels.length;
      renderedFocusedGroupIndex = -1;
      renderedSelectedGroup = "";
    }

    function createChannelItem(channel, index) {
      var item = makeItem("browser-item channel-item", channel.name, channel.group);
      var number = document.createElement("span");
      var logoSlot = document.createElement("span");
      number.className = "channel-number";
      number.textContent = String(index + 1);
      logoSlot.className = "channel-logo";

      if (channel.logo) {
        var logo = document.createElement("img");
        logo.alt = "";
        logo.loading = "lazy";
        logo.src = channel.logo;
        logo.addEventListener("error", function () {
          logo.remove();
          logoSlot.textContent = (channel.name || "?").slice(0, 1).toUpperCase();
        });
        logoSlot.appendChild(logo);
      } else {
        logoSlot.textContent = (channel.name || "?").slice(0, 1).toUpperCase();
      }

      item.insertBefore(number, item.children[1]);
      item.insertBefore(logoSlot, item.children[2]);
      item.setAttribute("data-index", String(index));
      item.addEventListener("mouseenter", function () { onFocus(index); });
      item.addEventListener("focus", function () { onFocus(index); });
      item.addEventListener("click", function () { onSelect(index, getInputTime()); });
      return item;
    }

    function setChannels(channels, selectedGroup) {
      var fragment = document.createDocumentFragment();
      channelItems = {};
      channelListElement.innerHTML = "";
      channels.forEach(function (channel, index) {
        if (selectedGroup !== "全部" && channel.group !== selectedGroup) return;
        var item = createChannelItem(channel, index);
        channelItems[index] = item;
        fragment.appendChild(item);
      });
      channelListElement.appendChild(fragment);
      renderedChannels = channels;
      renderedSelectedGroup = selectedGroup;
      renderedFocusedIndex = -1;
      renderedPlayingIndex = -1;
    }

    function renderPrograms(channel, programs) {
      epgListElement.innerHTML = "";
      epgTitleElement.textContent = channel ? channel.name : "当前频道";
      if (!channel) return;

      if (!programs || !programs.length) {
        var empty = document.createElement("div");
        empty.className = "epg-empty";
        empty.textContent = "暂无节目单";
        epgListElement.appendChild(empty);
        return;
      }

      var now = Date.now();
      programs.slice(0, 4).forEach(function (program) {
        var row = document.createElement("div");
        var time = document.createElement("span");
        var title = document.createElement("span");
        var isCurrent = program.start && program.stop &&
          program.start.getTime() <= now && program.stop.getTime() > now;
        row.className = "epg-program" + (isCurrent ? " is-current" : "");
        time.className = "epg-time";
        time.textContent = formatTime(program.start);
        title.className = "epg-title";
        title.textContent = program.title || "未命名节目";
        row.appendChild(time);
        row.appendChild(title);
        epgListElement.appendChild(row);
      });
    }

    function render(view) {
      var groups = uniqueGroups(view.channels);
      var groupSignature = groups.join("\u0000") + "|" + view.channels.length;
      var selectedGroup = view.selectedGroup || "全部";
      var visibleCount = countGroupChannels(view.channels, selectedGroup);
      var focusedChannel = view.channels[view.focusedIndex];

      panelElement.classList.toggle("is-open", view.open);
      panelElement.classList.toggle("is-column-sources", view.browserColumn === 0);
      panelElement.classList.toggle("is-column-groups", view.browserColumn === 1);
      panelElement.classList.toggle("is-column-channels", view.browserColumn === 2);
      panelElement.setAttribute("aria-hidden", view.open ? "false" : "true");
      trackElement.setAttribute("data-column", String(view.browserColumn));

      if (renderedSources !== view.sources) setSources(view.sources);
      if (renderedChannels !== view.channels || renderedGroupSignature !== groupSignature) {
        setGroups(view.channels, groups);
      }
      if (renderedChannels !== view.channels || renderedSelectedGroup !== selectedGroup) {
        setChannels(view.channels, selectedGroup);
      }

      countElement.textContent = String(visibleCount);
      columnTitleElement.textContent = selectedGroup;
      if (!view.open) return;

      if (renderedFocusedSourceIndex !== view.focusedSourceIndex) {
        setItemState(sourceItems[renderedFocusedSourceIndex], "is-focused", false);
        setItemState(sourceItems[view.focusedSourceIndex], "is-focused", view.browserColumn === 0);
        renderedFocusedSourceIndex = view.focusedSourceIndex;
      } else {
        setItemState(sourceItems[view.focusedSourceIndex], "is-focused", view.browserColumn === 0);
      }

      if (renderedFocusedGroupIndex !== view.focusedGroupIndex) {
        setItemState(groupItems[renderedFocusedGroupIndex], "is-focused", false);
        renderedFocusedGroupIndex = view.focusedGroupIndex;
      }
      groupItems.forEach(function (item, index) {
        setItemState(item, "is-focused", view.browserColumn === 1 && index === view.focusedGroupIndex);
        setItemState(item, "is-selected", groups[index] === selectedGroup);
      });

      if (renderedFocusedIndex !== view.focusedIndex) {
        setItemState(channelItems[renderedFocusedIndex], "is-focused", false);
        renderedFocusedIndex = view.focusedIndex;
      }
      Object.keys(channelItems).forEach(function (index) {
        setItemState(channelItems[index], "is-focused", view.browserColumn === 2 && Number(index) === view.focusedIndex);
        setItemState(channelItems[index], "is-playing", Number(index) === view.playingIndex);
      });
      renderedPlayingIndex = view.playingIndex;

      if (view.shouldScroll) {
        var targetItem = view.browserColumn === 0
          ? sourceItems[view.focusedSourceIndex]
          : view.browserColumn === 1
            ? groupItems[view.focusedGroupIndex]
            : channelItems[view.focusedIndex];
        if (targetItem) targetItem.scrollIntoView({ block: "nearest" });
      }

      epgElement.classList.toggle("is-visible", view.browserColumn === 2 && Boolean(focusedChannel));
      renderPrograms(focusedChannel, view.programs || []);
    }

    return { render: render };
  }

  return { create: create, uniqueGroups: uniqueGroups };
});
