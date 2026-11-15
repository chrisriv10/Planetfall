import {afterEach, describe, expect, it, vi} from "vitest";
import {createAccountPanel} from "./account-panel";

class Element {
  children: Element[] = []; attrs: Record<string, string> = {}; dataset: Record<string, string> = {};
  className = ""; textContent = ""; hidden = false; disabled = false; id = "";
  onclick: (() => void) | null = null; onerror: (() => void) | null = null;
  append(...nodes: Element[]) { this.children.push(...nodes); }
  setAttribute(key: string, value: string) { this.attrs[key] = value; }
  getAttribute(key: string) { return this.attrs[key] ?? null; }
  removeAttribute(key: string) { delete this.attrs[key]; }
  set src(value: string) { this.attrs.src = value; }
  walk(): Element[] { return [this, ...this.children.flatMap(node => node.walk())]; }
}
function setup() {
  vi.stubGlobal("document", {createElement: () => new Element()});
  const action = vi.fn(), panel = createAccountPanel(action), root = panel.root as unknown as Element;
  const find = (cls: string) => root.walk().find(node => node.className === cls)!;
  const button = (name: string) => root.walk().find(node => node.dataset.accountAction === name)!;
  return {panel, root, action, find, button};
}
afterEach(() => vi.unstubAllGlobals());
describe("account panel presentation", () => {
  it("starts hidden and emits distinct conflict choices without owning visibility", () => {
    const {panel, root, button, action} = setup();
    expect(root.hidden).toBe(true); expect(root.attrs["aria-labelledby"]).toBe("account-heading");
    panel.render({state: "conflict", account: {name: "Pilot"}});
    expect(button("google").hidden).toBe(true);
    expect(button("account").textContent).toBe("Continue with account progress");
    expect(button("guest").textContent).toBe("Keep playing as guest");
    button("account").onclick!(); button("guest").onclick!();
    expect(action.mock.calls).toEqual([["account"], ["guest"]]); expect(root.hidden).toBe(true);
  });
  it("renders identity literally, rejects unsafe images and clears prior identity on sign-out", () => {
    const {panel, find} = setup();
    panel.render({state: "signed-in", account: {name: "<img onerror=bad>", avatar: "javascript:bad"},
      profile: {sessionLevel: 24, fallbucks: 3850, crowns: 8}, cosmeticName: "Ion Blue"});
    expect(find("account-name").textContent).toBe("<img onerror=bad>");
    expect(find("account-avatar").hidden).toBe(true);
    panel.render({state: "signed-in", account: {name: "Pilot", avatar: "https://example.com/avatar.png"}});
    expect(find("account-avatar").getAttribute("src")).toBe("https://example.com/avatar.png");
    find("account-avatar").onerror!(); expect(find("account-initials").hidden).toBe(false);
    panel.render({state: "guest"});
    expect(find("account-name").textContent).toBe("GUEST PILOT");
    expect(find("account-avatar").getAttribute("src")).toBeNull();
    expect(find("account-summary").hidden).toBe(true);
    expect(find("account-cosmetic").children[1].textContent).toBe("");
  });
  it("blocks busy actions, keeps close available, and exposes polite recovery feedback", () => {
    const {panel, button, action, find} = setup();
    panel.render({state: "busy"}); button("guest").onclick!(); expect(action).not.toHaveBeenCalled();
    button("close").onclick!(); expect(action).toHaveBeenCalledWith("close");
    panel.render({state: "unavailable", feedback: "Try again shortly."});
    expect(button("retry").hidden).toBe(false); expect(button("guest").disabled).toBe(false);
    expect(find("account-feedback").attrs["aria-live"]).toBe("polite");
    expect(find("account-feedback").textContent).toBe("Try again shortly.");
  });
});
