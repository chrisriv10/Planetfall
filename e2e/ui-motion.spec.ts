import {test,expect} from "@playwright/test";
import {writeFile} from "node:fs/promises";
test.use({channel:"chromium",viewport:{width:1280,height:720}});
const opacity=(page:any,id:string)=>page.locator(id).evaluate((e:HTMLElement)=>Number(getComputedStyle(e).opacity));
test("shared menus fade without delaying logical close, focus or rapid reopening",async({page},info)=>{
 await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Motion Pilot");await expect(page.locator("[data-ui-motion]")).toHaveCount(1);
 await page.locator("#shop-home").click();await expect.poll(()=>opacity(page,"#shop-overlay")).toBeGreaterThan(.99);
 await page.evaluate(()=>{const shop=document.getElementById("shop-overlay")!;document.getElementById("shop-close")!.addEventListener("click",()=>{const s=getComputedStyle(shop);(window as any).__MENU_EXIT__={hidden:shop.hidden,display:s.display,opacity:s.opacity,interactivity:s.getPropertyValue("interactivity"),pointerEvents:s.pointerEvents,locked:!!document.pointerLockElement,supported:CSS.supports("interactivity","inert")&&CSS.supports("transition-behavior","allow-discrete")};},{once:true});});
 await page.locator("#shop-close").click();const exit=await page.evaluate(()=>(window as any).__MENU_EXIT__);expect(exit.hidden).toBe(true);expect(exit.locked).toBe(false);expect(exit.pointerEvents).toBe("none");
 if(exit.supported){expect(exit.interactivity).toBe("inert");expect(exit.display).not.toBe("none");}
 await page.locator("#shop-home").click();await page.waitForTimeout(230);await expect(page.locator("#shop-overlay")).toBeVisible();expect(await page.locator("#shop-overlay").evaluate((e:HTMLElement)=>e.hidden)).toBe(false);
 expect(await page.locator("#shop-overlay").evaluate((e:HTMLElement)=>e.contains(document.activeElement))).toBe(true);
 await page.screenshot({path:info.outputPath("shop-rapid-reopen.png")});await page.locator("#shop-close").click();await expect(page.locator("#shop-overlay")).toBeHidden();
 await page.locator("#settings-open").click();await expect.poll(()=>opacity(page,"#settings-overlay")).toBeGreaterThan(.99);await page.locator("#settings-close").click();expect(await page.locator("#settings-overlay").evaluate((e:HTMLElement)=>e.hidden)).toBe(true);
 await page.locator("#create-room").click();await expect(page.locator("#lobby-screen")).toHaveClass(/active/);await page.locator("#pass-lobby").click();await expect.poll(()=>opacity(page,"#pass-overlay")).toBeGreaterThan(.99);await page.screenshot({path:info.outputPath("pass-shared-motion.png")});await page.locator("#pass-close").click();await expect(page.locator("#pass-overlay")).toBeHidden();await page.locator("#leave-lobby").click();await expect(page.locator("#home-screen")).toHaveClass(/active/);
 await writeFile(info.outputPath("menu-motion.json"),JSON.stringify({exit},null,2));
});
test("reduced motion removes menu, progress and press transitions",async({page},info)=>{
 await page.emulateMedia({reducedMotion:"reduce"});await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Reduced Motion Pilot");await page.locator("#shop-home").click();
 const read=()=>page.evaluate(()=>{const ids=["shop-overlay","shop-close","pass-xp-meter"];return ids.map(id=>{const e=document.getElementById(id)!;const s=getComputedStyle(e);return {id,duration:s.transitionDuration,animation:s.animationDuration};});});
 const styles=await read();for(const s of styles){expect(s.duration.split(",").every(t=>parseFloat(t)<=.001)).toBe(true);expect(s.animation.split(",").every(t=>parseFloat(t)<=.001)).toBe(true);}
 await page.locator("#shop-close").click();expect(await page.locator("#shop-overlay").evaluate((e:HTMLElement)=>({hidden:e.hidden,display:getComputedStyle(e).display}))).toEqual({hidden:true,display:"none"});
 await page.locator("#settings-open").click();await expect(page.locator("#settings-overlay")).toBeVisible();await page.screenshot({path:info.outputPath("reduced-motion-settings.png")});await page.locator("#settings-close").click();await writeFile(info.outputPath("reduced-motion.json"),JSON.stringify(styles,null,2));
});

test("notices become inert before their visual exit and then leave the DOM",async({page},info)=>{
 await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Notice Pilot");await page.locator("#room-code").fill("ZZZZZZ");await page.locator("#join-room").click();const notice=page.locator(".toast");await expect(notice).toHaveCount(1);await expect.poll(()=>notice.evaluate((e:HTMLElement)=>Number(getComputedStyle(e).opacity))).toBeGreaterThan(.99);
 await notice.evaluate((node:HTMLElement)=>{
  const events:any[]=[];(window as any).__NOTICE_MOTION__=events;
  const hidden=new MutationObserver(()=>{const s=getComputedStyle(node);events.push({kind:"hidden",at:performance.now(),hidden:node.hidden,display:s.display,interactivity:s.getPropertyValue("interactivity"),supported:CSS.supports("interactivity","inert")&&CSS.supports("transition-behavior","allow-discrete")});});hidden.observe(node,{attributes:true,attributeFilter:["hidden"]});
  const removed=new MutationObserver(records=>{if(records.some(r=>[...r.removedNodes].includes(node))){events.push({kind:"removed",at:performance.now()});hidden.disconnect();removed.disconnect();}});removed.observe(node.parentElement!,{childList:true});
 });
 await expect.poll(()=>page.evaluate(()=>(window as any).__NOTICE_MOTION__.some((e:any)=>e.kind==="removed"))).toBe(true);
 const events=await page.evaluate(()=>(window as any).__NOTICE_MOTION__),hidden=events.find((e:any)=>e.kind==="hidden"),removed=events.find((e:any)=>e.kind==="removed");expect(hidden.hidden).toBe(true);if(hidden.supported){expect(hidden.interactivity).toBe("inert");expect(hidden.display).not.toBe("none");expect(removed.at-hidden.at).toBeGreaterThan(50);}await expect(notice).toHaveCount(0);await writeFile(info.outputPath("notice-motion.json"),JSON.stringify(events,null,2));
});
