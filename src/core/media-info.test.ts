import {describe, expect, it} from "vitest";
import {formatMediaInfo, getResolutionLabel} from "./media-info";

describe("media info", () => {
  it("classifies common television resolutions", () => {
    expect(getResolutionLabel(3840, 2160)).toBe("4K UHD");
    expect(getResolutionLabel(1920, 1080)).toBe("1080p");
    expect(getResolutionLabel(1280, 720)).toBe("720p");
    expect(getResolutionLabel(720, 576)).toBe("576p");
  });

  it("formats a compact resolution label", () => {
    expect(formatMediaInfo({
      width: 3840,
      height: 2160
    })).toBe("4K UHD");
  });

  it("does not present unavailable values as known", () => {
    expect(formatMediaInfo({
      width: 0,
      height: 0
    })).toBe("Resolution unknown");
  });
});
