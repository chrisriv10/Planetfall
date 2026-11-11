import {describe,expect,it} from "vitest";
import {callingCardSvg,emblemSvg} from "./identity-cosmetic-art";

const themes=["solar-vanguard","void-explorer","orbital-engineer","crown-collector","ion-runner","shatter-champion"];
describe("identity card and emblem artwork",()=>{
  it("accepts complete whitelisted item IDs only",()=>{
    for(const theme of themes){
      expect(callingCardSvg('card-'+theme)).toBeTypeOf("string");
      expect(emblemSvg('emblem-'+theme)).toBeTypeOf("string");
      expect(callingCardSvg('emblem-'+theme)).toBeNull();expect(emblemSvg('card-'+theme)).toBeNull();
    }
    for(const id of ["","__proto__","toString","card-unknown","solar-vanguard",'<script>alert(1)</script>']){
      expect(callingCardSvg(id)).toBeNull();expect(emblemSvg(id)).toBeNull();
    }
  });
  it("uses distinct geometry for each illustration and each stamp independent of palette",()=>{
    for(const [prefix,lookup] of [["card-",callingCardSvg],["emblem-",emblemSvg]] as const){
      const shapes=themes.map(t=>Array.from(lookup(prefix+t)!.matchAll(/\bd="([^"]+)"/g),m=>m[1]).join("/"));
      expect(new Set(shapes).size).toBe(6);
      expect(shapes.every(shape=>shape.length>40)).toBe(true);
    }
  });
  it("keeps markup decorative, self-contained and repeatable at the intended proportions",()=>{
    const gradients=new Set<string>();
    for(const theme of themes)for(const [id,lookup,box] of [['card-'+theme,callingCardSvg,"360 120"],['emblem-'+theme,emblemSvg,"24 24"]] as const){
      const svg=lookup(id)!;expect(svg).toBe(lookup(id));
      expect(svg).toContain('viewBox="0 0 '+box+'"');expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
      expect(svg).toContain('aria-hidden="true"');expect(svg).not.toMatch(/<(script|image|use|foreignObject|text)\b|\bhref=|on\w+=|url\((?!#)/i);
      for(const ref of svg.matchAll(/url\(#([^)]+)\)/g)){
        expect(svg).toContain('id="'+ref[1]+'"');expect(gradients.has(ref[1])).toBe(false);gradients.add(ref[1]);
      }
    }
    expect(gradients.size).toBe(6);
  });
});
