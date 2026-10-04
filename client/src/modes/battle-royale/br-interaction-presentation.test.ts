import {describe,expect,it} from "vitest";
import {brContextPromptFor} from "./br-interaction-presentation";

describe("BR interaction presentation",()=>{
  it("lets the loot card exclusively own loot pickup",()=>{
    expect(brContextPromptFor({prompt:"E  PICK UP PULSE RIFLE",hasLootTarget:true,eliminated:false})).toBe("");
  });
  it("retains non-loot actions and hides all actions after elimination",()=>{
    expect(brContextPromptFor({prompt:"E  OPEN STAR CRATE",hasLootTarget:false,eliminated:false})).toBe("E  OPEN STAR CRATE");
    expect(brContextPromptFor({prompt:"REVIVING TEAMMATE",hasLootTarget:false,eliminated:true})).toBe("");
  });
});
