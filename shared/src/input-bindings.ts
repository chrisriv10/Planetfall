/** Canonical keyboard/mouse bindings. Contexts are mutually exclusive, fully resolved
 * gameplay states (not an inheritance tree). Menu navigation remains independent. */
export const BINDING_CONTEXTS = ["planetfall", "battle-royale", "planet-run", "planet-run:spectator", "planet-gun", "planet-gun:planetstrike", "planet-gun:planetwatch", "planet-gun:planetsiege", "planet-gun:planetzombies", "planet-gun:spectator"] as const;
export type BindingContext = typeof BINDING_CONTEXTS[number];
export const BINDING_ACTIONS = ["moveForward", "moveBackward", "moveLeft", "moveRight", "jump", "interact", "crouch", "sprint", "pause", "scoreboard", "emote", "switchWeapon", "repair", "fire", "aim", "reload", "inventory", "map", "ping", "slot1", "slot2", "slot3", "slot4", "slot5", "nextTarget", "previousTarget", "dive", "ability1", "ability2", "ultimate", "buyMenu", "drone", "camera", "reinforce", "leanLeft", "leanRight", "drop"] as const;
export type BindingAction = typeof BINDING_ACTIONS[number];
export type BindingToken = string;
type Defaults = Partial<Record<BindingAction, readonly BindingToken[]>>;
export interface BindingSettings { version: 1; overrides: Partial<Record<BindingContext, Partial<Record<BindingAction, BindingToken[] | null>>>> }
export const BINDING_STORAGE_KEY = "planetfall.controls.v1";
export const BINDING_ACTION_LABELS: Record<BindingAction, string> = {
  moveForward: "Move forward", moveBackward: "Move backward", moveLeft: "Move left", moveRight: "Move right", jump: "Jump", interact: "Interact / use", crouch: "Crouch / slide", sprint: "Sprint / burst", pause: "Pause", scoreboard: "Scoreboard", emote: "Emote", switchWeapon: "Switch weapon", repair: "Repair", fire: "Fire", aim: "Aim / ADS", reload: "Reload", inventory: "Inventory", map: "Map", ping: "Ping", slot1: "Weapon / item 1", slot2: "Weapon / item 2", slot3: "Item 3", slot4: "Item 4", slot5: "Item 5", nextTarget: "Next weapon / target", previousTarget: "Previous weapon / target", dive: "Dive", ability1: "Ability / gadget 1", ability2: "Ability / gadget 2", ultimate: "Ultimate / ability 3", buyMenu: "Buy / mode menu", drone: "Drone control", camera: "Security camera", reinforce: "Reinforce panel", leanLeft: "Lean left", leanRight: "Lean right", drop: "Drop charge / weapon"
};
const movement: Defaults = { moveForward: ["KeyW"], moveBackward: ["KeyS"], moveLeft: ["KeyA"], moveRight: ["KeyD"], jump: ["Space"] };
const common: Defaults = { ...movement, interact: ["KeyE"], crouch: ["ControlLeft", "ControlRight"], sprint: ["ShiftLeft", "ShiftRight"], pause: ["Escape"], scoreboard: ["Tab"] };
const classic: Defaults = { ...common, switchWeapon: ["KeyQ"], repair: ["KeyR"], emote: ["KeyV"], fire: ["Mouse0"], aim: ["Mouse2"], ping: ["Mouse1"], inventory: ["KeyI"], map: ["KeyM"], nextTarget: ["WheelDown", "ArrowRight"], previousTarget: ["WheelUp", "ArrowLeft"], slot1: ["Digit1"], slot2: ["Digit2"], slot3: ["Digit3"], slot4: ["Digit4"], slot5: ["Digit5"] };
const royale: Defaults = { ...classic, repair: undefined, reload: ["KeyR"] };
const run: Defaults = { ...movement, pause: ["Escape"], scoreboard: ["Tab"], emote: ["KeyV"], dive: ["ShiftLeft", "ShiftRight"] };
const gun: Defaults = { ...common, crouch: ["ControlLeft", "ControlRight", "KeyC"], fire: ["Mouse0"], aim: ["Mouse2"], reload: ["KeyR"], switchWeapon: [], slot1: ["Digit1"], slot2: ["Digit2"] };
const gunMode: Defaults = { ...gun, ability1: ["KeyQ"], ability2: ["KeyF"], ultimate: ["KeyG"], buyMenu: ["KeyB"] };
const defaults: Record<BindingContext, Defaults> = {
  planetfall: classic,
  "battle-royale": royale,
  "planet-run": run,
  "planet-run:spectator": { pause: ["Escape"], scoreboard: ["Tab"], previousTarget: ["KeyQ"], nextTarget: ["KeyE"] },
  "planet-gun": gun,
  "planet-gun:planetstrike": { ...gunMode, drop: ["KeyX"], reinforce: ["KeyT"] },
  "planet-gun:planetwatch": { ...gunMode, reinforce: ["KeyT"] },
  "planet-gun:planetsiege": { ...gunMode, crouch: ["ControlLeft", "ControlRight"], drone: ["KeyV"], camera: ["KeyX"], reinforce: ["KeyT"], leanLeft: ["KeyZ"], leanRight: ["KeyC"] },
  "planet-gun:planetzombies": { ...gunMode, reinforce: ["KeyT"] },
  "planet-gun:spectator": { pause: ["Escape"], scoreboard: ["Tab"], buyMenu: ["KeyB"], previousTarget: ["ArrowLeft"], nextTarget: ["ArrowRight"] }
};

