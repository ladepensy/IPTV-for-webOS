import type {Channel, PlaylistSource} from "./types";
import {t} from "../i18n";
import {ALL_GROUP_ID} from "./channel-browser-state";

export const STORAGE_KEY = "home-iptv:playlist-sources";
export const MAX_SOURCES = 10;

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type SourceInput = Partial<PlaylistSource> & {url?: string};

interface StoredData {
  version: number;
  activeSourceId: string;
  sources: PlaylistSource[];
}

export interface SourceStore {
  getSources(): PlaylistSource[];
  getActive(): PlaylistSource | null;
  getById(id: string): PlaylistSource | null;
  add(input: SourceInput): PlaylistSource;
  update(id: string, input: SourceInput): PlaylistSource;
  remove(id: string): PlaylistSource | null;
  setActive(id: string): PlaylistSource | null;
  rememberChannel(id: string, channel: Channel, index: number, selectedGroup?: string): boolean;
  rememberChannels(entries: Array<{id: string; channel: Channel; index: number; selectedGroup?: string}>): boolean;
  displayName(source: PlaylistSource): string;
  canAdd(): boolean;
}

function copyObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? {...value as Record<string, unknown>} : {};
}

export function displayName(source: Pick<PlaylistSource, "name" | "url">): string {
  if (String(source?.name || "").trim()) return String(source.name).trim();
  try {
    return new URL(source.url).hostname || t("source.unnamed");
  } catch {
    return t("source.unnamed");
  }
}

export function normalizeUrl(value: unknown): string {
  const url = String(value || "").trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(t("source.invalidUrl"));
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(t("source.httpOnly"));
  }
  return url;
}

function normalizeSource(value: SourceInput): PlaylistSource | null {
  if (!value?.id || !value.url) return null;
  try {
    return {
      id: String(value.id),
      name: String(value.name || "").trim(),
      url: normalizeUrl(value.url),
      request: copyObject(value.request),
      epgUrl: String(value.epgUrl || ""),
      epgRequest: copyObject(value.epgRequest),
      lastChannel: value.lastChannel && typeof value.lastChannel === "object"
        ? {...value.lastChannel}
        : null
    };
  } catch {
    return null;
  }
}

export function create(options: {
  storage: StorageLike;
  legacyConfig?: SourceInput;
  now?: () => number;
  random?: () => number;
}): SourceStore {
  const storage = options.storage;
  const now = options.now || Date.now;
  const random = options.random || Math.random;
  const legacy = options.legacyConfig || {};
  let data: StoredData = {version: 1, activeSourceId: "", sources: []};
  let hasStoredState = false;

  function persist(): void {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Keep in-memory state usable if storage is unavailable or full.
    }
  }

  function getById(id: string): PlaylistSource | null {
    return data.sources.find((source) => source.id === id) || null;
  }

  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) || "null") as Partial<StoredData> | null;
    if (saved && Array.isArray(saved.sources)) {
      hasStoredState = true;
      data.sources = saved.sources.map(normalizeSource).filter((item): item is PlaylistSource => Boolean(item)).slice(0, MAX_SOURCES);
      data.activeSourceId = String(saved.activeSourceId || "");
    }
  } catch {
    data = {version: 1, activeSourceId: "", sources: []};
  }

  if (!hasStoredState && !data.sources.length && legacy.url) {
    const migrated = normalizeSource({
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

  function add(input: SourceInput): PlaylistSource {
    if (data.sources.length >= MAX_SOURCES) throw new Error(t("source.limitReached"));
    const hadActiveSource = Boolean(getById(data.activeSourceId));
    const source = normalizeSource({
      id: `source_${now().toString(36)}_${Math.floor(random() * 0x1000000).toString(36)}`,
      name: input.name,
      url: input.url
    });
    if (!source) throw new Error(t("source.invalidUrl"));
    data.sources.push(source);
    if (!hadActiveSource) data.activeSourceId = source.id;
    persist();
    return source;
  }

  function update(id: string, input: SourceInput): PlaylistSource {
    const source = getById(id);
    if (!source) throw new Error(t("source.notFound"));
    const nextUrl = normalizeUrl(input.url);
    const nextName = String(input.name || "").trim();
    const urlChanged = nextUrl !== source.url;
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

  function remove(id: string): PlaylistSource | null {
    const index = data.sources.findIndex((source) => source.id === id);
    if (index < 0) return null;
    const removed = data.sources.splice(index, 1)[0];
    if (data.activeSourceId === id) {
      const replacement = data.sources[index] || data.sources[index - 1] || null;
      data.activeSourceId = replacement?.id || "";
    }
    persist();
    return removed;
  }

  function setActive(id: string): PlaylistSource | null {
    const source = getById(id);
    if (!source) return null;
    if (data.activeSourceId !== source.id) {
      data.activeSourceId = source.id;
      persist();
    }
    return source;
  }

  function rememberChannels(entries: Array<{id: string; channel: Channel; index: number; selectedGroup?: string}>): boolean {
    let changed = false;
    entries.forEach((entry) => {
      const source = entry ? getById(entry.id) : null;
      if (!source || !entry.channel) return;
      const next = {
        sourceId: source.id,
        channelId: entry.channel.id || "",
        url: entry.channel.url || "",
        name: entry.channel.name || "",
        group: entry.channel.group || "",
        selectedGroup: String(entry.selectedGroup || ALL_GROUP_ID),
        index: Number(entry.index) || 0
      };
      if (source.lastChannel && JSON.stringify(source.lastChannel) === JSON.stringify(next)) return;
      source.lastChannel = next;
      changed = true;
    });
    if (changed) persist();
    return changed;
  }

  return {
    getSources: () => data.sources.slice(),
    getActive: () => getById(data.activeSourceId),
    getById,
    add,
    update,
    remove,
    setActive,
    rememberChannel: (id, channel, index, selectedGroup) => rememberChannels([{id, channel, index, selectedGroup}]),
    rememberChannels,
    displayName,
    canAdd: () => data.sources.length < MAX_SOURCES
  };
}

export const sourceStoreApi = {STORAGE_KEY, MAX_SOURCES, create, displayName, normalizeUrl};
