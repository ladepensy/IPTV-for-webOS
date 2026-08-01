import type {channelBrowserApi} from "./core/channel-browser-state";
import type {sourceStoreApi} from "./core/source-store";
import type {channelPanelApi} from "./ui/channel-panel";
import type {sourceFormApi} from "./ui/source-form";
import type {spotlightApi} from "./ui/spotlight";
import type {parseM3U} from "./core/m3u";
import type {parseXmltv} from "./core/xmltv";

declare global {
  interface Window {
    IPTV_CONFIG?: Record<string, any>;
    IPTVChannelBrowserState: typeof channelBrowserApi;
    IPTVSourceStore: typeof sourceStoreApi;
    IPTVChannelPanel: typeof channelPanelApi;
    IPTVSourceForm: typeof sourceFormApi;
    IPTVSpotlight: typeof spotlightApi;
    IPTVCore: {parseM3U: typeof parseM3U; parseXmltv: typeof parseXmltv};
    IPTVInteraction: any;
    webOS?: {platformBack?: () => void};
  }
}

export {};
