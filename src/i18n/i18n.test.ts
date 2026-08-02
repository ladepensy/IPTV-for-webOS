import {describe, expect, it} from "vitest";
import {resolveLocale, t} from "./index";

describe("i18n", () => {
  it.each([
    [["en-US"], "en"],
    [["zh-CN"], "zh-CN"],
    [["zh-Hans-SG"], "zh-CN"],
    [["zh-TW"], "zh-TW"],
    [["zh-HK"], "zh-TW"],
    [["zh-Hant"], "zh-TW"],
    [["ja-JP"], "ja"],
    [["ko-KR"], "ko"]
  ] as const)("maps %j to %s", (languages, expected) => {
    expect(resolveLocale(languages)).toBe(expected);
  });

  it("uses English when no supported system language matches", () => {
    expect(resolveLocale(["fr-FR", "de-DE"])).toBe("en");
    expect(resolveLocale([])).toBe("en");
  });

  it("interpolates parameters in the default English catalog", () => {
    expect(t("channel.count", {count: 12})).toBe("12 channels");
  });
});
