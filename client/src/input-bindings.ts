import { isBindingToken, getBindingTokens, type BindingSettings, type BindingContext, type BindingAction, type BindingToken } from "@planetfall/shared";
export { BINDING_CONTEXTS, BINDING_ACTIONS, BINDING_STORAGE_KEY, BINDING_ACTION_LABELS, emptyBindingSettings, bindingActions, defaultBindingTokens, getBindingTokens, isBindingToken, bindingConflicts, setBinding, resetBinding, resetContextBindings, parseBindingSettings, serializeBindingSettings, type BindingSettings, type BindingContext, type BindingAction, type BindingToken, type BindingConflict, type BindingChange } from "@planetfall/shared";

export function bindingTokenLabel(token: BindingToken): string {
  const special: Record<string, string> = { Mouse0: "LMB", Mouse1: "MMB", Mouse2: "RMB", Mouse3: "MOUSE 4", Mouse4: "MOUSE 5", WheelUp: "WHEEL ↑", WheelDown: "WHEEL ↓", Space: "SPACE", Escape: "ESC", ControlLeft: "CTRL", ControlRight: "R CTRL", ShiftLeft: "SHIFT", ShiftRight: "R SHIFT", ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓" };
  return special[token] ?? token.replace(/^Key|^Digit/, "").toUpperCase();
}
export function bindingLabel(settings: BindingSettings, context: BindingContext, action: BindingAction): string {
  return getBindingTokens(settings, context, action).map(bindingTokenLabel).join(" / ") || "UNBOUND";
}
export interface BindingKeyboardEvent { code: string; target?: EventTarget | null; repeat?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean; isComposing?: boolean }
export interface BindingKeyboardPolicy {
  /** Set only while the caller actually owns pointer lock/gameplay capture. */
  capturedGameplay?: boolean;
  /** Ctrl chords are accepted only for currently bound gameplay tokens. */
  boundTokens?: readonly BindingToken[];
}
export function textInputOwnsBindings(target?: EventTarget | null): boolean {
  const element = target as { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => unknown } | null | undefined;
  return element?.isContentEditable === true || /^(INPUT|TEXTAREA|SELECT)$/.test(element?.tagName?.toUpperCase() ?? "") || !!element?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
}
/** Browser/OS chords stay native by default. Captured gameplay can own bound Ctrl
 * chords; callers must preventDefault for accepted events, including repeats.
 * Ctrl+Tab/Shift+Tab, Meta and Alt always stay browser/OS-owned. */
export function keyboardBindingToken(event: BindingKeyboardEvent, policy: BindingKeyboardPolicy = {}): BindingToken | null {
  if (textInputOwnsBindings(event.target) || event.isComposing) return null;
  if (/^Control(?:Left|Right)$/.test(event.code)) return event.code;
  if (event.altKey || event.metaKey || event.code === "Tab" && event.shiftKey || event.ctrlKey && (event.code === "Tab" || !policy.capturedGameplay || !policy.boundTokens?.includes(event.code))) return null;
  return isBindingToken(event.code) ? event.code : null;
}
export function mouseBindingToken(button: number): BindingToken | null { return Number.isInteger(button) && button >= 0 && button <= 4 ? `Mouse${button}` : null; }
export function wheelBindingToken(deltaY: number): BindingToken | null { return Number.isFinite(deltaY) && deltaY !== 0 ? deltaY < 0 ? "WheelUp" : "WheelDown" : null; }
