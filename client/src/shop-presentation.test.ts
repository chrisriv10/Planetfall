import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
    expect(rule(".shop-item")).toContain("grid-template-rows:96px minmax(2.4em,1fr) auto auto");
    expect(rule(".shop-item > b")).toContain("overflow-wrap:anywhere");
    const preview=rule(".shop-cosmetic-preview");
    expect(preview).toContain("width:100%;height:96px");
    expect(preview).toContain("overflow:hidden");
  });
  it("centers the Verity smile in a circular actual-cosmetic preview",()=>{
    const face=rule(".shop-preview-planet");
    expect(face).toContain("border-radius:50%");
    const smile=rule(".shop-preview-smile");
    expect(smile).toContain("left:50%");
    expect(smile).toContain("transform:translateX(-50%)");
    expect(smile).toContain("top:34px");
    expect(rule(".shop-preview-eye.left")).toContain("left:19px");
    expect(rule(".shop-preview-eye.right")).toContain("right:19px");
  });
});
