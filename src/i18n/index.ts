import {en, ja, ko, zhCN, zhTW} from "./locales";
import type {MessageKey, Messages} from "./messages";

export type SupportedLocale = "en" | "zh-CN" | "zh-TW" | "ja" | "ko";
type Params = Record<string, string | number>;

const catalogs: Record<SupportedLocale, Messages> = {en, "zh-CN": zhCN, "zh-TW": zhTW, ja, ko};

export function resolveLocale(languages: readonly string[] = []): SupportedLocale {
  for (const candidate of languages) {
    const normalized = String(candidate || "").replace(/_/g, "-").toLowerCase();
    if (normalized === "zh-tw" || normalized === "zh-hk" || normalized === "zh-mo" || normalized.includes("hant")) return "zh-TW";
    if (normalized === "zh" || normalized.startsWith("zh-cn") || normalized.startsWith("zh-sg") || normalized.includes("hans")) return "zh-CN";
    if (normalized === "ja" || normalized.startsWith("ja-")) return "ja";
    if (normalized === "ko" || normalized.startsWith("ko-")) return "ko";
    if (normalized === "en" || normalized.startsWith("en-")) return "en";
  }
  return "en";
}

function systemLanguages(): string[] {
  if (typeof navigator === "undefined") return [];
  return [...(navigator.languages || []), navigator.language].filter(Boolean);
}

let locale: SupportedLocale = resolveLocale(systemLanguages());

export function getLocale(): SupportedLocale {
  return locale;
}

export function t(key: MessageKey, params: Params = {}): string {
  const template = catalogs[locale][key] || en[key] || key;
  return template.replace(/{{(\w+)}}/g, (_match, name: string) => String(params[name] ?? ""));
}

export function formatTime(value: Date): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "--:--";
  try {
    return new Intl.DateTimeFormat(locale, {hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).format(value);
  } catch {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
}

export function translateDocument(root: ParentNode = document): void {
  if (typeof document !== "undefined") document.documentElement.lang = locale;
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n as MessageKey);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel as MessageKey));
  });
}

export const i18nApi = {getLocale, resolveLocale, t, formatTime, translateDocument};
export type {MessageKey};
