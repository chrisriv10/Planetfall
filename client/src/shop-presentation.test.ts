import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHOP_CATALOG } from "@planetfall/shared";
import { shopCosmeticPreviewPlan } from "./shop-cosmetic-preview";

const css=readFileSync(new URL("./style.css",import.meta.url),"utf8");
function rule(selector:string){
  let start=css.indexOf(`${selector} {`);
  if(start<0)start=css.indexOf(`${selector}{`);
  expect(start,selector).toBeGreaterThanOrEqual(0);
  return css.slice(start,css.indexOf("}",start)+1);
}
describe("shop preview alignment",()=>{
  it("reserves an equal preview row and stable wrapping name row in every card",()=>{
    // Width plus modal padding used to exceed narrow viewports and expose a
    // horizontal scrollbar across the entire shop.
    expect(rule(".overlay-card")).toContain("box-sizing:border-box");
    expect(rule(".shop-item")).toContain("grid-template-rows:148px minmax(2.4em,1fr) auto auto");
    expect(rule(".shop-item > b")).toContain("overflow-wrap:anywhere");
    const preview=rule(".shop-cosmetic-preview");
    expect(preview.replaceAll(" ","")).toContain("width:100%;height:148px");
    expect(preview).toContain("overflow:hidden");
  });
  it("gives the canonical rotating planet the full clipped preview surface",()=>{
    const verity=SHOP_CATALOG.find(item=>item.id==="verity")!;
    expect(shopCosmeticPreviewPlan(verity).markup).toContain('canvas class="cosmetic-preview-image"');
    expect(rule(".cosmetic-preview-image")).toContain("width:100%; height:100%");
    expect(rule(".shop-cosmetic-preview")).toContain("overflow:hidden");
  });
});
