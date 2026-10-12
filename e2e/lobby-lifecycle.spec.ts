import { expect, test } from "@playwright/test";

for (const br of [false,true]) {
  test(`${br?"BR":"Classic"} lobby leave transfers authority and restores home without reloading`,async({browser})=>{
    const hostContext=await browser.newContext(),guestContext=await browser.newContext();
    const host=await hostContext.newPage(),guest=await guestContext.newPage();
    const errors:string[]=[];
    for(const page of [host,guest])page.on("pageerror",error=>errors.push(error.message));
    try {
      await Promise.all([host.goto("/"),guest.goto("/")]);
      await host.getByLabel("Name",{exact:true}).fill("Leaving Pilot");
      await guest.getByLabel("Name",{exact:true}).fill("Remaining Pilot");
      if(br)for(const page of [host,guest])await page.locator("#family-br").click();
      await host.locator("#create-room").click();
      const lobby=br?"#br-lobby-screen":"#lobby-screen",codeId=br?"#br-lobby-code":"#lobby-code";
      await expect(host.locator(lobby)).toBeVisible();
      const code=await host.locator(codeId).innerText();
      await guest.locator("#room-code").fill(code);await guest.locator("#join-room").click();
      await expect(guest.locator(lobby)).toContainText("Leaving Pilot");
      if(br){
        await expect.poll(()=>host.evaluate(()=>(window as unknown as {__PLANETFALL_DEBUG__:()=>{homePreview:string}}).__PLANETFALL_DEBUG__().homePreview)).toBe("battle-royale");
        await expect.poll(()=>host.evaluate(()=>(window as unknown as {__PLANETFALL_BR_DEBUG__?:()=>{phase:string}}).__PLANETFALL_BR_DEBUG__?.().phase)).toBe("lobby");
        expect(await host.evaluate(()=>(window as unknown as {__PLANETFALL_BR_DEBUG__:()=>{active:boolean}}).__PLANETFALL_BR_DEBUG__().active)).toBe(false);
        // The overview must still render after gameplay preparation releases
        // its inactive mode. This clear right-side region excludes controls.
        const before=await host.screenshot({clip:{x:820,y:180,width:400,height:300}});
        await host.waitForTimeout(700);
        const after=await host.screenshot({clip:{x:820,y:180,width:400,height:300}});
        expect(after.equals(before),"BR lobby overview must keep animating").toBe(false);
      }
      const timeOrigin=await host.evaluate(()=>performance.timeOrigin);
      await host.mouse.click(1250,450);
      expect(await host.evaluate(()=>document.pointerLockElement===null)).toBe(true);
      await host.locator(br?"#br-leave-lobby":"#leave-lobby").click();
      await expect(host.locator("#home-screen")).toBeVisible();
      await expect(guest.locator(lobby)).not.toContainText("Leaving Pilot");
      await expect(guest.locator(br?"#br-start-button":"#start-button")).toBeVisible();
      expect(await host.evaluate(()=>performance.timeOrigin)).toBe(timeOrigin);
      await expect(host.getByLabel("Name",{exact:true})).toHaveValue("Leaving Pilot");
      await expect(host.locator("#shop-home")).toHaveText("SHOP");
      expect(await host.evaluate(()=>document.pointerLockElement===null)).toBe(true);
      // The same socket can join again after its old authoritative membership
      // has been removed; no reload or ghost pilot is needed.
      await host.locator("#room-code").fill(code);await host.locator("#join-room").click();
      await expect(guest.locator(lobby)).toContainText("Leaving Pilot");
      await host.locator(br?"#br-leave-lobby":"#leave-lobby").click();
      await guest.locator(br?"#br-leave-lobby":"#leave-lobby").click();
      await expect(guest.locator("#home-screen")).toBeVisible();
      expect(errors).toEqual([]);
    }finally{await hostContext.close();await guestContext.close();}
  });
}

test("leaving a BR lobby during module loading cannot reactivate it over home",async({page})=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/src/modes/battle-royale/br-game.ts*",async route=>{await gate;await route.continue();});
  await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Quick Leaving Pilot");await page.locator("#family-br").click();await page.locator("#create-room").click();
  await expect(page.locator("#br-lobby-screen")).toBeVisible();
  await page.locator("#br-leave-lobby").click();await expect(page.locator("#home-screen")).toBeVisible();
  release();
  await page.waitForFunction(()=>!!(window as unknown as {__PLANETFALL_BR_DEBUG__?:unknown}).__PLANETFALL_BR_DEBUG__);
  const state=await page.evaluate(()=>(window as unknown as {__PLANETFALL_BR_DEBUG__:()=>{active:boolean;phase:string|null;localId:string}}).__PLANETFALL_BR_DEBUG__());
  expect(state.phase).toBeNull();expect(state.localId).toBe("");expect(state.active).toBe(false);
  await page.mouse.click(1250,450);expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
  await expect(page.locator("#home-screen")).toBeVisible();
});
