import {test,expect} from "@playwright/test";

test("desktop capability keeps guest play available without embedded OAuth",async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,"planetfallDesktop",{value:Object.freeze({platform:"win32",guestOnly:true})}));
  const accountRequests:string[]=[];
  page.on("request",request=>{if(new URL(request.url()).pathname.startsWith("/api/account/"))accountRequests.push(request.method());});
  await page.goto("/");await expect(page.locator("#create-room")).toBeEnabled();
  // A normal desktop content height falls between the narrow/short breakpoints.
  // Keep the brand reachable at the top and the last action reachable by scroll.
  for(const viewport of [{width:1424,height:835},{width:960,height:575},{width:390,height:844}]){
    await page.setViewportSize(viewport);const card=page.locator("#home-screen .home-card");
    await card.evaluate(element=>element.scrollTo(0,0));
    const brand=await page.locator("#logo-title").boundingBox();expect(brand).not.toBeNull();expect(brand!.y).toBeGreaterThanOrEqual(0);expect(brand!.y+brand!.height).toBeLessThanOrEqual(viewport.height);
    expect(await card.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
    await page.locator("#home-presence").scrollIntoViewIfNeeded();const presence=await page.locator("#home-presence").boundingBox();expect(presence!.y).toBeGreaterThanOrEqual(0);expect(presence!.y+presence!.height).toBeLessThanOrEqual(viewport.height);
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator("#account-home").click();const panel=page.locator("#account-overlay");
  await expect(panel).toContainText("Windows");await expect(panel).toContainText("Open browser version");
  await expect(panel.getByRole("button",{name:"Sign in with Google",exact:true})).toBeHidden();
  await panel.getByRole("button",{name:"Continue as Guest",exact:true}).click();
  await page.getByLabel("Name",{exact:true}).fill("Desktop guest");await page.locator("#quick-match").click();
  await expect(page.locator("#lobby-screen")).toBeVisible();await expect(page.getByLabel("Quick Match",{exact:true})).toContainText("1 human found");
  await page.getByLabel("Quick Match",{exact:true}).getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(page.locator("#home-screen")).toBeVisible();await page.reload();await expect(page.locator("#create-room")).toBeEnabled();
  await expect(page.getByLabel("Name",{exact:true})).toHaveValue("Desktop guest");
  expect(accountRequests).toEqual([]);
});
