import {test,expect,type Page} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {selectExperimentalFamily} from "./select-family";
const state=(page:Page)=>page.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__:()=>any}).__PLANETFALL_PG_DEBUG__?.());
const reviews=new WeakMap<Page,{shots:unknown[];snapshots:unknown[]}>();
test.afterEach(async({page},info)=>{
 const network=reviews.get(page);if(!network)return;
 const client=await page.evaluate(()=>({state:(window as any).__PLANETFALL_PG_DEBUG__?.(),focus:(window as any).__PG_KIT_FOCUS_REVIEW__})).catch(()=>null);
 await writeFile(info.outputPath("kit-input-network-review.json"),JSON.stringify({network,client},null,2));
});

test("Combat Kits persist real modules, launch equipped and queue in-game edits without cursor capture",async({page},info)=>{
 const review={shots:[] as unknown[],snapshots:[] as unknown[]};reviews.set(page,review);
 page.on("websocket",socket=>{
  socket.on("framesent",event=>{const raw=String(event.payload);if(raw.startsWith('42["pg:weapon:fire"')){review.shots.push({at:Date.now(),request:JSON.parse(raw.slice(2))[1]});if(review.shots.length>32)review.shots.shift();}});
  socket.on("framereceived",event=>{const raw=String(event.payload);if(!raw.startsWith('42["pg:match:snapshot"'))return;const snapshot=JSON.parse(raw.slice(2))[1],pilot=snapshot.players.find((p:any)=>p.name==="Kit Pilot");if(!pilot)return;review.snapshots.push({at:Date.now(),serverTime:snapshot.serverTime,phase:snapshot.phase,lifeId:pilot.lifeId,hp:pilot.hp,slot:pilot.slot,gun:pilot.guns[pilot.slot]});if(review.snapshots.length>240)review.snapshots.shift();});
 });
 await page.addInitScript(()=>{const events:unknown[]=[];(window as any).__PG_KIT_FOCUS_REVIEW__=events;for(const type of["focus","blur","pointerlockchange"])addEventListener(type,()=>{events.push({type,at:Date.now(),locked:!!document.pointerLockElement});if(events.length>64)events.shift();},true);});
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.setViewportSize({width:1280,height:720});await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Kit Pilot");await selectExperimentalFamily(page,"planet-gun");
 await page.locator("#settings-open").click();await page.locator("#graphics-quality").selectOption("low");await page.locator("#settings-close").click();
 await page.locator("#create-room").click();await page.locator("#pg-target").selectOption("4");await page.locator("#pg-edit-kits").click();
 const editor=page.locator(".pg-kit-overlay");await expect(editor).toBeVisible();
 await editor.getByLabel("01 / Kit name",{exact:true}).fill("Burst Patrol");await editor.getByLabel("Primary weapon",{exact:true}).selectOption("helix");await editor.getByLabel("Secondary weapon",{exact:true}).selectOption("orbit");
 await page.locator("#pg-kits-1-primaryModules-precision-lens").check();await page.locator("#pg-kits-1-primaryModules-expanded-cell").check();await page.locator("#pg-kits-1-primaryModules-gyro-stabilizer").check();await page.locator("#pg-kits-1-secondaryModules-reflex-array").check();
 await expect(page.locator("#pg-kits-1-primaryModules-lightweight-frame")).toBeDisabled();await expect(page.locator("#pg-kits-1-primaryModules-rapid-charge-cell")).toBeDisabled();
 await editor.getByRole("button",{name:"Save Kit & Select",exact:true}).click();await editor.getByRole("button",{name:"Close",exact:true}).click();
 await expect(page.locator("#pg-kit-summary")).toContainText("Burst Patrol");await expect(page.locator("#pg-kit-summary")).toContainText("Orbit");
 await page.locator("#pg-ready").click();await page.locator("#pg-start").click();await expect.poll(async()=>(await state(page))?.phase).toBe("playing");
 await expect.poll(async()=>(await state(page))?.local.guns[0].magazine).toBe(33);expect((await state(page)).local.guns[1].id).toBe("orbit");expect((await state(page)).local.guns[0].modules).toEqual(["expanded-cell","gyro-stabilizer","precision-lens"]);
 await page.keyboard.press("2");await expect.poll(async()=>(await state(page)).local.slot).toBe(1);await expect(page.locator("#pg-crosshair")).toHaveAttribute("data-optic","reflex-array");await page.mouse.down({button:"right"});await expect.poll(async()=>(await state(page)).ads).toBeGreaterThan(.95);await page.screenshot({path:info.outputPath("orbit-reflex-array.png")});await page.mouse.up({button:"right"});await page.keyboard.press("1");await expect.poll(async()=>(await state(page)).local.slot).toBe(0);await expect(page.locator("#pg-crosshair")).toHaveAttribute("data-optic","precision-lens");
 await page.mouse.click(640,360);await expect.poll(async()=>(await state(page)).local.guns[0].shots).toBe(3);await page.waitForTimeout(400);expect((await state(page)).local.guns[0].shots).toBe(3);
 await page.keyboard.press("r");await expect.poll(async()=>(await state(page)).local.guns[0].reloadUntil).toBeGreaterThan(0);await page.screenshot({path:info.outputPath("helix-component-reload.png")});
 await expect.poll(async()=>(await state(page)).local.guns[0].reloadUntil).toBe(0);
 await page.keyboard.press("Escape");await page.locator("#pause-kits").click();await expect(editor).toBeVisible();await expect.poll(async()=>(await state(page)).blocked).toBe(true);expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
 const equipped=(await state(page)).local.guns.map((g:any)=>g.id);await editor.getByLabel("Primary weapon",{exact:true}).selectOption("arc");await editor.getByRole("button",{name:"Save Kit & Select",exact:true}).click();
 await expect.poll(async()=>(await state(page)).local.queuedLoadout?.primary).toBe("arc");expect((await state(page)).local.guns.map((g:any)=>g.id)).toEqual(equipped);await expect(editor).toContainText("NEXT SPAWN");
 await page.keyboard.press("Escape");await expect(editor).toBeHidden();await expect(page.locator("#pause-overlay")).toBeVisible();await page.locator("#pause-leave").click();await expect(page.locator("#home-screen")).toBeVisible();
 await page.reload();await selectExperimentalFamily(page,"planet-gun");await page.locator("#create-room").click();await expect(page.locator("#pg-loadout")).toHaveValue("arc");await page.locator("#pg-edit-kits").click();await expect(editor.getByLabel("01 / Kit name",{exact:true})).toHaveValue("Burst Patrol");expect(errors).toEqual([]);
});
