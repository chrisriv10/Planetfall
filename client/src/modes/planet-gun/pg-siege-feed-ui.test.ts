import { describe, expect, it, vi } from "vitest";
import { createPgSiegeFeedUi, type PgSiegeFeedView } from "./pg-siege-feed-ui";

class NodeStub {
  children: NodeStub[] = []; hidden = false; disabled = false; textContent = ""; className = "";
  dataset: Record<string,string> = {}; onclick: (()=>void)|null = null;
  append(...nodes: NodeStub[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: NodeStub[]) { this.children = nodes; }
  setAttribute() {}
  remove() {}
  find(key: string): NodeStub | undefined {
    if(this.className === 'pg-siege-feed-' + key) return this;
    for(const child of this.children) { const result = child.find(key); if(result) return result; }
  }
}
const base: PgSiegeFeedView = {name:"West stairwell", team:"Blue", index:0, count:2, signal:"live"};
function setup() {
  const ui = createPgSiegeFeedUi({createElement:()=>new NodeStub()} as unknown as Document);
  const root = ui.root as unknown as NodeStub;
  return {ui, root, find:(key: string)=>root.find(key)!};
}
describe("Siege feed chrome", () => {
  it("uses only supplied camera and signal states with an unobscured live view", () => {
    const {ui, root, find} = setup();
    expect(root.hidden).toBe(true); ui.render(base); expect(root.hidden).toBe(false);
    expect(find("mask").hidden).toBe(true); expect(find("name").textContent).toBe("West stairwell");
    expect(find("team").textContent).toContain("BLUE"); expect(find("counter").textContent).toContain("01 / 02");
    for (const signal of ["jammed","destroyed"] as const) {
      ui.render({...base,signal,disabledUntil:1}); expect(find("mask").hidden).toBe(false);
      expect(find("cause").textContent).toBe(signal === "jammed" ? "Interference detected" : "Camera destroyed");
    }
    ui.render({...base, name:"<img src=x>",index:1}); expect(find("mask").hidden).toBe(true);
    expect(find("name").textContent).toBe("<img src=x>"); expect(find("counter").textContent).toContain("02 / 02");
    ui.render(null); expect(root.hidden).toBe(true); ui.dispose();
  });
  it("emits cycle and exit intent and releases callbacks on disposal", () => {
    const {ui, root, find} = setup(), cycle=vi.fn(), exit=vi.fn();
    ui.onCycle=cycle; ui.onExit=exit; ui.render(base);
    const previous=find("prev"), next=find("next"), leave=find("exit");
    previous.onclick!(); next.onclick!(); leave.onclick!();
    expect(cycle.mock.calls).toEqual([[-1],[1]]); expect(exit).toHaveBeenCalledOnce();
    ui.render({...base,count:1}); expect(previous.disabled && next.disabled).toBe(true); previous.onclick!();
    ui.render(null); next.onclick!(); leave.onclick!();
    expect(cycle).toHaveBeenCalledTimes(2); expect(exit).toHaveBeenCalledOnce();
    ui.dispose(); ui.dispose(); ui.render(base);
    expect([previous,next,leave].every(n=>n.onclick===null)).toBe(true); expect(root.children).toHaveLength(0);
  });
});