export function emptyBindingSettings(): BindingSettings { return { version: 1, overrides: {} }; }
export function bindingActions(context: BindingContext): BindingAction[] { return BINDING_ACTIONS.filter(action => defaults[context][action] !== undefined); }
export function defaultBindingTokens(context: BindingContext, action: BindingAction): readonly BindingToken[] { return defaults[context][action] ?? []; }
export function getBindingTokens(settings: BindingSettings, context: BindingContext, action: BindingAction): readonly BindingToken[] {
  const entry = settings.overrides[context]?.[action];
  return entry === undefined ? defaultBindingTokens(context, action) : entry ?? [];
}
/** Physical KeyboardEvent.code strings, five mouse buttons, and vertical wheel pulses. */
export function isBindingToken(value: unknown): value is BindingToken {
  return typeof value === "string" && !/^(?:F1|F3|F5|F6|F7|F10|F11|F12)$/.test(value) && /^(?:Key[A-Z]|Digit[0-9]|Numpad[0-9]|F(?:[1-9]|1[0-2])|Space|Tab|Escape|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Arrow(?:Up|Down|Left|Right)|Shift(?:Left|Right)|Control(?:Left|Right)|CapsLock|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Numpad(?:Add|Subtract|Multiply|Divide|Decimal)|Mouse[0-4]|Wheel(?:Up|Down))$/.test(value);
}
export interface BindingConflict { action: BindingAction; token: BindingToken }
export function bindingConflicts(settings: BindingSettings, context: BindingContext, action: BindingAction, tokens: readonly BindingToken[]): BindingConflict[] {
  return bindingActions(context).filter(other => other !== action).flatMap(other => getBindingTokens(settings, context, other).filter(token => tokens.includes(token)).map(token => ({ action: other, token })));
}
export type BindingChange = { ok: true; settings: BindingSettings } | { ok: false; reason: "invalid" | "conflict"; conflicts: BindingConflict[] };
/** Immutable contextual edit; null explicitly unbinds, undefined restores defaults. */
export function setBinding(settings: BindingSettings, context: BindingContext, action: BindingAction, tokens: readonly BindingToken[] | null | undefined): BindingChange {
  if (!BINDING_CONTEXTS.includes(context) || !bindingActions(context).includes(action) || (tokens !== null && tokens !== undefined && (!Array.isArray(tokens) || tokens.length > 3 || tokens.length === 0 || !tokens.every(isBindingToken) || new Set(tokens).size !== tokens.length || tokens.includes("Escape") && action !== "pause"))) return { ok: false, reason: "invalid", conflicts: [] };
  const conflicts = bindingConflicts(settings, context, action, tokens === undefined ? defaultBindingTokens(context, action) : tokens ?? []);
  if (conflicts.length) return { ok: false, reason: "conflict", conflicts };
  const row = { ...settings.overrides[context] };
  if (tokens === undefined) delete row[action]; else row[action] = tokens === null ? null : [...tokens];
  const overrides = { ...settings.overrides };
  if (Object.keys(row).length) overrides[context] = row; else delete overrides[context];
  return { ok: true, settings: { version: 1, overrides } };
}
export function resetBinding(settings: BindingSettings, context: BindingContext, action: BindingAction): BindingChange { return setBinding(settings, context, action, undefined); }
export function resetContextBindings(settings: BindingSettings, context: BindingContext): BindingSettings {
  const overrides = { ...settings.overrides }; delete overrides[context]; return { version: 1, overrides };
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
/** Invalid, oversized, unknown-version or conflicting documents fall back atomically. */
export function parseBindingSettings(value: unknown): BindingSettings {
  try {
    if (typeof value === "string") { if (value.length > 32_768) return emptyBindingSettings(); value = JSON.parse(value); }
    if (!record(value) || value.version !== 1 || Object.keys(value).some(key => key !== "version" && key !== "overrides") || !record(value.overrides) || Object.keys(value.overrides).length > BINDING_CONTEXTS.length) return emptyBindingSettings();
    const result = emptyBindingSettings();
    for (const [contextText, entries] of Object.entries(value.overrides)) {
      if (!BINDING_CONTEXTS.includes(contextText as BindingContext) || !record(entries) || Object.keys(entries).length > BINDING_ACTIONS.length) return emptyBindingSettings();
      const context = contextText as BindingContext;
      for (const [actionText, tokens] of Object.entries(entries)) {
        const action = actionText as BindingAction;
        if (!bindingActions(context).includes(action) || (tokens !== null && (!Array.isArray(tokens) || !tokens.length || tokens.length > 3 || !tokens.every(isBindingToken) || new Set(tokens).size !== tokens.length || tokens.includes("Escape") && action !== "pause"))) return emptyBindingSettings();
        (result.overrides[context] ??= {})[action] = tokens === null ? null : [...tokens as string[]];
      }
      // Validate the completed row, so a legitimate swap does not depend on JSON order.
      if (bindingActions(context).some(action => bindingConflicts(result, context, action, getBindingTokens(result, context, action)).length)) return emptyBindingSettings();
    }
    return result;
  } catch { return emptyBindingSettings(); }
}
export function serializeBindingSettings(settings: BindingSettings): string { return JSON.stringify(parseBindingSettings(settings)); }
