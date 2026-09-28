import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css=readFileSync(new URL("./style.css",import.meta.url),"utf8");
function rule(selector:string){
  const start=css.indexOf(`${selector} {`);
  expect(start,selector).toBeGreaterThanOrEqual(0);
  return css.slice(start,css.indexOf("}",start)+1);
}
describe("shop icon alignment",()=>{
  it("reserves an equal icon row and stable wrapping name row in every card",()=>{
    expect(rule(".shop-item")).toContain("grid-template-rows:40px minmax(2.4em,1fr) auto auto");
    expect(rule(".shop-item > b")).toContain("overflow-wrap:anywhere");
    const icon=rule(".shop-item > i");
    expect(icon).toContain("box-sizing:border-box");
    expect(icon).toContain("align-self:center");
    expect(icon).toContain("width:36px; height:36px");
    expect(icon).not.toMatch(/box-shadow:0 0/);
  });
  it("centers the smile independently of border width and leaves the face circular",()=>{
    const face=rule(".shop-item.planet-item > i");
    expect(face).toContain("border:0");expect(face).toContain("border-radius:50%");
    const smile=rule(".shop-item.planet-item > i::after");
    expect(smile).toContain("box-sizing:border-box");
    expect(smile).toContain("left:50%");
    expect(smile).toContain("transform:translateX(-50%)");
    expect(smile).toContain("top:19px");
    // Existing paired eye boxes have centers 12 and 24: their shared axis is
    // the same 18px center used by the border-inclusive mouth above.
    expect(rule(".shop-item.planet-item > i::before")).toContain("left:10px; width:4px");
    expect(rule(".shop-item.planet-item > i::before")).toContain("box-shadow:12px 0");
  });
});
