import {selectExperimentalFamily} from "./select-family";
import { expect, test } from "@playwright/test";

for (const [family,lobby,codeId,leaveId,startId,readyId] of [
 ["planetfall","#lobby-screen","#lobby-code","#leave-lobby","#start-button","#ready-button"],
 ["battle-royale","#br-lobby-screen","#br-lobby-code","#br-leave-lobby","#br-start-button","#br-ready-button"],
 ["planet-run","#pr-lobby-screen","#pr-code","#pr-leave-lobby","#pr-start","#pr-ready"],
 ["planet-gun","#pg-lobby-screen","#pg-code","#pg-leave-lobby","#pg-start","#pg-ready"],
]as const) {
  test(`${family} lobby leave transfers authority and restores home without reloading`,async({browser})=>{
    const hostContext=await browser.newContext(),guestContext=await browser.newContext();
    const host=await hostContext.newPage(),guest=await guestContext.newPage();
    const errors:string[]=[];
    for(const page of [host,guest])page.on("pageerror",error=>errors.push(error.message));
    try {
      await Promise.all([host.goto("/"),guest.goto("/")]);
      await host.getByLabel("Name",{exact:true}).fill("Leaving Pilot");
      await guest.getByLabel("Name",{exact:true}).fill("Remaining Pilot");
      if(family!=="planetfall")for(const page of [host,guest])await selectExperimentalFamily(page,family);
      await host.locator("#create-room").click();
      await expect(host.locator(lobby)).toBeVisible();
      await expect(host.locator(`${lobby} .lobby-configuration`)).toHaveJSProperty("open",false);
      await expect.poll(()=>host.evaluate(()=>(window as unknown as {__PLANETFALL_DEBUG__:()=>{lobbyAvatarCount:number}}).__PLANETFALL_DEBUG__().lobbyAvatarCount)).toBe(1);
      const code=await host.locator(codeId).innerText();
      await guest.locator("#room-code").fill(code);await guest.locator("#join-room").click();
      await expect(guest.locator(lobby)).toContainText("Leaving Pilot");
      await expect.poll(()=>host.evaluate(()=>(window as unknown as {__PLANETFALL_DEBUG__:()=>{lobbyAvatarCount:number}}).__PLANETFALL_DEBUG__().lobbyAvatarCount)).toBe(2);
      await guest.locator(readyId).click();await expect(guest.locator(`${lobby} .lobby-pilot-ready`)).toContainText("READY TO LAUNCH");
      if(family==="battle-royale"){
        await expect.poll(()=>host.evaluate(()=>(window as unknown as {__PLANETFALL_DEBUG__:()=>{homePreview:string}}).__PLANETFALL_DEBUG__().homePreview)).toBe("battle-royale");
        await expect.poll(()=>host.evaluate(()=>(window as unknown as {__PLANETFALL_BR_DEBUG__?:()=>{phase:string}}).__PLANETFALL_BR_DEBUG__?.().phase)).toBe("lobby");
        expect(await host.evaluate(()=>(window as unknown as {__PLANETFALL_BR_DEBUG__:()=>{active:boolean}}).__PLANETFALL_BR_DEBUG__().active)).toBe(false);
        // The shared ready room keeps the animated scene in its main region;
        // the old right-hand clip now contains the static configuration card.
        const main=await host.locator(`${lobby} .lobby-avatar-window`).boundingBox();expect(main).not.toBeNull();
        const clip={x:main!.x+main!.width*.15,y:main!.y+main!.height*.3,width:Math.min(400,main!.width*.65),height:Math.min(300,main!.height*.6)};
        const before=await host.screenshot({clip});
        await host.waitForTimeout(700);
        const after=await host.screenshot({clip});
        expect(after.equals(before),"BR lobby overview must keep animating").toBe(false);
      }
      const timeOrigin=await host.evaluate(()=>performance.timeOrigin);
      await host.mouse.click(1250,450);
      expect(await host.evaluate(()=>document.pointerLockElement===null)).toBe(true);
      await host.locator(leaveId).click();
      await expect(host.locator("#home-screen")).toBeVisible();
      await expect(guest.locator(lobby)).not.toContainText("Leaving Pilot");
      await expect(guest.locator(startId)).toBeVisible();
      if(family==="planetfall"){
        // Classic still requires two participants. The new host can add a bot;
        // authority transfer must not bypass that unchanged gameplay rule.
        await expect(guest.locator(startId)).toBeDisabled();await expect(guest.locator("#add-bot")).toBeEnabled();await guest.locator("#add-bot").click();
      }
      await expect(guest.locator(startId)).toBeEnabled();
      await expect.poll(()=>host.evaluate(()=>(window as unknown as {__PLANETFALL_DEBUG__:()=>{lobbyAvatarCount:number}}).__PLANETFALL_DEBUG__().lobbyAvatarCount)).toBe(0);
      expect(await host.evaluate(()=>performance.timeOrigin)).toBe(timeOrigin);
      await expect(host.getByLabel("Name",{exact:true})).toHaveValue("Leaving Pilot");
      await expect(host.locator("#shop-home")).toHaveText("SHOP");
      expect(await host.evaluate(()=>document.pointerLockElement===null)).toBe(true);
      // The same socket can join again after its old authoritative membership
      // has been removed; no reload or ghost pilot is needed.
      await host.locator("#room-code").fill(code);await host.locator("#join-room").click();
      await expect(guest.locator(lobby)).toContainText("Leaving Pilot");
      await host.locator(leaveId).click();
      await guest.locator(leaveId).click();
      await expect(guest.locator("#home-screen")).toBeVisible();
      expect(errors).toEqual([]);
    }finally{await hostContext.close();await guestContext.close();}
  });
}

test("leaving a BR lobby during module loading cannot reactivate it over home",async({page})=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/src/modes/battle-royale/br-game.ts*",async route=>{await gate;await route.continue();});
  await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Quick Leaving Pilot");await selectExperimentalFamily(page,"battle-royale");await page.locator("#create-room").click();
  await expect(page.locator("#br-lobby-screen")).toBeVisible();
  await page.locator("#br-leave-lobby").click();await expect(page.locator("#home-screen")).toBeVisible();
  release();
  await page.waitForFunction(()=>!!(window as unknown as {__PLANETFALL_BR_DEBUG__?:unknown}).__PLANETFALL_BR_DEBUG__);
  const state=await page.evaluate(()=>(window as unknown as {__PLANETFALL_BR_DEBUG__:()=>{active:boolean;phase:string|null;localId:string}}).__PLANETFALL_BR_DEBUG__());
  expect(state.phase).toBeNull();expect(state.localId).toBe("");expect(state.active).toBe(false);
  await page.mouse.click(1250,450);expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
  await expect(page.locator("#home-screen")).toBeVisible();
});
