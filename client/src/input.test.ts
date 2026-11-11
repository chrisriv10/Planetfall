import { describe, expect, it, vi } from "vitest";
import { GameInput, EdgeTracker, curveStick, inputLabel, nativeControlOwnsKeyboardCode, radialDeadzone, responseCurve } from "./input";
import { BindingSettingsStore } from "./binding-settings";

function bindingHarness(run: (h: { input: GameInput; store: BindingSettingsStore; key: (code: string, extra?: Record<string, unknown>) => any; up: (code: string) => void; emit: (name: string, event?: any) => void; mouse: (name: string, event: any) => void; lock: (locked: boolean) => void }) => void): void {
  const handlers = new Map<string, (event: any) => void>(), canvasHandlers = new Map<string, (event: any) => void>();
  const canvas = { addEventListener: (name: string, handler: (event: any) => void) => canvasHandlers.set(name, handler) } as unknown as HTMLCanvasElement;
  const doc = { pointerLockElement: canvas as HTMLCanvasElement | null, addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler) };
  vi.stubGlobal("addEventListener", (name: string, handler: (event: any) => void) => handlers.set(name, handler));
  vi.stubGlobal("document", doc); vi.stubGlobal("navigator", { getGamepads: () => [] });
  const store = new BindingSettingsStore({ getItem: () => null, setItem: () => {} }), input = new GameInput(canvas, store);
  try {
    run({ input, store, key(code, extra = {}) { const event = { code, target: null, repeat: false, defaultPrevented: false, preventDefault: vi.fn(), ...extra }; handlers.get("keydown")!(event); return event; }, up(code) { handlers.get("keyup")!({ code }); }, emit(name, event = {}) { handlers.get(name)!(event); }, mouse(name, event) { canvasHandlers.get(name)!({ preventDefault: vi.fn(), ...event }); }, lock(locked) { doc.pointerLockElement = locked ? canvas : null; handlers.get("pointerlockchange")!({}); } });
  } finally { vi.unstubAllGlobals(); }
}

describe("GameInput canonical bindings", () => {
  it("uses live shared movement/action/slot overrides and releases the original held action", () => bindingHarness(({ input, store, key, up }) => {
    store.rebind("planetfall", "moveForward", ["KeyJ"]); store.rebind("planetfall", "slot3", ["KeyK"]);
    key("KeyW"); expect(input.sample().moveY).toBe(0); key("KeyJ"); expect(input.sample().moveY).toBe(1);
    key("KeyK"); expect(input.sample().directSlot).toBe(2);
    key("Space"); expect(input.sample().jump.held).toBe(true); store.rebind("planetfall", "jump", ["KeyL"]);
    up("Space"); expect(input.sample().jump.released).toBe(true); key("KeyL"); expect(input.sample().jump.pressed).toBe(true);
  }));
  it("maps Royale reload/aim and allows remapped mouse/wheel actions", () => bindingHarness(({ input, store, key, mouse, emit }) => {
    input.setBindingContext("battle-royale"); key("KeyR"); expect(input.sample().repair.pressed).toBe(true);
    store.rebind("battle-royale", "fire", ["Mouse4"]); mouse("mousedown", { button: 0 }); expect(input.sample().fire.held).toBe(false);
    mouse("mousedown", { button: 4 }); expect(input.sample().fire.pressed).toBe(true); emit("mouseup", { button: 4 }); expect(input.sample().fire.released).toBe(true);
    mouse("mousedown", { button: 2 }); expect(input.sample().grapple.held).toBe(true);
    mouse("wheel", { deltaY: -1 }); expect(input.sample().previousTarget.pressed).toBe(true);
    expect(input.sample().previousTarget.released).toBe(true);
  }));
  it("preserves menu Escape/arrows/Enter independently from blocked/rebound gameplay", () => bindingHarness(({ input, store, key, up }) => {
    store.rebind("planetfall", "pause", ["KeyP"]); input.setGameplayBlocked(true);
    key("Space"); expect(input.sample().jump.held).toBe(false); key("Escape"); expect(input.sample().cancel.pressed).toBe(true); up("Escape"); input.sample();
    key("ArrowDown"); expect(input.sample().menuY).toBe(1); key("Enter"); expect(input.sample().confirm.pressed).toBe(true);
    input.setGameplayBlocked(false); key("KeyP"); expect(input.sample().cancel.pressed).toBe(true);
  }));
  it("clears holds/look on capture, blur and text focus changes", () => bindingHarness(({ input, key, emit, lock }) => {
    key("KeyW"); expect(input.sample().moveY).toBe(1); lock(false); expect(input.sample().moveY).toBe(0);
    key("KeyW"); emit("blur"); expect(input.sample().moveY).toBe(0);
    key("KeyW"); emit("focusin", { target: { tagName: "INPUT" } }); expect(input.sample().moveY).toBe(0);
    key("Space"); emit("compositionstart"); expect(input.sample().jump.pressed).toBe(false);
  }));
  it("protects UI/browser inputs and owns captured Ctrl movement/reload synchronously", () => bindingHarness(({ input, key, lock }) => {
    input.setBindingContext("battle-royale"); key("ControlLeft", { ctrlKey: true });
    const move = key("KeyW", { ctrlKey: true }); expect(move.preventDefault).toHaveBeenCalled(); expect(input.sample().moveY).toBe(1);
    const reload = key("KeyR", { ctrlKey: true }); expect(reload.preventDefault).toHaveBeenCalled(); expect(input.sample().repair.pressed).toBe(true);
    const repeated = key("KeyW", { ctrlKey: true, repeat: true }); expect(repeated.preventDefault).toHaveBeenCalled();
    lock(false); const unlocked = key("KeyW", { ctrlKey: true }); expect(unlocked.preventDefault).not.toHaveBeenCalled(); expect(input.sample().moveY).toBe(0);
    for (const extra of [{ target: { tagName: "INPUT" } }, { target: { isContentEditable: true } }, { isComposing: true }, { metaKey: true }, { altKey: true }, { defaultPrevented: true }]) { key("Space", extra); expect(input.sample().jump.pressed).toBe(false); }
    const tab = key("Tab", { ctrlKey: true }); expect(tab.preventDefault).not.toHaveBeenCalled(); expect(input.sample().leaderboard.pressed).toBe(false);
  }));
  it("updates keyboard prompts from contextual shared settings", () => bindingHarness(({ store }) => {
    store.rebind("planetfall", "emote", ["KeyJ"]);
    expect(inputLabel("emote", "keyboard", "planetfall", store.get())).toBe("J");
    expect(inputLabel("emote", "gamepad", "planetfall", store.get())).toBe("D↑");
  }));
});

