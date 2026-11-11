import {expect,test,type Page} from "@playwright/test";
import {go as walk,lookAt} from "./pg-world-route";
import {PG_BALANCE,PG_SIEGE_CAMERAS} from "@planetfall/shared";
import {openLobbyConfiguration,selectExperimentalFamily} from "./select-family";

test.use({channel:"chromium"});
const state=(page:Page)=>page.evaluate(()=>(window as any).__PLANETFALL_PG_DEBUG__?.());
const go=(page:Page,x:number,z:number)=>walk(page,x,z);
test("Siege feeds share mounted orientation, cycle with a cursor, and go dark after real enemy shots",async({browser},info)=>{
 test.setTimeout(180000);const host=await browser.newPage({viewport:{width:1280,height:720}}),guest=await browser.newPage({viewport:{width:1280,height:720}});
 try{
  for(const [page,name]of [[host,"Camera Attacker"],[guest,"Camera Defender"]]as const){await page.goto("/");await page.getByLabel("Name",{exact:true}).fill(name);await selectExperimentalFamily(page,"planet-gun");}
  await host.locator("#create-room").click();await host.getByLabel("PlanetGun submode").selectOption("planetsiege");await openLobbyConfiguration(host);await host.locator("#pg-fill").uncheck();
  await guest.locator("#room-code").fill(await host.locator("#pg-code").innerText());await guest.locator("#join-room").click();await guest.locator("#pg-ready").click();await host.locator("#pg-ready").click();await host.locator("#pg-start").click();
  for(const page of[host,guest])await expect.poll(async()=>(await state(page))?.mode?.id).toBe("planetsiege");
  await guest.keyboard.press("b");await guest.locator(".pg-mode-menu").getByRole("button",{name:"West Camera",exact:true}).click();await guest.keyboard.press("b");const feed=guest.getByLabel("Security camera feed",{exact:true});await expect(feed).toBeVisible();
  for(const camera of PG_SIEGE_CAMERAS){
   await expect(feed.locator(".pg-siege-feed-name")).toHaveText(camera.name);
   await expect.poll(async()=>{const s=await state(guest);return s.cameraPosition;}).toEqual(camera.position);
   const dx=camera.target.x-camera.position.x,dy=camera.target.y-camera.position.y,dz=camera.target.z-camera.position.z,n=Math.hypot(dx,dy,dz);
   await expect.poll(async()=>{const d=(await state(guest)).cameraDirection;return Math.hypot(d.x-dx/n,d.y-dy/n,d.z-dz/n);}).toBeLessThan(.001);
   expect(await guest.evaluate(()=>document.pointerLockElement===null)).toBe(true);await expect(guest.locator("#pg-crosshair")).toBeHidden();
   await guest.screenshot({path:info.outputPath(`${camera.id}-feed.png`)});await feed.getByRole("button",{name:"Next camera",exact:true}).click();
  }
  // Leaving a higher-priority pause overlay preserves the feed's cursor ownership.
  await guest.locator("#pg-pause").click();await guest.locator("#resume-button").click();expect(await guest.evaluate(()=>document.pointerLockElement===null)).toBe(true);
  await expect.poll(async()=>(await state(host)).mode.subphase,{timeout:40000}).toBe("action");
  await host.bringToFront();await go(host,-38,-11);await go(host,-33.8,-11);await go(host,-33.8,-18);
  await lookAt(host,PG_SIEGE_CAMERAS[0].position);await host.screenshot({path:info.outputPath("mounted-camera-before-shots.png")});
  await host.mouse.down();try{await expect.poll(async()=>(await state(guest)).mode.cameras.find((camera:any)=>camera.id==="west-camera").hp).toBe(0);}finally{await host.mouse.up();}
  await expect(feed).toHaveAttribute("data-signal","destroyed");await guest.screenshot({path:info.outputPath("destroyed-camera-signal.png")});
  await guest.keyboard.press("x");await expect(feed).toBeHidden();await expect.poll(async()=>{const s=await state(guest);return s.mode.pilots[s.local.id].cameraId;}).toBeNull();expect(await guest.evaluate(()=>document.pointerLockElement===null)).toBe(true);
  await guest.keyboard.press("Escape");await guest.locator("#pause-leave").click();await expect(guest.locator("#home-screen")).toBeVisible();
 }finally{await host.close();await guest.close();}
});
