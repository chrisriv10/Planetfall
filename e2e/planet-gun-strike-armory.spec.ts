import {expect,test} from "@playwright/test";
import {openLobbyConfiguration,selectExperimentalFamily} from "./select-family";

test.use({channel:"chromium"});
test("Strike armory inspects without buying, confirms real equipment and credits, and releases input",async({page},info)=>{
 const actions:any[]=[],errors:string[]=[],roomWire:string[]=[];page.on("pageerror",error=>errors.push(error.message));
 page.on("websocket",socket=>{socket.on("framereceived",frame=>{const value=String(frame.payload);if(value.startsWith("43")||value.includes("pg:room:state")||value.includes(":error"))roomWire.push(value.slice(0,1800));});socket.on("framesent",frame=>{const value=String(frame.payload),start=value.indexOf("[");if(value.includes("room:create"))roomWire.push(value);if(value.startsWith("42")&&start>=0){const[event,payload]=JSON.parse(value.slice(start));if(event==="pg:mode:action"&&payload.kind==="buy")actions.push(payload);}});});
 try{
 await page.setViewportSize({width:1366,height:768});await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Armory Pilot");await selectExperimentalFamily(page,"planet-gun");await page.locator("#create-room").click();await expect(page.locator("#pg-lobby-screen")).toBeVisible();await page.getByLabel("PlanetGun submode").selectOption("planetstrike");
 await expect(page.locator("#pg-lobby-screen")).toBeVisible();await openLobbyConfiguration(page);await page.locator("#pg-target").selectOption("4");await page.locator("#pg-ready").click();await page.locator("#pg-start").click();await expect.poll(()=>page.evaluate(()=>(window as any).__PLANETFALL_PG_DEBUG__?.()?.mode?.id)).toBe("planetstrike");await page.keyboard.press("b");
 const screen=page.locator("#pg-strike-buy-screen");await expect(screen).toBeVisible();expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);await expect(screen.locator(".pg-buy-section-title")).toHaveCount(7);
 await screen.locator('[data-item="pulse"]').click();await expect(screen.locator(".pg-buy-purchase")).toBeDisabled();await expect(screen.locator(".pg-buy-reason")).toContainText("Insufficient credits");expect(actions).toHaveLength(0);
 await screen.locator('[data-item="comet"]').click();await expect(screen.locator(".pg-buy-inspect h3")).toHaveText("Comet Hand Cannon");await expect(screen).toHaveAttribute("data-model-preview","true");expect(actions).toHaveLength(0);
 await page.screenshot({path:info.outputPath("strike-armory-inspection.png")});await screen.locator(".pg-buy-purchase").click();await expect(screen.locator(".pg-buy-reason")).toHaveText("Purchase confirmed.");expect(actions).toHaveLength(1);
 const state=()=>page.evaluate(()=>(window as any).__PLANETFALL_PG_DEBUG__?.());await expect.poll(async()=>(await state()).local.guns[1].id).toBe("comet");await expect.poll(async()=>{const s=await state();return s.mode.pilots[s.local.id].credits;}).toBe(300);
 await screen.locator('[data-item="smoke"]').click();await screen.locator(".pg-buy-purchase").click();await expect.poll(async()=>{const s=await state();return s.mode.pilots[s.local.id].utilities[0];}).toBe(1);await expect(screen.locator(".pg-buy-purchase")).toBeDisabled();expect(actions).toHaveLength(2);
 for(const[width,height]of [[864,540],[390,844]]as const){await page.setViewportSize({width,height});await page.screenshot({path:info.outputPath(`strike-armory-${width}.png`)});const button=await screen.locator(".pg-buy-close").boundingBox();expect(button).not.toBeNull();expect(button!.y+button!.height).toBeLessThanOrEqual(height);}
 await page.keyboard.press("Escape");await expect(screen).toBeHidden();await expect(page.locator("#pause-overlay")).toBeHidden();await expect(page.locator("#pg-hud")).toBeVisible();
 await page.keyboard.press("Escape");await page.locator("#pause-leave").click();await expect(page.locator("#home-screen")).toBeVisible();
 expect(errors).toEqual([]);
 }finally{await info.attach("room-wire-and-errors",{body:JSON.stringify({roomWire,errors}),contentType:"application/json"});}
});
