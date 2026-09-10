export type InputMethod = "keyboard" | "gamepad";
export type InputAction = "jump" | "burst" | "crouch" | "interact" | "switchWeapon" | "repair" | "fire" | "grapple" | "emote" | "leaderboard" | "map" | "ping" | "cancel" | "nextTarget" | "previousTarget" | "pause" | "confirm";

export type ButtonState = { held: boolean; pressed: boolean; released: boolean };

export interface InputFrame {
  method: InputMethod;
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  jump: ButtonState;
  burst: ButtonState;
  crouch: ButtonState;
  interact: ButtonState;
  switchWeapon: ButtonState;
  repair: ButtonState;
  fire: ButtonState;
  grapple: ButtonState;
  emote: ButtonState;
  leaderboard: ButtonState;
  map: ButtonState;
  ping: ButtonState;
  cancel: ButtonState;
  nextTarget: ButtonState;
  previousTarget: ButtonState;
  pause: ButtonState;
  confirm: ButtonState;
  menuX: -1 | 0 | 1;
  menuY: -1 | 0 | 1;
  directSlot: number | null;
}

export function radialDeadzone(x: number, y: number, deadzone: number): { x: number; y: number; magnitude: number } {
  const magnitude = Math.min(1, Math.hypot(x, y));
  if (magnitude <= deadzone) return { x: 0, y: 0, magnitude: 0 };
  const scaled = (magnitude - deadzone) / (1 - deadzone);
  return { x: x / magnitude * scaled, y: y / magnitude * scaled, magnitude: scaled };
}

export function responseCurve(value: number, exponent = 1.55): number {
  return Math.sign(value) * Math.pow(Math.abs(value), exponent);
}

export function curveStick(x: number, y: number, exponent = 1.55): { x: number; y: number } {
  const magnitude = Math.hypot(x, y);
  if (magnitude === 0) return { x: 0, y: 0 };
  const curvedMagnitude = Math.pow(Math.min(1, magnitude), exponent);
  return { x: x / magnitude * curvedMagnitude, y: y / magnitude * curvedMagnitude };
}

export class EdgeTracker<T extends string> {
  private previous = new Set<T>();

  update(active: Iterable<T>): { held: Set<T>; pressed: Set<T>; released: Set<T> } {
    const held = new Set(active);
    const pressed = new Set([...held].filter((action) => !this.previous.has(action)));
    const released = new Set([...this.previous].filter((action) => !held.has(action)));
    this.previous = held;
    return { held, pressed, released };
  }
}

const keyboardMap: Record<string, InputAction> = {
  Space: "jump",
  ShiftLeft: "burst",
  ShiftRight: "burst",
  ControlLeft: "crouch",
  ControlRight: "crouch",
  KeyE: "interact",
  KeyQ: "switchWeapon",
  KeyR: "repair",
  KeyV: "emote",
  KeyM: "map",
  Tab: "leaderboard",
  Escape: "cancel",
  ArrowRight: "nextTarget",
  ArrowLeft: "previousTarget",
  Enter: "confirm"
};

const gamepadButtonMap: Partial<Record<number, InputAction>> = {
  0: "jump",
  1: "burst",
  2: "interact",
  3: "switchWeapon",
  4: "previousTarget",
  5: "repair",
  6: "grapple",
  7: "fire",
  8: "leaderboard",
  9: "pause",
  10: "burst",
  11: "crouch"
};

const emptyButton = (): ButtonState => ({ held: false, pressed: false, released: false });

