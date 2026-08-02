import {memo, type FocusEvent, useEffect, useRef} from "react";
import {createRoot, type Root} from "react-dom/client";
import {flushSync} from "react-dom";
import {getGroups} from "../core/channel-browser-state";
import type {Channel, Program, SourceView} from "../core/types";
import {
  BrowserSpotlightContainer,
  focusWithSpotlight,
  isSpotlightPointerMode,
  SpotlightButton
} from "./spotlight";

interface ChannelPanelView {
  open: boolean;
  browserColumn: number;
  sources: SourceView[];
  activeSourceId: string;
  canAddSource: boolean;
  channels: Channel[];
  selectedGroup?: string;
  focusedSourceIndex: number;
  focusedGroupIndex: number;
  focusedIndex: number;
  previewIndex?: number;
  playingIndex: number;
  programs?: Program[];
  shouldScroll?: boolean;
}

interface PanelOptions {
  panelElement: HTMLElement;
  trackElement: HTMLElement;
  sourceListElement: HTMLElement;
  groupListElement: HTMLElement;
  channelListElement?: HTMLElement;
  listElement?: HTMLElement;
  countElement: HTMLElement;
  columnTitleElement: HTMLElement;
  epgElement: HTMLElement;
  epgTitleElement: HTMLElement;
  epgListElement: HTMLElement;
  onSourceFocus?: (index: number) => void;
  onSourceSelect?: (index: number) => void;
  onGroupFocus?: (index: number) => void;
  onGroupSelect?: (index: number) => void;
  onFocus: (index: number) => void;
  onPreview?: (index: number | null) => void;
  onSelect: (index: number, inputAt: number) => void;
  getInputTime: () => number;
}

function itemClass(base: string, focused: boolean, selected = false, playing = false): string {
  return ["browser-item", base, focused && "is-focused", selected && "is-selected", playing && "is-playing"]
    .filter(Boolean).join(" ");
}

const SourceItem = memo(function SourceItem(props: {
  source?: SourceView;
  index: number;
  add?: boolean;
  focused: boolean;
  selected: boolean;
  onFocus: (index: number) => void;
  onSelect: (index: number) => void;
}) {
  const handleFocus = (_event: FocusEvent<HTMLButtonElement>) => {
    if (!isSpotlightPointerMode()) props.onFocus(props.index);
  };
  return <SpotlightButton type="button" role="option" aria-selected={props.focused}
    spotlightId={`source-${props.index}`}
    data-index={props.index}
    className={itemClass(`source-item${props.add ? " action-item" : ""}`, props.focused, props.selected)}
    onFocus={handleFocus}
    onClick={() => props.onSelect(props.index)}>
    <span className="item-accent" />
    <span className="item-copy">
      <span className="item-title">{props.add ? "＋ 添加播放源" : props.source?.displayName || props.source?.name || "当前 M3U"}</span>
      <span className="item-meta">{props.add ? "最多 10 个播放源" : "M3U 播放源"}</span>
    </span>
  </SpotlightButton>;
});

const GroupItem = memo(function GroupItem(props: {
  index: number;
  name: string;
  count?: number;
  edit?: boolean;
  focused: boolean;
  selected: boolean;
  onFocus: (index: number) => void;
  onSelect: (index: number) => void;
}) {
  const handleFocus = (_event: FocusEvent<HTMLButtonElement>) => {
    if (!isSpotlightPointerMode()) props.onFocus(props.index);
  };
  return <SpotlightButton type="button" role="option" aria-selected={props.focused}
    spotlightId={`group-${props.index}`}
    data-index={props.index}
    className={itemClass(`group-item${props.edit ? " action-item" : ""}`, props.focused, props.selected)}
    onFocus={handleFocus}
    onClick={() => props.onSelect(props.index)}>
    <span className="item-accent" />
    <span className="item-copy">
      <span className="item-title">{props.name}</span>
      <span className="item-meta">{props.edit ? "修改名称、地址或删除" : `${props.count} 个频道`}</span>
    </span>
  </SpotlightButton>;
});

const ChannelItem = memo(function ChannelItem(props: {
  channel: Channel;
  index: number;
  focused: boolean;
  playing: boolean;
  shouldScroll: boolean;
  onFocus: (index: number) => void;
  onPreview: (index: number | null) => void;
  onSelect: (index: number, inputAt: number) => void;
  getInputTime: () => number;
}) {
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleFocus = (_event: FocusEvent<HTMLButtonElement>) => {
    if (!isSpotlightPointerMode()) props.onFocus(props.index);
  };
  const cancelPreviewTimer = () => {
    if (previewTimer.current !== null) clearTimeout(previewTimer.current);
    previewTimer.current = null;
  };
  const handleMouseEnter = () => {
    cancelPreviewTimer();
    previewTimer.current = setTimeout(() => {
      previewTimer.current = null;
      props.onPreview(props.index);
    }, 120);
  };
  const handleMouseLeave = () => {
    cancelPreviewTimer();
    props.onPreview(null);
  };
  useEffect(() => cancelPreviewTimer, []);
  const initial = (props.channel.name || "?").slice(0, 1).toUpperCase();
  return <SpotlightButton type="button" role="option" aria-selected={props.focused}
    spotlightId={`channel-${props.index}`}
    data-index={props.index} className={itemClass("channel-item", props.focused, false, props.playing)}
    onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} onFocus={handleFocus}
    onClick={() => { props.onPreview(null); props.onSelect(props.index, props.getInputTime()); }}>
    <span className="item-accent" />
    <span className="channel-number">{props.index + 1}</span>
    <span className="channel-logo">
      {props.channel.logo
        ? <img alt="" loading="lazy" src={props.channel.logo}
          onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement!.textContent = initial; }} />
        : initial}
    </span>
    <span className="item-copy">
      <span className="item-title">{props.channel.name}</span>
      <span className="item-meta">{props.channel.group}</span>
    </span>
  </SpotlightButton>;
});

