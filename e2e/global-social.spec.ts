import {expect,test,type Page} from "@playwright/test";
import {selectExperimentalFamily} from "./select-family";

// The existing accounts fixture uses isolated PostgreSQL (PGlite) and an
// accelerated local match clock. No production profiles or synthetic scores.
test.use({baseURL:"http://127.0.0.1:25173",channel:"chromium",viewport:{width:1280,height:900}});

const online=(page:Page)=>page.locator("#home-online-count");
const panel=(page:Page)=>page.getByRole("dialog",{name:"Global Leaderboard"});
const rows=(page:Page)=>panel(page).locator("tbody tr");
async function enter(page:Page){
  await page.goto("/");
  await expect(page.locator("#create-room")).toBeEnabled();
}
async function openBoard(page:Page){
  await page.locator("#leaderboard-home").click();
  await expect(panel(page)).toHaveAttribute("data-state","ready");
}
async function publish(page:Page,name:string){
  await openBoard(page);
  await panel(page).getByLabel("Public pilot name").fill(name);
  await panel(page).getByRole("button",{name:"Publish name & XP"}).click();
  await expect(rows(page).filter({hasText:name})).toHaveClass(/is-you/);
}

test("global rankings use earned XP and menu presence follows unique verified guests",async({page,browser,baseURL},info)=>{
  await enter(page);
  await expect(online(page)).toHaveText("1");
  const compact=await browser.newContext({baseURL,viewport:{width:390,height:844},reducedMotion:"reduce"});
  try{
    const other=await compact.newPage();
    await enter(other);
    await expect(online(page)).toHaveText("2");
    await expect(online(other)).toHaveText("2");
    await page.screenshot({path:info.outputPath("main-menu-online.png")});
    const duplicate=await page.context().newPage();
    await enter(duplicate);
    await expect(online(duplicate)).toHaveText("2");
    await duplicate.close();
    await expect(online(page)).toHaveText("2");

    await selectExperimentalFamily(other,"planet-gun");
    await other.getByLabel("Name",{exact:true}).fill("Earned Nova");
    await other.locator("#create-room").click();
    await expect(other.locator("#pg-lobby-screen")).toHaveClass(/active/);
    await expect(online(page)).toHaveText("2");
    await other.locator("#pg-leave-lobby").click();
    await expect(online(other)).toHaveText("2");
    await other.locator("#family-planetfall").click();
    await other.locator("#play-solo").click();
    await expect(other.locator("#results-screen")).toHaveClass(/active/,{timeout:40_000});
    await other.locator("#leave-button").click();
    await expect(online(other)).toHaveText("2");

    await publish(other,"Earned Nova");
    const score=Number((await rows(other).filter({hasText:"Earned Nova"}).locator(".global-leaderboard-xp").innerText()).replace(/\D/g,""));
    expect(score).toBeGreaterThan(0);
    await other.screenshot({path:info.outputPath("leaderboard-compact.png")});
    await expect(panel(other)).toBeInViewport();
    expect(await other.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
    await other.keyboard.press("Escape");
    await expect(other.locator("#leaderboard-home")).toBeFocused();

    await publish(page,"New Vega");
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).first()).toContainText("Earned Nova");
    await expect(rows(page).last()).toContainText("#2");
    await expect(rows(page).last()).toHaveClass(/is-you/);
    await expect(panel(page).locator(".global-leaderboard-personal")).toContainText("#2");
    await page.screenshot({path:info.outputPath("leaderboard-desktop.png")});
    await page.keyboard.press("Escape");
    await expect(page.locator("#leaderboard-home")).toBeFocused();
    await other.close();
    await expect(online(page)).toHaveText("1");
    await openBoard(page);
    await expect(rows(page).first()).toContainText("Earned Nova");
    await panel(page).getByRole("button",{name:"Remove my listing"}).click();
    await expect(rows(page)).toHaveCount(1);
  }finally{await compact.close();}
});

test("a failed leaderboard request can be retried without blocking the menu",async({page})=>{
  let interrupted=false;
  await page.routeWebSocket(/\/socket\.io\//,ws=>{
    const server=ws.connectToServer();
    ws.onMessage(message=>{
      const request=typeof message==="string"?/^42(\d+)\["leaderboard:read"\]$/.exec(message):null;
      if(request&&!interrupted){
        interrupted=true;
        ws.send("43"+request[1]+JSON.stringify([{ok:false,error:"The leaderboard is temporarily unavailable. Try again."}]));
      }else server.send(message);
    });
    server.onMessage(message=>ws.send(message));
  });
  await enter(page);
  await page.locator("#leaderboard-home").click();
  await expect(panel(page)).toHaveAttribute("data-state","error");
  expect(interrupted).toBe(true);
  await panel(page).getByRole("button",{name:"Try again"}).click();
  await expect(panel(page)).toHaveAttribute("data-state","ready");
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await expect(page.locator("#leaderboard-home")).toBeFocused();
  await page.getByLabel("Name",{exact:true}).fill("Retry Pilot");
  await page.locator("#create-room").click();
  await expect(page.locator("#lobby-screen")).toHaveClass(/active/);
});
