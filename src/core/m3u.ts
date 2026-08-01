import type {Channel} from "./types";

export interface M3uResult {
  channels: Channel[];
  epgUrl: string;
}

export function parseAttributes(line: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const expression = /([\w-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(line)) !== null) attributes[match[1]] = match[2];
  return attributes;
}

export function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

export function parseM3U(text: string, baseUrl: string): M3uResult {
  const channels: Channel[] = [];
  let pending: Channel | null = null;
  let epgUrl = "";

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    if (line.indexOf("#EXTM3U") === 0) {
      const attributes = parseAttributes(line);
      const declared = attributes["x-tvg-url"] || attributes["url-tvg"];
      if (declared) epgUrl = resolveUrl(declared.split(",")[0].trim(), baseUrl);
      return;
    }

    if (line.indexOf("#EXTINF:") === 0) {
      const commaIndex = line.indexOf(",");
      const metadata = commaIndex >= 0 ? line.slice(0, commaIndex) : line;
      const attributes = parseAttributes(metadata);
      pending = {
        id: attributes["tvg-id"] || "",
        name: (commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : "") ||
          attributes["tvg-name"] || "未命名频道",
        logo: attributes["tvg-logo"] || "",
        group: attributes["group-title"] || "其他",
        url: ""
      };
      return;
    }

    if (line.charAt(0) !== "#") {
      const channel = pending || {
        id: "",
        name: `频道 ${String(channels.length + 1).padStart(3, "0")}`,
        logo: "",
        group: "其他",
        url: ""
      };
      channel.url = resolveUrl(line, baseUrl);
      channels.push(channel);
      pending = null;
    }
  });

  return {channels, epgUrl};
}
