import type { GameFamily, PgModeId } from "@planetfall/shared";
import { bindingSettings, type BindingStorage } from "./binding-settings";
import type { BindingSettings } from "./input-bindings";
import { GUIDE_FAMILIES, getPlayerGuideSection, type GuideHint, type GuideSection } from "./player-guide-content";
export type { GuideHint, GuideSection } from "./player-guide-content";

export const PLAYER_GUIDE_STORAGE_KEY = "planetfall.player-guide.v1";
export interface GuideContext { family: GameFamily; phase: string; inputMethod?: string; submode?: PgModeId }
export interface GuideState {
  open: boolean;
  family: GameFamily;
  context: GuideContext;
  enabled: boolean;
  completed: Record<GameFamily, boolean>;
  guide: GuideSection;
  hint: GuideHint | null;
}
interface SavedGuide { version: 1; enabled: boolean; completed: Record<GameFamily, boolean>; dismissed: Record<GameFamily, string[]> }
interface GuideBindings { get(): BindingSettings; subscribe?(listener: (settings: BindingSettings) => void): () => void }
export interface PlayerGuideOptions { storage?: BindingStorage; bindings?: GuideBindings }
const fresh = (): SavedGuide => ({ version: 1, enabled: true,
  completed: Object.fromEntries(GUIDE_FAMILIES.map(f => [f, false])) as Record<GameFamily, boolean>,
  dismissed: Object.fromEntries(GUIDE_FAMILIES.map(f => [f, [] as string[]])) as Record<GameFamily, string[]> });
function browserStorage(): BindingStorage | undefined { try { return typeof localStorage === "undefined" ? undefined : localStorage; } catch { return undefined; } }
function read(storage: BindingStorage | undefined): SavedGuide {
  const result = fresh();
  try {
    const raw = storage?.getItem(PLAYER_GUIDE_STORAGE_KEY);
    if (!raw || raw.length > 8192) return result;
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object" || !("version" in saved) || saved.version !== 1) return result;
    const value = saved as Partial<SavedGuide>;
    result.enabled = typeof value.enabled === "boolean" ? value.enabled : true;
    for (const family of GUIDE_FAMILIES) {
      result.completed[family] = value.completed?.[family] === true;
      const ids = value.dismissed?.[family];
      result.dismissed[family] = Array.isArray(ids) ? [...new Set(ids.filter(id => ["first", "controls", "objective"].includes(id)))] : [];
    }
  } catch { /* Guest guidance remains usable when storage is unavailable or old. */ }
  return result;
}

/** Pure UI state. It never captures input, changes focus, requests pointer lock,
 * pauses a simulation or derives gameplay progress. Hint completion means read/skipped. */
export function createPlayerGuide(options: PlayerGuideOptions = {}) {
  const storage = options.storage ?? browserStorage(), bindings = options.bindings ?? bindingSettings;
  let saved = read(storage), context: GuideContext = { family: "planetfall", phase: "menu", inputMethod: "keyboard" };
  let family: GameFamily = context.family, open = false, disposed = false;
  const listeners = new Set<(state: GuideState) => void>();
  const persist = () => { try { storage?.setItem(PLAYER_GUIDE_STORAGE_KEY, JSON.stringify(saved)); } catch { /* In-session preferences still apply. */ } };
  const getState = (): GuideState => {
    const guide = getPlayerGuideSection(family, context.inputMethod, context.submode, bindings.get());
    const contextual = context.family === family ? guide : getPlayerGuideSection(context.family, context.inputMethod, context.submode, bindings.get());
    const safe = context.phase === "lobby" || context.phase === "countdown";
    const hint = !disposed && !open && saved.enabled && !saved.completed[context.family] && safe
      ? contextual.hints.find(h => !saved.dismissed[context.family].includes(h.id)) ?? null : null;
    return { open, family, context: { ...context }, enabled: saved.enabled, completed: { ...saved.completed }, guide, hint };
  };
  const emit = () => { if (!disposed) for (const listener of listeners) listener(getState()); };
  const unsubscribeBindings = bindings.subscribe?.(emit);
  return {
    getState,
    subscribe(listener: (state: GuideState) => void): () => void {
      if (disposed) return () => {};
      listeners.add(listener); listener(getState()); return () => { listeners.delete(listener); };
    },
    setContext(next: GuideContext): void {
      if (disposed) return;
      if (context.family === next.family && context.phase === next.phase && context.inputMethod === next.inputMethod && context.submode === next.submode) return;
      context = { ...next }; if (!open) family = next.family; emit();
    },
    open(nextFamily: GameFamily = context.family): void { if (disposed) return; family = nextFamily; open = true; emit(); },
    close(): void { if (disposed) return; open = false; family = context.family; emit(); },
    dismissHint(): void {
      if (disposed) return;
      const hint = getState().hint; if (!hint) return;
      const current = context.family;
      saved.dismissed[current].push(hint.id);
      saved.completed[current] = getPlayerGuideSection(current).hints.every(h => saved.dismissed[current].includes(h.id));
      persist(); emit();
    },
    skipFamily(nextFamily: GameFamily = context.family): void { if (disposed) return; saved.completed[nextFamily] = true; persist(); emit(); },
    setEnabled(enabled: boolean): void { if (disposed) return; saved.enabled = enabled; persist(); emit(); },
    reset(nextFamily?: GameFamily): void {
      if (disposed) return;
      if (nextFamily) { saved.completed[nextFamily] = false; saved.dismissed[nextFamily] = []; }
      else saved = fresh();
      persist(); emit();
    },
    dispose(): void { if (disposed) return; disposed = true; open = false; listeners.clear(); unsubscribeBindings?.(); },
  };
}
export type PlayerGuide = ReturnType<typeof createPlayerGuide>;
