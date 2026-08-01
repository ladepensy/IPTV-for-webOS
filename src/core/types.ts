export interface Channel {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
}

export interface Program {
  start: Date;
  stop: Date;
  title: string;
}

export interface LastChannel {
  channelId: string;
  name: string;
  group: string;
  index: number;
}

export interface PlaylistSource {
  id: string;
  name: string;
  url: string;
  request: Record<string, unknown>;
  epgUrl: string;
  epgRequest: Record<string, unknown>;
  lastChannel: LastChannel | null;
}

export interface SourceView {
  id: string;
  name?: string;
  displayName?: string;
  url?: string;
}
