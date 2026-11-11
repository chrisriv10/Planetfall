import {expect,test,type Locator,type Page} from "@playwright/test";
import {SHOP_CATALOG} from "@planetfall/shared";
import {selectExperimentalFamily} from "./select-family";

const categories=["SUITS","TRAILS","EMOTES","VICTORY","PLANETS","WEAPON FINISHES","CALLING CARDS","EMBLEMS"] as const;
const purchasable=SHOP_CATALOG.filter(item=>!item.passLevel);

async function observeRendering(page:Page):Promise<string[]>{
 const errors:string[]=[];
 page.on("pageerror",error=>errors.push(error.message));
 page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
 await page.addInitScript(()=>{
  const audit:{canvas:HTMLCanvasElement;type:string}[]=[],seen=new WeakMap<HTMLCanvasElement,Set<string>>();
  (window as unknown as {__cosmeticContextAudit:typeof audit}).__cosmeticContextAudit=audit;
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){
   const result=Reflect.apply(original,this,[type,...args]);
   if(result){const types=seen.get(this)??new Set<string>();if(!types.has(type)){types.add(type);seen.set(this,types);audit.push({canvas:this,type});}}
   return result;
  } as typeof original;
 });
 return errors;
}
async function contextCounts(page:Page){
 return page.evaluate(()=>{
  const audit=(window as unknown as {__cosmeticContextAudit:{canvas:HTMLCanvasElement;type:string}[]}).__cosmeticContextAudit;
  const webgl=audit.filter(entry=>entry.type==="webgl"||entry.type==="webgl2"||entry.type==="experimental-webgl");
  return {webgl:webgl.length,cardWebgl:webgl.filter(entry=>entry.canvas.closest(".shop-cosmetic-preview")).length};
 });
}
async function expectRenderedPreview(canvas:Locator){
 await expect(canvas).toBeVisible();
 await expect.poll(()=>canvas.evaluate((node:HTMLCanvasElement)=>{
  const context=node.getContext("2d");
  return !!context&&context.getImageData(0,0,node.width,node.height).data.some((value,index)=>index%4===3&&value>0);
 })).toBe(true);
}
async function expectNoViewportOverflow(page:Page){
 expect(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth)).toBeLessThanOrEqual(1);
}
async function openHomeShop(page:Page){
 await page.locator("#shop-home").click();await expect(page.locator("#shop-overlay")).toBeVisible();
 await expect(page.locator("#shop-note")).toContainText("JOIN A ROOM TO EARN AND SPEND FALLBUCKS");
}
async function createLobby(page:Page){
 await page.getByLabel("Name",{exact:true}).fill("Cosmetic Browser");await page.locator("#create-room").click();
 await expect(page.locator("#lobby-screen")).toBeVisible();
}

