import {expect,test,type Page} from "@playwright/test";
import {openLobbyConfiguration,selectExperimentalFamily,selectPgCharacter} from "./select-family";

test.use({channel:"chromium"});
async function prepare(page:Page,name:string){
 await page.setViewportSize({width:960,height:540});await page.goto("/");
 await page.getByLabel("Name",{exact:true}).fill(name);await selectExperimentalFamily(page,"planet-gun");
}
const state=(page:Page)=>page.evaluate(()=>(window as any).__PLANETFALL_PG_DEBUG__?.());

test("Watch drafts locally, confirms once, preserves lobby on Escape and reserves only teammate heroes",async({browser},info)=>{
 const context=await browser.newContext(),host=await context.newPage(),enemy=await context.newPage(),ally=await context.newPage();
 const actions:any[]=[],errors:string[]=[];
 host.on("pageerror",error=>errors.push(error.message));
 host.on("websocket",socket=>socket.on("framesent",frame=>{
  const text=String(frame.payload),start=text.indexOf("[");if(!text.startsWith("42")||start<0)return;
  const [event,payload]=JSON.parse(text.slice(start));if(event==="pg:mode:action")actions.push(payload);
 }));
 try{
  await prepare(host,"Selection Host");await host.locator("#create-room").click();await host.getByLabel("PlanetGun submode").selectOption("planetwatch");
  const code=await host.locator("#pg-code").innerText();
  for(const [page,name]of [[enemy,"Mirror Enemy"],[ally,"Reserved Ally"]]as const){await prepare(page,name);await page.locator("#room-code").fill(code);await page.locator("#join-room").click();await expect(page.locator("#pg-lobby-screen")).toBeVisible();}
  await host.locator("#pg-lobby-screen .pg-character-open").click();const screen=host.locator("#pg-character-selection-screen");
  await screen.locator('[data-character-id="kepler"]').click();await expect(screen.locator(".pg-selection-status")).toContainText("NOT CONFIRMED");expect(actions).toHaveLength(0);
  await host.keyboard.press("Escape");await expect(screen).toBeHidden();await expect(host.locator("#pg-lobby-screen")).toBeVisible();expect(actions).toHaveLength(0);
  await selectPgCharacter(host,"kepler");expect(actions.filter(action=>action.kind==="select")).toHaveLength(1);
  await ally.locator("#pg-lobby-screen .pg-character-open").click();const reserved=ally.locator('#pg-character-selection-screen [data-character-id="kepler"]');
  await expect(reserved).toBeDisabled();await expect(reserved).toContainText("Selection Host");await ally.keyboard.press("Escape");await expect(ally.locator("#pg-lobby-screen")).toBeVisible();
  // Opponents may mirror; no global uniqueness restriction is introduced.
  await selectPgCharacter(enemy,"kepler");
  for(const page of [host,enemy,ally])expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
  await host.locator("#pg-lobby-screen .pg-character-open").click();await host.screenshot({path:info.outputPath("watch-confirmed-team.png")});await host.keyboard.press("Escape");
  await host.locator("#pg-leave-lobby").click();await expect(host.locator("#home-screen")).toBeVisible();expect(errors).toEqual([]);
 }finally{await context.close();}
});

for(const mode of ["planetwatch","planetsiege"]as const)test(`${mode} selection uses live renderer, releases capture and closes without opening pause`,async({page},info)=>{
 await prepare(page,"Live Character");await page.locator("#create-room").click();await page.getByLabel("PlanetGun submode").selectOption(mode);
 await openLobbyConfiguration(page);await page.locator("#pg-target").selectOption("4");await selectPgCharacter(page,mode==="planetwatch"?"kepler":"rivet");
 await page.locator("#pg-ready").click();await page.locator("#pg-start").click();await expect.poll(async()=>(await state(page))?.mode?.id).toBe(mode);
 await page.keyboard.press("b");await page.locator(".pg-mode-menu .pg-character-open").click();const screen=page.locator("#pg-character-selection-screen");await expect(screen).toBeVisible();
 expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);expect(await page.locator("canvas").count()).toBe(1);
 await page.screenshot({path:info.outputPath(`${mode}-live-selection.png`)});
 await page.keyboard.press("Escape");await expect(screen).toBeHidden();await expect(page.locator("#pg-hud")).toBeVisible();await expect(page.locator("#pause-overlay")).toBeHidden();
 await page.keyboard.press("Escape");await expect(page.locator("#resume-button")).toBeVisible();await page.locator("#pause-leave").click();await expect(page.locator("#home-screen")).toBeVisible();
});
