import type {Program} from "./types";

export type ProgramIndex = Record<string, Program[]>;

export function parseXmltvTime(value: string | null | undefined): Date | null {
  const match = String(value || "").match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\s*([+-])(\d{2})(\d{2}))?/
  );
  if (!match) return null;
  let utc = Date.UTC(
    Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]), Number(match[5]), Number(match[6] || 0)
  );
  if (match[7]) {
    const offset = (Number(match[8]) * 60 + Number(match[9])) * 60000;
    utc += match[7] === "+" ? -offset : offset;
  }
  return new Date(utc);
}

function addProgram(index: ProgramIndex, key: string | null, program: Program): void {
  const normalized = String(key || "").trim().toLowerCase();
  if (!normalized) return;
  if (!index[normalized]) index[normalized] = [];
  index[normalized].push(program);
}

export function parseXmltv(text: string, nowValue = Date.now()): ProgramIndex {
  const documentNode = new DOMParser().parseFromString(text, "application/xml");
  if (documentNode.querySelector("parsererror")) throw new Error("EPG XML 格式无效");

  const horizon = nowValue + 24 * 60 * 60 * 1000;
  const aliases: Record<string, string[]> = {};
  const programs: ProgramIndex = {};

  documentNode.querySelectorAll("channel").forEach((node) => {
    const id = String(node.getAttribute("id") || "").trim();
    if (!id) return;
    aliases[id] = [id];
    node.querySelectorAll("display-name").forEach((nameNode) => {
      const alias = String(nameNode.textContent || "").trim();
      if (alias && aliases[id].indexOf(alias) < 0) aliases[id].push(alias);
    });
  });

  documentNode.querySelectorAll("programme").forEach((node) => {
    const start = parseXmltvTime(node.getAttribute("start"));
    const stop = parseXmltvTime(node.getAttribute("stop"));
    if (!start || !stop || stop.getTime() < nowValue - 60 * 60 * 1000 || start.getTime() > horizon) return;
    const channelId = String(node.getAttribute("channel") || "");
    const program: Program = {
      start,
      stop,
      title: String(node.querySelector("title")?.textContent || "未命名节目").trim()
    };
    (aliases[channelId] || [channelId]).forEach((key) => addProgram(programs, key, program));
  });

  Object.keys(programs).forEach((key) => {
    programs[key].sort((left, right) => left.start.getTime() - right.start.getTime());
  });
  return programs;
}