test("global Shop exposes all 47 purchasable cosmetics with canonical previews and compatibility",async({page})=>{
 const errors=await observeRendering(page);await page.goto("/");
 await expect.poll(async()=>(await contextCounts(page)).webgl).toBeGreaterThan(0);
 const before=await contextCounts(page);await openHomeShop(page);
 await expect(page.locator("#shop-families button")).toHaveText(["ALL","PLANETFALL","PLANETROYALE","PLANETRUN","PLANETGUN"]);
 await expect(page.locator("#shop-categories button")).toHaveText([...categories]);
 await expectRenderedPreview(page.locator("#shop-grid .cosmetic-preview-image").first());
 const initial=await contextCounts(page);
 expect(initial.webgl-before.webgl,"a grid shares one preview renderer rather than creating one per card").toBe(1);
 expect(initial.cardWebgl).toBe(0);
 const ids:string[]=[];
 for(const category of categories){
  await page.locator("#shop-categories").getByRole("button",{name:category,exact:true}).click();
  const cards=page.locator("#shop-grid .shop-item[data-cosmetic-id]");expect(await cards.count(),category).toBeGreaterThan(0);
  ids.push(...await cards.evaluateAll(elements=>elements.map(element=>(element as HTMLElement).dataset.cosmeticId!)));
  for(const button of await cards.getByRole("button").all())await expect(button).toBeDisabled();
  for(const copy of await cards.locator(".shop-compatibility").all())await expect(copy).toHaveText(/PLANETFALL|PLANETROYALE|PLANETRUN|PLANETGUN/);
  if(category==="CALLING CARDS"||category==="EMBLEMS"){
   await expect(cards.locator(".shop-cosmetic-preview > svg")).toHaveCount(await cards.count());
   await expect(cards.locator("canvas")).toHaveCount(0);
  }else await expectRenderedPreview(cards.first().locator("canvas"));
 }
 expect(SHOP_CATALOG).toHaveLength(52);expect(purchasable).toHaveLength(47);
 expect(ids.sort()).toEqual(purchasable.map(item=>item.id).sort());expect(new Set(ids).size).toBe(47);
 expect((await contextCounts(page)).cardWebgl).toBe(0);
 await expect(page.locator("#shop-overlay [data-preview-unavailable]")).toHaveCount(0);
 await page.locator("#shop-close").click();await expect(page.locator("#shop-overlay")).toBeHidden();expect(errors).toEqual([]);
});

test("a PlanetGun home selection can browse global planets while the PlanetGun filter excludes them",async({page})=>{
 const errors=await observeRendering(page);await page.goto("/");await selectExperimentalFamily(page,"planet-gun");await openHomeShop(page);
 await page.locator("#shop-families").getByRole("button",{name:"ALL",exact:true}).click();
 await page.locator("#shop-categories").getByRole("button",{name:"PLANETS",exact:true}).click();
 const planet=page.locator('#shop-grid .shop-item[data-cosmetic-id="verity"]');
 await expect(planet).toBeVisible();await expect(planet.locator(".shop-compatibility")).toHaveText("PLANETFALL");await expect(planet.getByRole("button")).toBeDisabled();
 await expectRenderedPreview(planet.locator("canvas"));
 await page.locator("#shop-families").getByRole("button",{name:"PLANETGUN",exact:true}).click();
 await expect(page.locator("#shop-grid .shop-item")).toHaveCount(0);
 await page.locator("#shop-categories").getByRole("button",{name:"WEAPON FINISHES",exact:true}).click();
 await expect(page.locator("#shop-grid .shop-item")).toHaveCount(5);
 const finish=page.locator('#shop-grid .shop-item[data-cosmetic-id="finish-solar-alloy"]');
 await expect(finish.locator(".shop-compatibility")).toHaveText("PLANETGUN");await expectRenderedPreview(finish.locator("canvas"));
 await expect(page.locator('#shop-grid [data-cosmetic-id="finish-orbital-champion"]')).toHaveCount(0);
 await page.locator("#shop-families").getByRole("button",{name:"ALL",exact:true}).click();
 await page.locator("#shop-categories").getByRole("button",{name:"PLANETS",exact:true}).click();await expect(planet).toBeVisible();
 expect(errors).toEqual([]);
});

