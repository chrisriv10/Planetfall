import {afterEach, describe, expect, it, vi} from "vitest";
import {createGlobalLeaderboardView} from "./global-leaderboard-view";

class Element {
  children: Element[] = []; attrs: Record<string, string> = {}; dataset: Record<string, string> = {};
  className = ""; textContent = ""; hidden = false; disabled = false; id = ""; value = ""; isConnected = true;
  onclick: (() => void) | null = null; oninput: (() => void) | null = null;
  onsubmit: ((event: {preventDefault(): void}) => void) | null = null;
  onkeydown: ((event: {key: string; shiftKey?: boolean; preventDefault(): void; stopPropagation(): void}) => void) | null = null;
  append(...nodes: Element[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: Element[]) { this.children = nodes; }
  setAttribute(key: string, value: string) { this.attrs[key] = value; }
  focus() { (document as unknown as {activeElement: Element}).activeElement = this; }
  walk(): Element[] { return [this, ...this.children.flatMap(node => node.walk())]; }
}
function setup() {
  const origin = new Element();
  vi.stubGlobal("HTMLElement", Element);
  vi.stubGlobal("document", {createElement: () => new Element(), activeElement: origin});
  const callbacks = {onRetry: vi.fn(), onSubmit: vi.fn(), onRemove: vi.fn(), onClose: vi.fn(), onEdit: vi.fn()};
  const view = createGlobalLeaderboardView(callbacks), root = view.root as unknown as Element;
  const find = (cls: string) => root.walk().find(node => node.className === cls)!;
  const action = (name: string) => root.walk().find(node => node.dataset.leaderboardAction === name)!;
  return {view, root, callbacks, find, action, origin};
}
afterEach(() => vi.unstubAllGlobals());
describe("global leaderboard presentation", () => {
  it("renders literal public names, authoritative ranks, and the current position outside the top ten", () => {
    const {view, root, find} = setup();
    view.render({entries: [{rank: 1, name: "<script>unsafe()</script>", xp: 900, isYou: false}],
      currentPlayer: {rank: 43, name: "Me", xp: 24, isYou: true}, publicName: "Me"});
    expect(root.hidden).toBe(true);
    expect(find("global-leaderboard-pilot-name").textContent).toBe("<script>unsafe()</script>");
    expect(find("global-leaderboard-personal").children[1].textContent).toBe("#43");
    expect(find("global-leaderboard-personal").hidden).toBe(false);
    expect(find("global-leaderboard-disclosure").textContent).toContain("publish your pilot name and lifetime earned XP");
  });
  it("keeps publishing explicit, blocks unavailable or saving actions, and preserves unfinished edits", () => {
    const {view, find, action, callbacks} = setup();
    view.open("Guest");
    const input = find("global-leaderboard-name"), form = find("global-leaderboard-sharing");
    form.onsubmit!({preventDefault() {}}); expect(callbacks.onSubmit).not.toHaveBeenCalled();
    view.render({entries: [], currentPlayer: null, publicName: null});
    input.value = "  Pilot  "; input.oninput!();
    view.render({entries: [], currentPlayer: null, publicName: null}); expect(input.value).toBe("  Pilot  ");
    form.onsubmit!({preventDefault() {}}); expect(callbacks.onSubmit).toHaveBeenCalledWith("Pilot");
    view.saving(true); form.onsubmit!({preventDefault() {}}); expect(callbacks.onSubmit).toHaveBeenCalledTimes(1);
    view.saving(false); view.render({entries: [], currentPlayer: null, publicName: "Pilot"});
    expect(action("remove").hidden).toBe(false); action("remove").onclick!(); expect(callbacks.onRemove).toHaveBeenCalledOnce();
  });
  it("requests close on Escape, traps Tab, restores focus and exposes recovery", () => {
    const {view, root, callbacks, action, origin, find} = setup();
    view.open("Pilot"); expect(document.activeElement).toBe(action("close"));
    const event = {key: "Tab", shiftKey: true, preventDefault: vi.fn(), stopPropagation: vi.fn()};
    root.onkeydown!(event); expect(event.preventDefault).toHaveBeenCalledOnce();
    root.onkeydown!({...event, key: "Escape"}); expect(callbacks.onClose).toHaveBeenCalledOnce();
    view.error("Backend unavailable"); expect(action("retry").hidden).toBe(false);
    expect(find("global-leaderboard-status").textContent).toBe("Backend unavailable");
    action("retry").onclick!(); expect(callbacks.onRetry).toHaveBeenCalledOnce();
    view.close(); expect(root.hidden).toBe(true); expect(document.activeElement).toBe(origin);
  });
});
