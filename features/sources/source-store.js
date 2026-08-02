(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.IPTVSourceStore = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  var STORAGE_KEY = "home-iptv:playlist-sources";
  var MAX_SOURCES = 10;

  function copyObject(value) {
    var result = {};
    if (!value || typeof value !== "object") return result;
    Object.keys(value).forEach(function (key) { result[key] = value[key]; });
    return result;
  }

  function displayName(source) {
    if (source && String(source.name || "").trim()) return String(source.name).trim();
    try {
      return new URL(source.url).hostname || "未命名播放源";
    } catch (error) {
      return "未命名播放源";
    }
  }

  function normalizeUrl(value) {
    var url = String(value || "").trim();
    var parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      throw new Error("请输入有效的 M3U 地址");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("播放源地址必须使用 HTTP 或 HTTPS");
    }
    return url;
  }

  function normalizeSource(value) {
    if (!value || !value.id || !value.url) return null;
    try {
      return {
        id: String(value.id),
        name: String(value.name || "").trim(),
        url: normalizeUrl(value.url),
        request: copyObject(value.request),
        epgUrl: String(value.epgUrl || ""),
        epgRequest: copyObject(value.epgRequest),
        lastChannel: value.lastChannel && typeof value.lastChannel === "object"
          ? copyObject(value.lastChannel)
          : null
      };
    } catch (error) {
      return null;
    }
  }

  function makeId(now, random) {
    return "source_" + now().toString(36) + "_" +
      Math.floor(random() * 0x1000000).toString(36);
  }

  function create(options) {
    options = options || {};
    var storage = options.storage;
    var now = options.now || Date.now;
    var random = options.random || Math.random;
    var legacy = options.legacyConfig || {};
    var data = { version: 1, activeSourceId: "", sources: [] };
    var hasStoredState = false;

    try {
      var saved = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
      if (saved && Array.isArray(saved.sources)) {
        hasStoredState = true;
        data.sources = saved.sources.map(normalizeSource).filter(Boolean).slice(0, MAX_SOURCES);
        data.activeSourceId = String(saved.activeSourceId || "");
      }
    } catch (error) {
      data = { version: 1, activeSourceId: "", sources: [] };
    }

    if (!hasStoredState && !data.sources.length && legacy.url) {
      var migrated = normalizeSource({
        id: "source_config",
        name: legacy.name || "",
        url: legacy.url,
        request: legacy.request,
        epgUrl: legacy.epgUrl,
        epgRequest: legacy.epgRequest
      });
      if (migrated) {
        data.sources.push(migrated);
        data.activeSourceId = migrated.id;
        persist();
      }
    }

    if (!getById(data.activeSourceId) && data.sources.length) {
      data.activeSourceId = data.sources[0].id;
      persist();
    }

    function persist() {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        // Keep the in-memory source list usable if storage is unavailable or full.
      }
    }

    function getById(id) {
      for (var index = 0; index < data.sources.length; index += 1) {
        if (data.sources[index].id === id) return data.sources[index];
      }
      return null;
    }

    function getSources() {
      return data.sources.slice();
    }

    function getActive() {
      return getById(data.activeSourceId);
    }

    function add(input) {
      if (data.sources.length >= MAX_SOURCES) throw new Error("播放源数量已达到上限");
      var hadActiveSource = Boolean(getById(data.activeSourceId));
      var source = normalizeSource({
        id: makeId(now, random),
        name: input.name,
        url: input.url
      });
      if (!source) throw new Error("请输入有效的 M3U 地址");
      data.sources.push(source);
      if (!hadActiveSource) data.activeSourceId = source.id;
      persist();
      return source;
    }

    function update(id, input) {
      var source = getById(id);
      if (!source) throw new Error("播放源不存在");
      var nextUrl = normalizeUrl(input.url);
      var nextName = String(input.name || "").trim();
      var urlChanged = nextUrl !== source.url;
      if (!urlChanged && nextName === source.name) return source;
      source.name = nextName;
      source.url = nextUrl;
      if (urlChanged) {
        source.request = {};
        source.epgUrl = "";
        source.epgRequest = {};
        source.lastChannel = null;
      }
      persist();
      return source;
    }

    function remove(id) {
      var index = data.sources.map(function (source) { return source.id; }).indexOf(id);
      if (index < 0) return null;
      var removed = data.sources.splice(index, 1)[0];
      if (data.activeSourceId === id) {
        var replacement = data.sources[index] || data.sources[index - 1] || null;
        data.activeSourceId = replacement ? replacement.id : "";
      }
      persist();
      return removed;
    }

    function setActive(id) {
      var source = getById(id);
      if (!source) return null;
      if (data.activeSourceId === source.id) return source;
      data.activeSourceId = source.id;
      persist();
      return source;
    }

    function sameChannel(left, right) {
      return Boolean(left && right) &&
        left.sourceId === right.sourceId &&
        left.channelId === right.channelId &&
        left.name === right.name &&
        left.group === right.group &&
        left.selectedGroup === right.selectedGroup &&
        left.index === right.index;
    }

    function rememberChannels(entries) {
      var changed = false;
      (entries || []).forEach(function (entry) {
        var source = entry ? getById(entry.id) : null;
        if (!source || !entry.channel) return;
        var nextChannel = {
          sourceId: source.id,
          channelId: entry.channel.id || "",
          name: entry.channel.name || "",
          group: entry.channel.group || "",
          selectedGroup: String(entry.selectedGroup || "全部"),
          index: Number(entry.index) || 0
        };
        if (sameChannel(source.lastChannel, nextChannel)) return;
        source.lastChannel = nextChannel;
        changed = true;
      });
      if (changed) persist();
      return changed;
    }

    function rememberChannel(id, channel, index, selectedGroup) {
      return rememberChannels([{ id: id, channel: channel, index: index, selectedGroup: selectedGroup }]);
    }

    return {
      getSources: getSources,
      getActive: getActive,
      getById: getById,
      add: add,
      update: update,
      remove: remove,
      setActive: setActive,
      rememberChannel: rememberChannel,
      rememberChannels: rememberChannels,
      displayName: displayName,
      canAdd: function () { return data.sources.length < MAX_SOURCES; }
    };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    MAX_SOURCES: MAX_SOURCES,
    create: create,
    displayName: displayName,
    normalizeUrl: normalizeUrl
  };
});
