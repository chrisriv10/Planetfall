import { BINDING_STORAGE_KEY, emptyBindingSettings, parseBindingSettings, resetContextBindings, serializeBindingSettings, setBinding, type BindingAction, type BindingChange, type BindingContext, type BindingSettings, type BindingToken } from "./input-bindings";

export interface BindingStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
function browserStorage(): BindingStorage | undefined { try { return typeof localStorage === "undefined" ? undefined : localStorage; } catch { return undefined; } }
/** One local control profile shared by every family. Storage failures do not prevent
 * in-session edits. Subscribers receive independent snapshots, including defaults. */
export class BindingSettingsStore {
  private settings: BindingSettings;
  private listeners = new Set<(settings: BindingSettings) => void>();
  constructor(private storage: BindingStorage | undefined = browserStorage()) {
    try { this.settings = parseBindingSettings(storage?.getItem(BINDING_STORAGE_KEY)); } catch { this.settings = emptyBindingSettings(); }
  }
  useStorage(storage:BindingStorage):void {this.storage=storage;this.reload();}
  reload():void {
    try { this.settings=parseBindingSettings(this.storage?.getItem(BINDING_STORAGE_KEY)); } catch { this.settings=emptyBindingSettings(); }
    for(const listener of this.listeners)listener(this.get());
  }
  get(): BindingSettings { return parseBindingSettings(this.settings); }
  subscribe(listener: (settings: BindingSettings) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  set(settings: BindingSettings): void {
    this.settings = parseBindingSettings(settings);
    try { this.storage?.setItem(BINDING_STORAGE_KEY, serializeBindingSettings(this.settings)); } catch { /* Keep the active session usable when storage is full/disabled. */ }
    for (const listener of this.listeners) listener(this.get());
  }
  rebind(context: BindingContext, action: BindingAction, tokens: readonly BindingToken[] | null | undefined): BindingChange {
    const result = setBinding(this.settings, context, action, tokens);
    if (result.ok) this.set(result.settings);
    return result;
  }
  resetAll(): void { this.set(emptyBindingSettings()); }
  resetContext(context: BindingContext): void { this.set(resetContextBindings(this.settings, context)); }
}
export const bindingSettings = new BindingSettingsStore();
