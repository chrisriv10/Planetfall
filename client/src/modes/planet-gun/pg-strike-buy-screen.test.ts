import { describe, expect, it, vi } from "vitest";
import { PG_STRIKE_PRICES } from "@planetfall/shared";
import { brItemIconSvg } from "../battle-royale/br-item-art";
import { createPgStrikeBuyScreen, type PgStrikeBuyView } from "./pg-strike-buy-screen";

class NodeStub {
  children: NodeStub[] = [];
  textContent = ""; className = ""; innerHTML = ""; hidden = false; disabled = false;
  dataset: Record<string,string> = {}; attributes: Record<string,string> = {};
  onclick: (() => void) | null = null;
  focused = false;
  focus() { this.focused = true; }
  append(...nodes: NodeStub[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: NodeStub[]) { this.children = nodes; }
  remove() {}
  setAttribute(k: string, v: string) { this.attributes[k] = v; }
  all(): NodeStub[] { return [this, ...this.children.flatMap(node => node.all())]; }
  find(cls: string) { return this.all().find(node => node.className === 'pg-buy-' + cls)!; }
}
function setup() {
  const api = createPgStrikeBuyScreen({createElement: () => new NodeStub()} as unknown as Document);
  const root = api.root as unknown as NodeStub;
  const view: PgStrikeBuyView = {credits: 4500, secondsLeft: 14.4, pendingItem: null, reason: "",
    items: Object.entries(PG_STRIKE_PRICES).map(([id,price]) => ({id, price, owned: false, equipped: false, available: true, reason: ""}))};
  api.render(view);
  return {api, root, view, cards: root.all().filter(n => n.className === "pg-buy-card")};
}
describe("PlanetStrike field armory", () => {
  it("shows all seven sections and priced items, with a distinct image per item and canonical weapon specs", () => {
    const {root, cards} = setup();
    expect(root.hidden).toBe(true);
    expect(root.all().filter(n => n.className === "pg-buy-section-title").map(n => n.textContent)).toEqual(["Sidearms","Rifles","SMGs","Shotguns","Precision","Armor","Utility"]);
    expect(cards.map(n => n.dataset.item).sort()).toEqual(Object.keys(PG_STRIKE_PRICES).sort());
    expect(new Set(cards.map(n => n.find("card-art").innerHTML)).size).toBe(cards.length);
    const shotgun = cards.find(n => n.dataset.item === "photon")!;
    shotgun.onclick!();
    expect(root.find("preview").innerHTML).toBe(brItemIconSvg("photon-shotgun"));
    expect(root.find("specs").all().map(n => n.textContent)).toContain("15 × 8");
    expect(root.all().map(n => n.textContent)).toEqual(expect.arrayContaining(["0:15","4,500","Photon Shotgun","1,400 CR"]));
  });
  it("keeps inspection separate from purchases, preserves focus and obeys current availability", () => {
    const {api, root, cards, view} = setup();
    const onBuy = vi.fn(); api.onBuy = onBuy;
    const card = cards.find(n => n.dataset.item === "comet")!, buy = root.find("purchase");
    card.onclick!(); api.focus(); expect(card.focused).toBe(true); expect(onBuy).not.toHaveBeenCalled();
    buy.onclick!(); expect(onBuy).toHaveBeenCalledWith("comet");
    for (const update of [{credits: 100}, {secondsLeft: 0}, {pendingItem: "armor"}, {items: view.items.map(item => ({...item, owned: true, equipped: true, available: false, reason: "Already equipped"}))}]) {
      api.render({...view, ...update}); expect(buy.disabled).toBe(true); buy.onclick!();
    }
    expect(card.find("status").textContent).toBe("Equipped"); expect(root.find("reason").textContent).toBe("Already equipped");
    expect(onBuy).toHaveBeenCalledOnce();
    api.render({...view, items: [], reason: "Outside spawn"}); expect(cards.every(c => c.hidden)).toBe(true); expect(buy.disabled).toBe(true); expect(root.find("reason").textContent).toBe("Outside spawn");
  });
  it("releases every click target on disposal", () => {
    const {api,root,cards} = setup(); const onClose = vi.fn(); api.onClose = onClose;
    const close = root.find("close"), buy = root.find("purchase");
    close.onclick!(); expect(onClose).toHaveBeenCalledOnce();
    api.dispose(); api.dispose();
    expect(root.children).toHaveLength(0); expect([close,buy,...cards].every(n => n.onclick === null)).toBe(true);
  });
});
