import type {
  ButtonHTMLAttributes,
  ComponentType,
  HTMLAttributes,
  InputHTMLAttributes
} from "react";
import {createRoot, type Root} from "react-dom/client";
import {flushSync} from "react-dom";
import Spotlight from "@enact/spotlight";
import SpotlightRootDecorator from "@enact/spotlight/SpotlightRootDecorator";
import Spottable, {type SpottableProps} from "@enact/spotlight/Spottable";
import SpotlightContainerDecorator, {
  type SpotlightContainerDecoratorProps
} from "@enact/spotlight/SpotlightContainerDecorator";

type SpotlightButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & SpottableProps;
type SpotlightInputProps = InputHTMLAttributes<HTMLInputElement> & SpottableProps;
type SpotlightContainerProps = HTMLAttributes<HTMLDivElement> & SpotlightContainerDecoratorProps;

export const SpotlightButton = Spottable({emulateMouse: true}, "button") as ComponentType<SpotlightButtonProps>;
export const SpotlightInput = Spottable({emulateMouse: false}, "input") as ComponentType<SpotlightInputProps>;

export const BrowserSpotlightContainer = SpotlightContainerDecorator({
  enterTo: "last-focused",
  leaveFor: {left: "", right: ""},
  preserveId: true,
  restrict: "self-only"
}, "div") as ComponentType<SpotlightContainerProps>;

export const FormSpotlightContainer = SpotlightContainerDecorator({
  enterTo: "last-focused",
  preserveId: true,
  restrict: "self-only"
}, "div") as ComponentType<SpotlightContainerProps>;

function SpotlightRuntimeView() {
  return null;
}

const SpotlightRuntime = SpotlightRootDecorator({noAutoFocus: true}, SpotlightRuntimeView);
let runtimeRoot: Root | null = null;

export function initializeSpotlight(): void {
  if (runtimeRoot) return;
  const host = document.createElement("div");
  host.id = "spotlight-runtime";
  host.hidden = true;
  document.body.appendChild(host);
  runtimeRoot = createRoot(host);
  flushSync(() => runtimeRoot?.render(<SpotlightRuntime />));
}

export function focusWithSpotlight(element: HTMLElement | null): boolean {
  if (!element || document.activeElement === element) return Boolean(element);
  const focus = Spotlight.focus as unknown as (target: HTMLElement) => boolean;
  return focus(element);
}

export function isSpotlightPointerMode(): boolean {
  return Spotlight.getPointerMode();
}

export function isSpottableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(".spottable"));
}

export const spotlightApi = {focus: focusWithSpotlight, isPointerMode: isSpotlightPointerMode, isSpottableTarget};