export class GameInput {
  method: InputMethod = "keyboard";
  onMethodChange?: (method: InputMethod) => void;
  private keys = new Set<string>();
  private mouseButtons = new Set<number>();
  private wheelDirection: -1 | 0 | 1 = 0;
  private mouseLookX = 0;
  private mouseLookY = 0;
  private keyboardEdges = new EdgeTracker<InputAction>();
  private gamepadEdges = new EdgeTracker<InputAction>();
  private pendingPressed = new Set<InputAction>();
  private pendingReleased = new Set<InputAction>();
  private lastMethodChange = 0;
  private previousMenuX = 0;
  private previousMenuY = 0;
  private triggerFireHeld = false;
  private triggerGrappleHeld = false;
  private pendingDirectSlot: number | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    addEventListener("keydown", (event) => {
      this.keys.add(event.code);
      const action = keyboardMap[event.code];
      if (!event.repeat && action) this.pendingPressed.add(action);
      if (!event.repeat && /^Digit[1-5]$/.test(event.code)) this.pendingDirectSlot = Number(event.code.slice(-1)) - 1;
      if (!event.repeat) this.markMethod("keyboard");
      if (event.code === "Space") event.preventDefault();
    });
    addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
      const action = keyboardMap[event.code];
      if (action) this.pendingReleased.add(action);
    });
    addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== this.canvas) {
        if (Math.abs(event.movementX) + Math.abs(event.movementY) > 4) this.markMethod("keyboard");
        return;
      }
      this.mouseLookX += event.movementX;
      this.mouseLookY += event.movementY;
      if (Math.abs(event.movementX) + Math.abs(event.movementY) > 2) this.markMethod("keyboard");
    });
    this.canvas.addEventListener("mousedown", (event) => {
      if (document.pointerLockElement === this.canvas) {
        this.mouseButtons.add(event.button);
        if (event.button === 0) this.pendingPressed.add("fire");
        if (event.button === 2) this.pendingPressed.add("grapple");
        if (event.button === 1) this.pendingPressed.add("ping");
      }
      this.markMethod("keyboard");
    });
    addEventListener("mouseup", (event) => {
      this.mouseButtons.delete(event.button);
      if (event.button === 0) this.pendingReleased.add("fire");
      if (event.button === 2) this.pendingReleased.add("grapple");
      if (event.button === 1) this.pendingReleased.add("ping");
    });
    this.canvas.addEventListener("wheel", (event) => {
      this.wheelDirection = event.deltaY >= 0 ? 1 : -1;
      this.pendingPressed.add(this.wheelDirection > 0 ? "nextTarget" : "previousTarget");
      this.markMethod("keyboard");
    }, { passive: true });
    addEventListener("gamepaddisconnected", () => {
      this.triggerFireHeld = false;
      this.triggerGrappleHeld = false;
      if (this.method === "gamepad") this.markMethod("keyboard", true);
    });
  }

  sample(): InputFrame {
    const keyboardActive = new Set<InputAction>();
    for (const code of this.keys) {
      const action = keyboardMap[code];
      if (action) keyboardActive.add(action);
    }
    if (this.mouseButtons.has(0)) keyboardActive.add("fire");
    if (this.mouseButtons.has(2)) keyboardActive.add("grapple");
    if (this.mouseButtons.has(1)) keyboardActive.add("ping");
    if (this.wheelDirection > 0) keyboardActive.add("nextTarget");
    if (this.wheelDirection < 0) keyboardActive.add("previousTarget");
    const keyboard = this.keyboardEdges.update(keyboardActive);

    const gamepad = this.pollGamepad();
    const padEdges = this.gamepadEdges.update(gamepad.actions);
    const held = new Set<InputAction>([...keyboard.held, ...padEdges.held]);
    const pressed = new Set<InputAction>([...keyboard.pressed, ...padEdges.pressed, ...this.pendingPressed]);
    const released = new Set<InputAction>([...keyboard.released, ...padEdges.released, ...this.pendingReleased].filter((action) => !held.has(action)));
    if (this.wheelDirection !== 0) {
      const action = this.wheelDirection > 0 ? "nextTarget" : "previousTarget";
      pressed.add(action);
      held.add(action);
    }

    const keyboardMoveX = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    const keyboardMoveY = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    const usePadMove = this.method === "gamepad" && gamepad.move.magnitude > 0;
    const button = (action: InputAction): ButtonState => ({ held: held.has(action), pressed: pressed.has(action), released: released.has(action) });
    const menuXRaw = gamepad.menuX || Number(this.keys.has("ArrowRight")) - Number(this.keys.has("ArrowLeft"));
    const menuYRaw = gamepad.menuY || Number(this.keys.has("ArrowDown")) - Number(this.keys.has("ArrowUp"));
    const menuX = menuXRaw !== 0 && this.previousMenuX === 0 ? Math.sign(menuXRaw) as -1 | 1 : 0;
    const menuY = menuYRaw !== 0 && this.previousMenuY === 0 ? Math.sign(menuYRaw) as -1 | 1 : 0;
    this.previousMenuX = menuXRaw;
    this.previousMenuY = menuYRaw;

    const frame: InputFrame = {
      method: this.method,
      moveX: usePadMove ? gamepad.move.x : keyboardMoveX,
      moveY: usePadMove ? -gamepad.move.y : keyboardMoveY,
      lookX: this.mouseLookX + gamepad.look.x,
      lookY: this.mouseLookY + gamepad.look.y,
      jump: button("jump"), burst: button("burst"), crouch: button("crouch"), interact: button("interact"), switchWeapon: button("switchWeapon"),
      repair: button("repair"), fire: button("fire"), grapple: button("grapple"), emote: button("emote"), leaderboard: button("leaderboard"), cancel: button("cancel"),
      map: button("map"), ping: button("ping"),
      nextTarget: button("nextTarget"), previousTarget: button("previousTarget"), pause: button("pause"), confirm: button("confirm"),
      menuX, menuY,
      directSlot: this.pendingDirectSlot
    };
    this.mouseLookX = 0;
    this.mouseLookY = 0;
    this.wheelDirection = 0;
    this.pendingPressed.clear();
    this.pendingReleased.clear();
    this.pendingDirectSlot = null;
    return frame;
  }

  vibrate(duration: number, strongMagnitude: number, weakMagnitude = strongMagnitude * 0.55): void {
    if (this.method !== "gamepad") return;
    const gamepad = navigator.getGamepads?.().find((pad) => pad?.connected && pad.mapping === "standard");
    const actuator = gamepad?.vibrationActuator as GamepadHapticActuator & { playEffect?: (type: string, params: Record<string, number>) => Promise<unknown> } | undefined;
    if (!actuator?.playEffect) return;
    void actuator.playEffect("dual-rumble", {
      duration,
      startDelay: 0,
      strongMagnitude: Math.min(1, Math.max(0, strongMagnitude)),
      weakMagnitude: Math.min(1, Math.max(0, weakMagnitude))
    }).catch(() => undefined);
  }

  private pollGamepad(): { actions: Set<InputAction>; move: ReturnType<typeof radialDeadzone>; look: { x: number; y: number }; menuX: -1 | 0 | 1; menuY: -1 | 0 | 1 } {
    const pad = navigator.getGamepads?.().find((entry) => entry?.connected && entry.mapping === "standard");
    if (!pad) {
      this.triggerFireHeld = false;
      this.triggerGrappleHeld = false;
      return { actions: new Set(), move: { x: 0, y: 0, magnitude: 0 }, look: { x: 0, y: 0 }, menuX: 0, menuY: 0 };
    }
    const move = radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, 0.14);
    const rawLook = radialDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0, 0.12);
    const look = curveStick(rawLook.x, rawLook.y);
    const actions = new Set<InputAction>();
    for (const [indexText, action] of Object.entries(gamepadButtonMap)) if (action && pad.buttons[Number(indexText)]?.pressed) actions.add(action);
    if (pad.buttons[0]?.pressed) actions.add("confirm");
    if (pad.buttons[1]?.pressed) actions.add("cancel");
    if (pad.buttons[5]?.pressed) actions.add("nextTarget");
    if (pad.buttons[12]?.pressed) actions.add("emote");
    if (pad.buttons[13]?.pressed) actions.add("map");
    if (pad.buttons[14]?.pressed) actions.add("ping");
    const grappleValue = pad.buttons[6]?.value ?? 0;
    const fireValue = pad.buttons[7]?.value ?? 0;
    this.triggerGrappleHeld = this.triggerGrappleHeld ? grappleValue > 0.35 : grappleValue > 0.55;
    this.triggerFireHeld = this.triggerFireHeld ? fireValue > 0.35 : fireValue > 0.55;
    if (this.triggerGrappleHeld) actions.add("grapple"); else actions.delete("grapple");
    if (this.triggerFireHeld) actions.add("fire"); else actions.delete("fire");
    const dpadX = Number(pad.buttons[15]?.pressed) - Number(pad.buttons[14]?.pressed);
    const dpadY = Number(pad.buttons[13]?.pressed) - Number(pad.buttons[12]?.pressed);
    const menuX = Math.abs(move.x) > .62 ? Math.sign(move.x) as -1 | 1 : dpadX ? Math.sign(dpadX) as -1 | 1 : 0;
    const menuY = Math.abs(move.y) > .62 ? Math.sign(move.y) as -1 | 1 : dpadY ? Math.sign(dpadY) as -1 | 1 : 0;
    const active = actions.size > 0 || move.magnitude > .18 || Math.hypot(look.x, look.y) > .12 || dpadX !== 0 || dpadY !== 0;
    if (active) this.markMethod("gamepad");
    return { actions, move, look, menuX, menuY };
  }

  private markMethod(method: InputMethod, force = false): void {
    const now = performance.now();
    if (method === this.method || (!force && now - this.lastMethodChange < 220)) return;
    this.method = method;
    this.lastMethodChange = now;
    this.onMethodChange?.(method);
  }
}

export function inputLabel(action: "move" | "jump" | "burst" | "interact" | "switchWeapon" | "repair" | "fire" | "grapple" | "emote" | "cancel" | "nextTarget" | "previousTarget", method: InputMethod): string {
  const gamepad: Record<string, string> = {
    move: "LS", jump: "A", burst: "B", interact: "X", switchWeapon: "Y", repair: "RB", fire: "RT", grapple: "LT", emote: "D↑", cancel: "B", nextTarget: "RB", previousTarget: "LB"
  };
  const keyboard: Record<string, string> = {
    move: "WASD", jump: "SPACE", burst: "SHIFT", interact: "E", switchWeapon: "Q", repair: "R", fire: "LMB", grapple: "RMB", emote: "V", cancel: "ESC", nextTarget: "WHEEL", previousTarget: "WHEEL"
  };
  return (method === "gamepad" ? gamepad : keyboard)[action];
}
