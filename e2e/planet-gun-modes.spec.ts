import {test,expect,type Page} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {selectExperimentalFamily,openLobbyConfiguration,selectPgCharacter} from "./select-family";
const state=(page:Page)=>page.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__?:()=>any}).__PLANETFALL_PG_DEBUG__?.());
test.use({channel:"chromium"});
for(const mode of ["planetstrike","planetwatch","planetsiege","planetzombies"] as const)test(`${mode} lobby, authority, live input, equipment menu and clean exit`,async({page},info)=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.setViewportSize({width:1280,height:720});await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Mode Playtester");await selectExperimentalFamily(page,"planet-gun");await page.locator("#create-room").click();
 await page.getByLabel("PlanetGun submode").selectOption(mode);await expect(page.getByLabel("PlanetGun submode")).toHaveValue(mode);
 await openLobbyConfiguration(page);await page.locator("#pg-target").selectOption("4");
 const back=await page.locator("#pg-leave-lobby").boundingBox();expect(back).not.toBeNull();expect(back!.y+back!.height).toBeLessThanOrEqual(720);
 if(mode==="planetwatch"||mode==="planetsiege")await selectPgCharacter(page,mode==="planetwatch"?"cinder":"null");
 await page.screenshot({path:info.outputPath(`${mode}-lobby.png`)});
 await page.locator("#pg-ready").click();await page.locator("#pg-start").click();await expect.poll(async()=>(await state(page))?.mode?.id).toBe(mode);
 const initial=await state(page);expect(initial.players).toBe(4);expect(initial.mode.pilots[initial.local.id].life).toBe("alive");
 if(mode==="planetwatch")expect(initial.mode.pilots[initial.local.id].characterId).toBe("cinder");
 if(mode==="planetsiege")expect(initial.mode.pilots[initial.local.id].characterId).toBe("null");
 if(mode==="planetstrike"||mode==="planetzombies"){expect(initial.local.slot).toBe(1);expect(initial.local.guns[0].magazine).toBe(0);await page.keyboard.press("1");await page.waitForTimeout(200);expect((await state(page)).local.slot).toBe(1);}
 const equipment=page.getByRole("dialog",{name:mode==="planetstrike"?"PlanetStrike armory":"Mode equipment and character"});
 await page.keyboard.press("b");await expect(equipment).toBeVisible();expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
 await page.screenshot({path:info.outputPath(`${mode}-equipment.png`)});await page.keyboard.press("b");await expect(equipment).toBeHidden();
 if(mode!=="planetsiege"){
  const before=(await state(page)).local.position;await page.keyboard.down("w");await page.waitForTimeout(700);await page.keyboard.up("w");await expect.poll(async()=>{const p=(await state(page)).local.position;return Math.hypot(p.x-before.x,p.z-before.z);}).toBeGreaterThan(.7);
  // Shared browser-default cancellation must not consume PlanetGun's Space.
  const previousJump=(await state(page)).local.lastJumpAt;await page.keyboard.down("Space");
  try{await expect.poll(async()=>(await state(page)).local.position.y).toBeGreaterThan(.6);expect((await state(page)).local.lastJumpAt).toBeGreaterThan(previousJump);}finally{await page.keyboard.up("Space");}
 }
 if(mode==="planetsiege"){
  const before=(await state(page)).local.position;await page.keyboard.down("w");await page.waitForTimeout(400);await page.keyboard.up("w");const after=(await state(page)).local.position;expect(Math.hypot(after.x-before.x,after.z-before.z)).toBeLessThan(.05);
  await page.keyboard.press("v");await expect.poll(async()=>{const s=await state(page);return s.mode.pilots[s.local.id].controllingDrone;}).toBe(true);await page.keyboard.down("w");await page.waitForTimeout(600);await page.keyboard.up("w");await page.keyboard.press("v");
 }
 await page.screenshot({path:info.outputPath(`${mode}-first-person.png`)});await writeFile(info.outputPath(`${mode}-state.json`),JSON.stringify(await state(page),null,2));
 await page.keyboard.press("Escape");await page.locator("#pause-leave").click();await expect(page.locator("#home-screen")).toBeVisible();await expect(page.locator("#pg-hud")).toBeHidden();expect(errors).toEqual([]);
});
