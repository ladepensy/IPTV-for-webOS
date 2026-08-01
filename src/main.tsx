import "../styles.css";
import "../features/channels/channel-panel.css";
import "../features/sources/source-form.css";
import {channelBrowserApi} from "./core/channel-browser-state";
import {sourceStoreApi} from "./core/source-store";
import {parseM3U} from "./core/m3u";
import {parseXmltv} from "./core/xmltv";
import {channelPanelApi} from "./ui/channel-panel";
import {sourceFormApi} from "./ui/source-form";

window.IPTVChannelBrowserState = channelBrowserApi;
window.IPTVSourceStore = sourceStoreApi;
window.IPTVCore = {parseM3U, parseXmltv};
window.IPTVChannelPanel = channelPanelApi;
window.IPTVSourceForm = sourceFormApi;

function loadClassicScript(relativeUrl: string, optional = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL(relativeUrl, document.baseURI).href;
    script.onload = () => resolve();
    script.onerror = () => optional ? resolve() : reject(new Error(`无法加载 ${relativeUrl}`));
    document.head.appendChild(script);
  });
}

async function start(): Promise<void> {
  await loadClassicScript("config.js", true);
  await loadClassicScript("interaction.js");
  await loadClassicScript("app.js");
}

void start();
