import { bindingActions, emptyBindingSettings, getBindingTokens, keyboardBindingToken, mouseBindingToken, wheelBindingToken, type BindingAction, type BindingContext, type BindingKeyboardEvent, type BindingKeyboardPolicy, type BindingSettings, type BindingToken } from "./input-bindings";

export interface BindingFrame { held: Set<BindingAction>; pressed: Set<BindingAction>; released: Set<BindingAction> }
/** Explicit event adapter; caller owns DOM listeners, capture/UI policy, and lifecycle.
 * Each physical down records its actions. Rebinding never changes an existing hold. */
export class BindingState {
  private down = new Map<BindingToken, BindingAction[]>();
  private pressed = new Set<BindingAction>();
  private released = new Set<BindingAction>();
  private pulses = new Set<BindingAction>();
  private lastPulses = new Set<BindingAction>();
  private blocked = false;
  constructor(private context: BindingContext, private settings: BindingSettings = emptyBindingSettings()) {}
  getContext(): BindingContext { return this.context; }
  setSettings(settings: BindingSettings): void { this.settings = settings; }
  setContext(context: BindingContext): void { if (context !== this.context) { this.clear(); this.context = context; } }
  setBlocked(blocked: boolean): void { if (blocked !== this.blocked) { this.clear(); this.blocked = blocked; } }
  private actions(token: BindingToken): BindingAction[] { return bindingActions(this.context).filter(action => getBindingTokens(this.settings, this.context, action).includes(token)); }
  held(action: BindingAction): boolean { return [...this.down.values()].some(actions => actions.includes(action)); }
  tokenDown(token: BindingToken): readonly BindingAction[] {
    if (this.blocked || this.down.has(token)) return [];
    const actions = this.actions(token);
    for (const action of actions) if (!this.held(action)) this.pressed.add(action);
    this.down.set(token, actions);
    return actions;
  }
  tokenUp(token: BindingToken): readonly BindingAction[] {
    const actions = this.down.get(token) ?? [];
    this.down.delete(token);
    for (const action of actions) if (!this.held(action)) this.released.add(action);
    return actions;
  }
  private keyboardToken(event: BindingKeyboardEvent, policy: Pick<BindingKeyboardPolicy, "capturedGameplay">): BindingToken | null {
    return keyboardBindingToken(event, { ...policy, boundTokens: bindingActions(this.context).flatMap(action => [...getBindingTokens(this.settings, this.context, action)]) });
  }
  /** Caller uses this to preventDefault synchronously, including auto-repeats.
   * This never cancels an event itself and is false for blocked/modal gameplay. */
  ownsKeyboardEvent(event: BindingKeyboardEvent, policy: Pick<BindingKeyboardPolicy, "capturedGameplay"> = {}): boolean {
    const token = this.keyboardToken(event, policy);
    return !this.blocked && token !== null && this.actions(token).length > 0;
  }
  keyDown(event: BindingKeyboardEvent, policy: Pick<BindingKeyboardPolicy, "capturedGameplay"> = {}): readonly BindingAction[] {
    const token = this.keyboardToken(event, policy);
    if (!token || event.repeat) return [];
    // A genuine new press repairs a release lost while the window was unfocused.
    if (this.down.get(token)?.length === 0) this.down.delete(token);
    return this.tokenDown(token);
  }
  // Release uses physical code even if focus/modifier state changed since keydown.
  keyUp(event: Pick<BindingKeyboardEvent, "code">): readonly BindingAction[] { return this.tokenUp(event.code); }
  mouseDown(button: number): readonly BindingAction[] {
    const token = mouseBindingToken(button);
    if (!token) return [];
    if (this.down.get(token)?.length === 0) this.down.delete(token);
    return this.tokenDown(token);
  }
  mouseUp(button: number): readonly BindingAction[] { const token = mouseBindingToken(button); return token ? this.tokenUp(token) : []; }
  wheel(deltaY: number): readonly BindingAction[] {
    const token = wheelBindingToken(deltaY);
    if (!token || this.blocked) return [];
    const actions = this.actions(token);
    for (const action of actions) { this.pulses.add(action); this.pressed.add(action); }
    return actions;
  }
  /** Synchronous UI ownership suppresses this action until all physical releases. */
  consume(action: BindingAction): void {
    for (const [token, actions] of this.down) this.down.set(token, actions.filter(entry => entry !== action));
    this.pressed.delete(action); this.released.delete(action); this.pulses.delete(action); this.lastPulses.delete(action);
  }
  /** Call on blur, modal open/close, capture change, disconnect, and deactivation.
   * Retain physical tokens as empty records until up, preventing stale repeats. */
  clear(): void {
    for (const [token, actions] of this.down) { for (const action of actions) this.released.add(action); this.down.set(token, []); }
    for (const action of [...this.pulses, ...this.lastPulses]) this.released.add(action);
    this.pressed.clear(); this.pulses.clear(); this.lastPulses.clear();
  }
  sample(): BindingFrame {
    const held = new Set([...this.down.values()].flat());
    for (const action of this.pulses) held.add(action);
    const released = new Set([...this.released, ...this.lastPulses].filter(action => !held.has(action)));
    const frame = { held, pressed: new Set(this.pressed), released };
    this.lastPulses = this.pulses; this.pulses = new Set(); this.pressed.clear(); this.released.clear();
    return frame;
  }
}