test("the 50-tier Pass shows fresh authoritative progress and navigates chapters and rewards with real input",async({page})=>{
 const errors=await observeRendering(page);await page.goto("/");await createLobby(page);await page.locator("#pass-lobby").click();
 const overlay=page.locator("#pass-overlay"),track=page.locator("#pass-track");await expect(overlay).toBeVisible();
 await expect(page.locator(".pass-chapters button")).toHaveText(["1–10","11–20","21–30","31–40","41–50"]);
 await expect(track.locator("article[data-level]")).toHaveCount(50);
 expect(await track.locator("article").evaluateAll(elements=>elements.map(element=>Number((element as HTMLElement).dataset.level)))).toEqual(Array.from({length:50},(_,index)=>index+1));
 await expect(track.locator(".milestone")).toHaveCount(5);
 await expect(track.locator('.current.unlocked[data-level="1"]')).toContainText("CURRENT");
 await expect(track.locator('.unlocked')).toHaveCount(1);await expect(track.locator('.pass-reward-state').filter({hasText:/^LOCKED$/})).toHaveCount(49);
 await expect(page.locator("#pass-level")).toHaveText("LEVEL 1");await expect(page.locator("#pass-xp-copy")).toHaveText("0 / 100 XP");
 const start=await track.evaluate(element=>element.scrollLeft);await track.hover();await page.mouse.wheel(550,0);
 await expect.poll(()=>track.evaluate(element=>element.scrollLeft)).toBeGreaterThan(start);
 const chapter=page.locator(".pass-chapters").getByRole("button",{name:"41–50",exact:true});await chapter.focus();await page.keyboard.press("Enter");
 await expect(track.locator('[data-level="41"]')).toBeInViewport();
 const last=track.locator('[data-level="50"]');await track.hover();await page.mouse.wheel(2000,0);await expect(last).toBeInViewport();
 await expect(last).toContainText("ORBITAL CHAMPION FINISH");await expect(last).toContainText("LOCKED");
 await expect(last.locator('.shop-cosmetic-preview[data-cosmetic-id="finish-orbital-champion"]')).toHaveCount(1);await expectRenderedPreview(last.locator("canvas"));
 await expect(track.locator('.cosmetic-kind-calling-card > svg')).not.toHaveCount(0);await expect(track.locator('.cosmetic-kind-emblem > svg')).not.toHaveCount(0);
 expect((await contextCounts(page)).cardWebgl).toBe(0);await expect(overlay.locator("[data-preview-unavailable]")).toHaveCount(0);
 await page.locator("#pass-close").click();await expect(overlay).toBeHidden();await expect(page.locator("#lobby-screen")).toBeVisible();expect(errors).toEqual([]);
});

for(const width of [390,864,1366])test(`expanded Shop and Pass controls fit a ${width}px viewport`,async({page},info)=>{
 await page.setViewportSize({width,height:864});const errors=await observeRendering(page);await page.goto("/");await openHomeShop(page);
 await page.locator("#shop-categories").getByRole("button",{name:"CALLING CARDS",exact:true}).click();
 await expect(page.locator("#shop-grid .shop-item")).toHaveCount(6);await expectNoViewportOverflow(page);
 const shopImage=info.outputPath(`shop-${width}.png`);await page.screenshot({path:shopImage});await info.attach(`Shop ${width}px`,{path:shopImage,contentType:"image/png"});
 const shopClose=page.locator("#shop-close");await shopClose.scrollIntoViewIfNeeded();await expect(shopClose).toBeInViewport();await shopClose.click();
 await createLobby(page);await page.locator("#pass-lobby").click();await expect(page.locator("#pass-overlay")).toBeVisible();
 await expect(page.locator("#pass-track article")).toHaveCount(50);await expectNoViewportOverflow(page);
 await page.locator(".pass-chapters").getByRole("button",{name:"41–50",exact:true}).click();
 await expect(page.locator('#pass-track [data-level="41"]')).toBeInViewport();
 const last=page.locator('#pass-track [data-level="50"]');await page.locator("#pass-track").hover();await page.mouse.wheel(2000,0);await expect(last).toBeInViewport();await expectRenderedPreview(last.locator("canvas"));
 await expectNoViewportOverflow(page);const passImage=info.outputPath(`pass-${width}.png`);await page.screenshot({path:passImage});await info.attach(`Planet Pass ${width}px`,{path:passImage,contentType:"image/png"});
 const passClose=page.locator("#pass-close");await passClose.scrollIntoViewIfNeeded();await expect(passClose).toBeInViewport();await passClose.click();
 await expect(page.locator("#pass-overlay")).toBeHidden();expect(errors).toEqual([]);
});