function formatTime(value: Date): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "--:--";
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

export function createChannelPanel(options: PanelOptions) {
  const channelList = options.channelListElement || options.listElement;
  if (!channelList) throw new Error("channelListElement is required");
  const roots: Root[] = [options.sourceListElement, options.groupListElement, channelList, options.epgListElement]
    .map((element) => createRoot(element));
  const onSourceFocus = options.onSourceFocus || (() => undefined);
  const onSourceSelect = options.onSourceSelect || (() => undefined);
  const onGroupFocus = options.onGroupFocus || (() => undefined);
  const onGroupSelect = options.onGroupSelect || (() => undefined);
  const onPreview = options.onPreview || (() => undefined);

  function render(view: ChannelPanelView): void {
    const groups = getGroups(view.channels);
    const selectedGroup = view.selectedGroup || "全部";
    const visibleChannels = view.channels.map((channel, index) => ({channel, index}))
      .filter(({channel}) => selectedGroup === "全部" || channel.group === selectedGroup);
    const previewIndex = typeof view.previewIndex === "number" ? view.previewIndex : view.focusedIndex;
    const focusedChannel = view.channels[previewIndex];

    options.panelElement.classList.toggle("is-open", view.open);
    options.panelElement.classList.toggle("is-column-sources", view.browserColumn === 0);
    options.panelElement.classList.toggle("is-column-groups", view.browserColumn === 1);
    options.panelElement.classList.toggle("is-column-channels", view.browserColumn === 2);
    options.panelElement.setAttribute("aria-hidden", view.open ? "false" : "true");
    options.trackElement.setAttribute("data-column", String(view.browserColumn));
    options.countElement.textContent = String(visibleChannels.length);
    options.columnTitleElement.textContent = selectedGroup;
    options.epgElement.classList.toggle("is-visible", view.browserColumn === 2 && Boolean(focusedChannel));
    options.epgTitleElement.textContent = focusedChannel?.name || "当前频道";

    flushSync(() => {
      roots[0].render(<BrowserSpotlightContainer className="spotlight-list-content" spotlightId="source-list-container"
        spotlightDisabled={!view.open || view.browserColumn !== 0}>{view.sources.map((source, index) => <SourceItem key={source.id} source={source} index={index}
        focused={view.open && view.browserColumn === 0 && index === view.focusedSourceIndex}
        selected={source.id === view.activeSourceId} onFocus={onSourceFocus} onSelect={onSourceSelect} />)}
        {view.canAddSource && <SourceItem key="add" index={view.sources.length} add focused={view.open && view.browserColumn === 0 && view.focusedSourceIndex === view.sources.length}
          selected={false} onFocus={onSourceFocus} onSelect={onSourceSelect} />}</BrowserSpotlightContainer>);
      roots[1].render(<BrowserSpotlightContainer className="spotlight-list-content" spotlightId="group-list-container"
        spotlightDisabled={!view.open || view.browserColumn !== 1}><GroupItem key="edit" index={0} name="编辑此播放源" edit
        focused={view.open && view.browserColumn === 1 && view.focusedGroupIndex === 0} selected={false}
        onFocus={onGroupFocus} onSelect={onGroupSelect} />
        {groups.map((group, index) => <GroupItem key={group} index={index + 1} name={group}
          count={group === "全部" ? view.channels.length : view.channels.filter((channel) => channel.group === group).length}
          focused={view.open && view.browserColumn === 1 && view.focusedGroupIndex === index + 1}
          selected={group === selectedGroup} onFocus={onGroupFocus} onSelect={onGroupSelect} />)}</BrowserSpotlightContainer>);
      roots[2].render(<BrowserSpotlightContainer className="spotlight-list-content" spotlightId="channel-list-container"
        spotlightDisabled={!view.open || view.browserColumn !== 2}>{visibleChannels.map(({channel, index}) => <ChannelItem key={`${channel.id}-${channel.url}-${index}`}
        channel={channel} index={index} focused={view.open && view.browserColumn === 2 && index === view.focusedIndex}
        playing={index === view.playingIndex} shouldScroll={Boolean(view.shouldScroll)}
        onFocus={options.onFocus} onPreview={onPreview} onSelect={options.onSelect} getInputTime={options.getInputTime} />)}</BrowserSpotlightContainer>);
      const now = Date.now();
      roots[3].render(<>{focusedChannel && (!(view.programs || []).length
        ? <div className="epg-empty">暂无节目单</div>
        : (view.programs || []).slice(0, 4).map((program, index) => <div key={`${program.start.getTime()}-${index}`}
          className={`epg-program${program.start.getTime() <= now && program.stop.getTime() > now ? " is-current" : ""}`}>
          <span className="epg-time">{formatTime(program.start)}</span><span className="epg-title">{program.title || "未命名节目"}</span>
        </div>))}</>);
    });

    if (view.open) {
      const activeList = [options.sourceListElement, options.groupListElement, channelList][view.browserColumn];
      const focusedElement = activeList?.querySelector<HTMLElement>(".browser-item.is-focused") || null;
      if (view.shouldScroll) focusedElement?.scrollIntoView({block: "nearest"});
      focusWithSpotlight(focusedElement);
    }
  }

  return {render};
}

export const channelPanelApi = {create: createChannelPanel, uniqueGroups: getGroups};