describe("controller input math", () => {
  it("consumes a UI-owned cancel through key release without losing the next press", () => {
    const handlers = new Map<string, (event: any) => void>();
    vi.stubGlobal("addEventListener", (name: string, handler: (event: any) => void) => handlers.set(name, handler));
    vi.stubGlobal("navigator", { getGamepads: () => [] });
    try {
      const input = new GameInput(new EventTarget() as HTMLCanvasElement);
      const key = { code: "Escape", repeat: false, target: null, preventDefault() {} };
      handlers.get("keydown")!(key);
      input.consumeKeyboardAction("cancel");
      expect(input.sample().cancel).toEqual({ held: false, pressed: false, released: false });
      expect(input.sample().cancel.pressed).toBe(false);
      handlers.get("keyup")!(key);
      expect(input.sample().cancel.released).toBe(false);
      handlers.get("keydown")!(key);
      expect(input.sample().cancel).toEqual({ held: true, pressed: true, released: false });
      handlers.get("keyup")!(key);
      expect(input.sample().cancel.released).toBe(true);
      // A quick down/up before the next frame is consumed too.
      handlers.get("keydown")!(key);
      input.consumeKeyboardAction("cancel");
      handlers.get("keyup")!(key);
      expect(input.sample().cancel.pressed).toBe(false);
      handlers.get("keydown")!(key);
      input.consumeKeyboardAction("cancel");
      handlers.get("keyup")!(key);
      handlers.get("keydown")!(key);
      expect(input.sample().cancel.pressed).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });
  it("applies a radial deadzone and rescales the remaining range", () => {
    expect(radialDeadzone(.08, .08, .14)).toEqual({ x: 0, y: 0, magnitude: 0 });
    const result = radialDeadzone(.5, 0, .14);
    expect(result.x).toBeCloseTo((.5 - .14) / .86);
    expect(result.y).toBe(0);
  });

  it("preserves direction and full-stick magnitude", () => {
    const result = radialDeadzone(.6, .8, .14);
    expect(result.magnitude).toBeCloseTo(1);
    expect(result.x).toBeCloseTo(.6);
    expect(result.y).toBeCloseTo(.8);
  });

  it("curves small look input without reducing maximum turn", () => {
    expect(responseCurve(.35)).toBeLessThan(.35);
    expect(responseCurve(-1)).toBe(-1);
    const diagonal = curveStick(.4, .4);
    expect(diagonal.x / diagonal.y).toBeCloseTo(1);
  });

  it("distinguishes pressed, held, and released edges", () => {
    const tracker = new EdgeTracker<"jump">();
    expect(tracker.update(["jump"]).pressed.has("jump")).toBe(true);
    expect(tracker.update(["jump"]).pressed.has("jump")).toBe(false);
    expect(tracker.update([]).released.has("jump")).toBe(true);
  });

  it("uses input-aware emote prompts", () => {
    expect(inputLabel("emote", "keyboard")).toBe("V");
    expect(inputLabel("emote", "gamepad")).toBe("D↑");
  });

  it("lets native controls own Enter without leaking a second game confirm", () => {
    expect(nativeControlOwnsKeyboardCode("Enter", { tagName: "BUTTON" } as unknown as EventTarget)).toBe(true);
    expect(nativeControlOwnsKeyboardCode("Enter", { tagName: "input" } as unknown as EventTarget)).toBe(true);
    expect(nativeControlOwnsKeyboardCode("Enter", { isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(nativeControlOwnsKeyboardCode("Enter", { tagName: "CANVAS" } as unknown as EventTarget)).toBe(false);
    expect(nativeControlOwnsKeyboardCode("Space", { tagName: "BUTTON" } as unknown as EventTarget)).toBe(false);
  });
});
