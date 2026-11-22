import {describe,expect,it} from "vitest";
import {isDesktopGuest} from "./desktop-environment";
describe("desktop guest capability",()=>{
  it("keeps ordinary browsers on the existing account flow",()=>{
    for(const environment of [undefined,null,{},"desktop",{planetfallDesktop:{}},{planetfallDesktop:{platform:"win32",guestOnly:"true"}}])expect(isDesktopGuest(environment)).toBe(false);
  });
  it("recognizes only the explicit guest-only Windows capability",()=>{
    expect(isDesktopGuest({planetfallDesktop:Object.freeze({platform:"win32",guestOnly:true})})).toBe(true);
    expect(isDesktopGuest({planetfallDesktop:{platform:"other",guestOnly:true}})).toBe(false);
  });
});
