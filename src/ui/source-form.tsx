import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import type {PlaylistSource} from "../core/types";

interface FormValue { name: string; url: string }
interface FormSettings {
  mode?: "add" | "edit";
  source?: PlaylistSource | null;
  required?: boolean;
  error?: string;
}

interface SourceFormOptions {
  rootElement: HTMLElement;
  normalizeUrl: (url: string) => string;
  confirm: (message: string) => boolean;
  onSave: (payload: {mode: "add" | "edit"; source: PlaylistSource | null; value: FormValue}) => void;
  onCancel: () => void;
  onDelete: (source: PlaylistSource) => void;
  onExit: () => void;
}

export function createSourceForm(options: SourceFormOptions) {
  const root = createRoot(options.rootElement);
  let open = false;
  let mode: "add" | "edit" = "add";
  let source: PlaylistSource | null = null;
  let required = false;
  let error = "";
  let initial: FormValue = {name: "", url: ""};
  let renderKey = 0;

  const nameInput = () => options.rootElement.querySelector<HTMLInputElement>("#source-name-input");
  const urlInput = () => options.rootElement.querySelector<HTMLInputElement>("#source-url-input");

  function getValue(): FormValue {
    return {name: String(nameInput()?.value || "").trim(), url: String(urlInput()?.value || "").trim()};
  }

  function isDirty(): boolean {
    const value = getValue();
    return value.name !== initial.name || value.url !== initial.url;
  }

  function submit(): void {
    const value = getValue();
    try {
      value.url = options.normalizeUrl(value.url);
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "请输入有效的 M3U 地址");
      urlInput()?.focus();
      return;
    }
    error = "";
    options.onSave({mode, source, value});
  }

  function cancel(): void {
    if (required) {
      options.onExit();
      return;
    }
    if (isDirty() && !options.confirm("放弃未保存的修改？")) return;
    hide();
    options.onCancel();
  }

  function remove(): void {
    if (!source || !options.confirm("确定删除这个播放源？")) return;
    const deleting = source;
    hide();
    options.onDelete(deleting);
  }

  function render(): void {
    flushSync(() => root.render(<div className="source-form-card" key={renderKey}>
      <p className="eyebrow">播放源</p>
      <h2 id="source-form-title">{mode === "edit" ? "编辑播放源" : "添加播放源"}</h2>
      <p id="source-form-subtitle" className="source-form-subtitle">
        {mode === "edit" ? "修改当前 M3U 播放源" : "添加一个电视可访问的 M3U 地址"}
      </p>
      <div className="source-form-fields">
        <label className="source-field"><span>名称（可选）</span>
          <input id="source-name-input" type="text" maxLength={60} autoComplete="off" defaultValue={initial.name} placeholder="例如：家庭 IPTV" />
        </label>
        <label className="source-field"><span>M3U 地址（必填）</span>
          <input id="source-url-input" type="url" inputMode="url" autoComplete="off" spellCheck={false}
            defaultValue={initial.url} placeholder="http://server/playlist.m3u" />
        </label>
      </div>
      <p id="source-form-error" className="source-form-error" role="alert" hidden={!error}>{error}</p>
      <div className="source-form-actions">
        <button id="source-save-button" className="source-form-button is-primary" type="button" onClick={submit}>
          {mode === "edit" ? "保存修改" : "添加并播放"}
        </button>
        {!required && <button id="source-cancel-button" className="source-form-button" type="button" onClick={cancel}>取消</button>}
        {mode === "edit" && <button id="source-delete-button" className="source-form-button is-danger" type="button" onClick={remove}>删除播放源</button>}
      </div>
    </div>));
  }

  function show(settings: FormSettings): void {
    mode = settings.mode === "edit" ? "edit" : "add";
    source = settings.source || null;
    required = Boolean(settings.required);
    error = settings.error || "";
    initial = {name: source ? String(source.name || "") : "", url: source ? String(source.url || "") : ""};
    renderKey += 1;
    open = true;
    options.rootElement.classList.add("is-open");
    options.rootElement.setAttribute("aria-hidden", "false");
    render();
    setTimeout(() => (initial.name ? nameInput() : urlInput())?.focus(), 0);
  }

  function hide(): void {
    open = false;
    options.rootElement.classList.remove("is-open");
    options.rootElement.setAttribute("aria-hidden", "true");
    root.render(null);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  function showError(message: string): void {
    error = message || "";
    const errorElement = options.rootElement.querySelector<HTMLElement>("#source-form-error");
    if (errorElement) {
      errorElement.textContent = error;
      errorElement.hidden = !error;
    }
  }

  function handleKey(event: KeyboardEvent): boolean {
    if (!open) return false;
    const code = event.keyCode;
    if (code === 461 || code === 27) {
      event.preventDefault();
      cancel();
      return true;
    }
    if (code === 13) {
      if (event.target === nameInput() || event.target === urlInput()) return false;
      event.preventDefault();
      if (document.activeElement instanceof HTMLElement) document.activeElement.click();
      return true;
    }
    if (code !== 38 && code !== 40) return false;
    event.preventDefault();
    const controls = Array.from(options.rootElement.querySelectorAll<HTMLElement>("input, button:not([hidden])"));
    let index = controls.indexOf(document.activeElement as HTMLElement);
    if (index < 0) index = 0;
    index = Math.max(0, Math.min(controls.length - 1, index + (code === 38 ? -1 : 1)));
    controls[index]?.focus();
    return true;
  }

  return {show, hide, showError, isOpen: () => open, handleKey};
}

export const sourceFormApi = {create: createSourceForm};
