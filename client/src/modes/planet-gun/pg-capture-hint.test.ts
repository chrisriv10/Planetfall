import { describe, expect, it, vi } from "vitest";
import { createPgCaptureHint } from "./pg-capture-hint";

describe("capture hint presentation lifecycle", () => {
  it("starts hidden, distinguishes orbit, and cannot revive after disposal", () => {
    const elements: Array<ReturnType<typeof element>> = [];
    function element() {
      return { className: "", hidden: false, textContent: "", innerHTML: "",
        setAttribute: vi.fn(), append: vi.fn(), remove: vi.fn() };
    }
    const parent = { append: vi.fn(), ownerDocument: { createElement: () => {
      const node = element(); elements.push(node); return node;
    } } } as unknown as HTMLElement;
    const view = createPgCaptureHint(parent);
    const [hint, icon, label] = elements;
    expect(hint.hidden).toBe(true);
    expect(hint.setAttribute).toHaveBeenCalledWith("role", "status");
    expect(icon.innerHTML).toContain('aria-label="Left mouse button"');
    view.set("play");
    expect(hint.hidden).toBe(false);
    expect(label.textContent).toBe("CLICK TO LOOK");
    view.set("spectate");
    expect(label.textContent).toBe("CLICK TO ORBIT");
    view.set(null);
    expect(hint.hidden).toBe(true);
    expect(label.textContent).toBe("");
    view.dispose();
    view.set("play");
    expect(hint.remove).toHaveBeenCalledOnce();
    expect(hint.hidden).toBe(true);
    expect(parent.append).toHaveBeenCalledOnce();
  });
});
