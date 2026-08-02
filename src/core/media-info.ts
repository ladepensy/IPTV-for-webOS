export type MediaInfo = {
  width: number;
  height: number;
};

export function getResolutionLabel(width: number, height: number): string {
  if (!width || !height) return "";
  if (width >= 3840 || height >= 2160) return "4K UHD";
  if (height >= 1440) return "1440p";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 576) return "576p";
  if (height >= 480) return "480p";
  return `${height}p`;
}

export function formatMediaInfo(info: MediaInfo): string {
  return getResolutionLabel(info.width, info.height) || "清晰度未知";
}

export const mediaInfoApi = {
  getResolutionLabel,
  formatMediaInfo
};
