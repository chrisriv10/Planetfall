import {test,expect,type Page,type BrowserContext} from "@playwright/test";
const browserErrors=new Map<Page,string[]>();
const watch=(page:Page)=>{if(browserErrors.has(page))return;const errors:string[]=[];browserErrors.set(page,errors);page.on("pageerror",e=>errors.push(e.message));};
test.afterEach(()=>{expect([...browserErrors.values()].flat()).toEqual([]);browserErrors.clear();});
const enter=async(page:Page,name:string)=>{watch(page);await page.goto("/");await expect(page.locator("#create-room")).toBeEnabled();await page.getByLabel("Name",{exact:true}).fill(name);};
// The restart consumes the state earned by the preceding genuine match. Keep
// these serial so a failed prerequisite skips restart rather than inventing data.
test.describe.serial("earned Career durability",()=>{
let earnedStorage:Awaited<ReturnType<BrowserContext["storageState"]>>|undefined;
let savedCareer="";
test("first-time help, real public Classic match, Career and reload",async({browser},info)=>{
  const started=Date.now(),stage=(name:string)=>console.log(`Classic journey: ${name} at ${Date.now()-started}ms`);
  const ca=await browser.newContext(),cb=await browser.newContext(),a=await ca.newPage(),b=await cb.newPage();
  let snapshot:any;
  a.on("websocket",ws=>ws.on("framereceived",frame=>{const packet=String(frame.payload);if(packet.startsWith("42")){try{const [event,data]=JSON.parse(packet.slice(packet.indexOf("[")));if(event==="match:snapshot")snapshot=data;}catch{}}}));
  try{
    await enter(a,"First pilot");await enter(b,"Second pilot");stage("connected");
    await a.screenshot({path:info.outputPath("main-menu.png")});
    await a.locator("#help-home").click();const help=a.getByRole("dialog",{name:"How to play"});
    await expect(help).toBeVisible();await expect(help.getByRole("heading",{name:"Know the essentials"})).toBeVisible();
    await a.screenshot({path:info.outputPath("how-to-play.png")});
    await a.keyboard.press("Escape");await expect(help).toBeHidden();
    await a.locator("#quick-match").click();await expect(a.locator("#lobby-screen")).toBeVisible();
    await expect(a.getByLabel("Quick Match",{exact:true})).toContainText("1 human found");
    await b.locator("#quick-match").click();await expect(b.locator("#lobby-screen")).toBeVisible();
    expect(await a.locator("#lobby-code").innerText()).toBe(await b.locator("#lobby-code").innerText());
    await expect(a.getByLabel("Quick Match",{exact:true})).toContainText("2 humans found");
    await a.screenshot({path:info.outputPath("quick-lobby.png")});
    await a.locator("#ready-button").click();await b.locator("#ready-button").click();await a.locator("#start-button").click();stage("started");
    await expect(a.locator("#hud")).toBeVisible();await expect(b.locator("#hud")).toBeVisible();
    await expect.poll(()=>snapshot?.phase).toBe("playing");const before=snapshot.players.find((p:any)=>p.name==="First pilot");const startPosition={...before.position},sequence=before.lastInputSequence;
    await a.bringToFront();await a.locator("#game-canvas").click({position:{x:700,y:380}});await a.keyboard.down("w");await a.waitForTimeout(700);await a.keyboard.up("w");await a.keyboard.press("Space");
    await expect.poll(()=>{const p=snapshot.players.find((p:any)=>p.name==="First pilot");return p.lastInputSequence>sequence&&Math.hypot(p.position.x-startPosition.x,p.position.y-startPosition.y,p.position.z-startPosition.z)>.1;}).toBe(true);
    stage("authoritative movement");
    // Real authoritative timer/possible overtime, no injected result or winner.
    await expect(a.locator("#results-screen")).toBeVisible({timeout:75_000});
    stage("results");
    await expect(a.locator("#winner-copy")).toHaveText("Time expired with tied planet integrity.");
    await a.screenshot({path:info.outputPath("classic-results.png")});
    await expect(a.locator("#results-screen")).toContainText("Rewards and Career saved.");
    await a.locator("#career-results-screen").click();const career=a.getByRole("dialog",{name:"Career",exact:true});await expect(career).toBeVisible();
    await expect(career.getByText(/^1 completed · \d+ won$/)).toBeVisible();await expect(career.getByText("First Landing",{exact:true})).toBeVisible();
    await a.screenshot({path:info.outputPath("career-earned.png")});await a.keyboard.press("Escape");
    const previousCode=await a.locator("#lobby-code").innerText();await a.locator("#find-another-match").click();
    await expect(a.locator("#lobby-screen")).toBeVisible();await expect(a.getByLabel("Quick Match",{exact:true})).toContainText("1 human found");
    expect(await a.locator("#lobby-code").innerText()).not.toBe(previousCode);
    await a.getByLabel("Quick Match",{exact:true}).getByRole("button",{name:"Cancel",exact:true}).click();await expect(a.locator("#home-screen")).toBeVisible();
    await a.reload();await expect(a.locator("#create-room")).toBeEnabled();await a.locator("#career-home").click();await expect(career.getByText(/^1 completed · \d+ won$/)).toBeVisible();
    savedCareer=await career.innerText();earnedStorage=await ca.storageState();
  }catch(error){console.error("Classic journey failure",{phase:snapshot?.phase},error);throw error;}
  finally{await Promise.allSettled([ca.close(),cb.close()]);}
});
test("earned Career survives an isolated server process restart",async({browser,request})=>{
  expect(earnedStorage).toBeDefined();
  expect((await request.post("http://127.0.0.1:25482/restart")).ok()).toBe(true);
  const context=await browser.newContext({storageState:earnedStorage}),page=await context.newPage();
  try{
    watch(page);await page.goto("/");await expect(page.locator("#create-room")).toBeEnabled();await page.locator("#career-home").click();
    await expect(page.getByRole("dialog",{name:"Career",exact:true})).toHaveText(savedCareer,{useInnerText:true});
  }finally{await context.close();}
});
});
test("private invite prefill requires confirmation and keeps room identity",async({browser},info)=>{
  const ca=await browser.newContext({permissions:["clipboard-read","clipboard-write"]}),cb=await browser.newContext(),a=await ca.newPage(),b=await cb.newPage();
  try{
    await enter(a,"Invite host");await a.locator("#create-room").click();await expect(a.locator("#lobby-screen")).toBeVisible();const code=await a.locator("#lobby-code").innerText();
    await a.locator("#invite-planetfall").click();const link=await a.evaluate(()=>navigator.clipboard.readText());expect(link).toContain("room="+code);expect(link).not.toMatch(/token|credential|session/i);
    watch(b);await b.goto(link);await expect(b.locator("#home-screen")).toBeVisible();await expect(b.locator("#room-code")).toHaveValue(code);await expect(b.locator("#lobby-screen")).toBeHidden();
    await b.reload();await expect(b.locator("#room-code")).toHaveValue(code);await b.getByLabel("Name",{exact:true}).fill("Invited pilot");await expect(b.locator("#join-room")).toBeEnabled();await b.locator("#join-room").click();
    await expect(b.locator("#lobby-code")).toHaveText(code);await expect(a.locator("#player-list")).toContainText("Invited pilot");await a.screenshot({path:info.outputPath("private-invite.png")});
    await a.locator("#ready-button").click();await b.locator("#ready-button").click();await a.locator("#start-button").click();
    await expect(a.locator("#hud")).toBeVisible();await expect(b.locator("#hud")).toBeVisible();
    await a.locator("#game-canvas").click({position:{x:700,y:380}});await a.keyboard.press("Escape");await expect(a.locator("#pause-overlay")).toBeVisible();await a.locator("#pause-leave").click();await expect(a.locator("#home-screen")).toBeVisible();
    await expect(b.locator("#results-screen")).toBeVisible();await b.locator("#leave-button").click();await expect(b.locator("#home-screen")).toBeVisible();
  }finally{await ca.close();await cb.close();}
});
test("one-human search exposes optional honest bots after bounded wait",async({page},info)=>{
  await enter(page,"Solo search");await page.locator("#quick-match").click();const quick=page.getByLabel("Quick Match",{exact:true});await expect(quick).toContainText("1 human found");
  const bots=quick.getByRole("button",{name:/Start with bots/});await expect(bots).toBeDisabled();await expect(bots).toBeEnabled({timeout:20_000});
  await page.screenshot({path:info.outputPath("optional-bots.png")});await bots.click();await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#results-screen")).toBeVisible({timeout:75_000});await expect(page.locator("#results-screen")).toContainText("Rewards and Career saved.");
});
test("help and Career fit narrow view and restore focus",async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await enter(page,"Narrow pilot");await page.locator("#help-home").click();let modal=page.getByRole("dialog",{name:"How to play"});await expect(modal).toBeVisible();
  await modal.getByRole("button",{name:"PlanetGun",exact:true}).click();await expect(modal).toContainText("PlanetZombies");await page.screenshot({path:info.outputPath("help-narrow.png")});await page.keyboard.press("Escape");await expect(page.locator("#help-home")).toBeFocused();
  await page.locator("#career-home").click();modal=page.getByRole("dialog",{name:"Career",exact:true});await expect(modal).toBeVisible();await expect(modal.getByText("First Landing",{exact:true})).toBeVisible();expect(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  await page.screenshot({path:info.outputPath("career-narrow.png")});
  // Standard-controller hardware emulation only; no application state injection.
  await page.evaluate(()=>Object.defineProperty(navigator,"getGamepads",{configurable:true,value:()=>[{id:"Experience test pad",index:0,connected:true,mapping:"standard",timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:i===1,touched:i===1,value:i===1?1:0}))}]}));
  await expect(modal).toBeHidden();await expect(page.locator("#career-home")).toBeFocused();
  await page.evaluate(()=>Reflect.deleteProperty(navigator,"getGamepads"));
});
