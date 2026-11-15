import {expect,test,type Page} from "@playwright/test";
import {selectExperimentalFamily} from "./select-family";

const ready=(page:Page)=>expect(page.locator("#create-room")).toBeEnabled();
const panel=(page:Page)=>page.locator("#account-overlay");
const balance=(page:Page)=>panel(page).locator(".account-stat").filter({hasText:"Fallbucks"}).locator("dd");
const signedIn=(page:Page)=>expect(panel(page)).toHaveAttribute("data-state","signed-in");

async function earnGuestProgress(page:Page) {
  await page.getByLabel("Name",{exact:true}).fill("Guest Flight One");
  await page.locator("#play-solo").click();
  await expect(page.locator("#results-screen")).toHaveClass(/active/,{timeout:40_000});
  await page.locator("#leave-button").click();
  await ready(page);
}

async function openAccount(page:Page) {
  await page.locator("#account-home").click();
  await expect(panel(page)).toBeVisible();
}

async function signIn(page:Page) {
  await openAccount(page);
  await panel(page).getByRole("button",{name:"Sign in with Google"}).click();
  await signedIn(page);
  await expect(balance(page)).not.toHaveText("—");
}

test("a real guest match survives account linking and carries into PlanetGun on another browser",async({page,browser,baseURL},testInfo)=>{
  await page.goto("/");
  await ready(page);
  await openAccount(page);
  await expect(panel(page)).toHaveAttribute("data-state","guest");
  await panel(page).screenshot({path:testInfo.outputPath("guest-account-panel.png")});
  await panel(page).getByRole("button",{name:"Continue as Guest"}).click();
  await earnGuestProgress(page);

  await page.locator("#settings-open").click();
  await page.locator("#graphics-quality").selectOption("low");
  await page.locator("#invert-y").check();
  await page.locator("#account-settings").click();
  await expect(panel(page)).toHaveAttribute("data-state","guest");
  await expect(balance(page)).not.toHaveText("0");
  const earned=await balance(page).innerText();
  await panel(page).getByRole("button",{name:"Sign in with Google"}).click();
  await signedIn(page);
  await expect(balance(page)).toHaveText(earned);
  await expect(panel(page)).toContainText("Guest progress linked");
  await panel(page).screenshot({path:testInfo.outputPath("signed-in-account-panel.png")});
  // Signed-in preferences are written separately from the hardware preset.
  await expect.poll(async()=>{
    const response=await page.evaluate(()=>fetch("/api/account/session",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}).then(res=>res.json()));
    return response.preferences?.value?.controls?.invertY;
  }).toBe(true);

  await panel(page).getByRole("button",{name:"Sign Out",exact:true}).click();
  await expect(panel(page)).toHaveAttribute("data-state","guest");
  await expect(panel(page)).not.toContainText("Stella Pilot");
  await expect(balance(page)).toHaveText("0");
  await panel(page).getByRole("button",{name:"Continue as Guest"}).click();
  await ready(page);
  await page.close();

  const second=await browser.newContext({baseURL,viewport:{width:930,height:650}});
  try {
    const device=await second.newPage();
    await device.goto("/");
    await ready(device);
    await signIn(device);
    await expect(balance(device)).toHaveText(earned);
    await device.keyboard.press("Escape");
    await device.locator("#settings-open").click();
    await expect(device.locator("#invert-y")).toBeChecked();
    await expect(device.locator("#graphics-quality")).toHaveValue("auto");
    await device.locator("#settings-close").click();

    await selectExperimentalFamily(device,"planet-gun");
    await device.getByLabel("Name",{exact:true}).fill("Same Account Other Device");
    await device.locator("#create-room").click();
    await expect(device.locator("#pg-lobby-screen")).toHaveClass(/active/);
    await device.locator("#pg-shop").click();
    await expect(device.locator("#shop-balance")).toHaveText(earned.replace(/[^\d]/g,""));
    await device.locator("#shop-close").click();
  } finally {await second.close();}
});

test("switching accounts leaves the room and loads only the new pilot preferences",async({page,context,baseURL})=>{
  await context.addCookies([{name:"pf-test-selected",value:"switch-from",url:baseURL!}]);
  await page.goto("/");
  await ready(page);
  await signIn(page);
  await page.keyboard.press("Escape");
  await page.locator("#settings-open").click();
  await page.locator("#invert-y").check();
  await page.locator("#settings-close").click();
  await page.getByLabel("Name",{exact:true}).fill("Switch Account Pilot");
  await page.locator("#create-room").click();
  await expect(page.locator("#lobby-screen")).toHaveClass(/active/);
  // The new verified user deliberately has the same display name as the old user.
  await context.addCookies([{name:"pf-test-selected",value:"switch-to",url:baseURL!}]);
  await page.locator("#settings-lobby").click();
  await page.locator("#account-settings").click();
  await panel(page).getByRole("button",{name:"Switch Account"}).click();
  await signedIn(page);
  await expect(balance(page)).toHaveText("0");
  await expect(page.locator("#home-screen")).toHaveClass(/active/);
  await page.keyboard.press("Escape");
  await page.locator("#settings-open").click();
  await expect(page.locator("#invert-y")).not.toBeChecked();
});

test("a revoked provider cookie recovers guest controls and progression safely",async({page,context,baseURL})=>{
  await context.addCookies([{name:"pf-test-selected",value:"revocation-pilot",url:baseURL!}]);
  await page.goto("/");
  await ready(page);
  await signIn(page);
  const cookie=(await context.cookies()).find(cookie=>cookie.name==="pf-test-session")!;
  await page.request.post("http://127.0.0.1:23000/__test/revoke",{headers:{cookie:`${cookie.name}=${cookie.value}`}});
  await page.reload();
  await ready(page);
  await openAccount(page);
  await expect(panel(page)).toHaveAttribute("data-state","guest");
  await expect(panel(page)).not.toContainText("Stella Pilot");
  await panel(page).getByRole("button",{name:"Continue as Guest"}).click();
  await page.getByLabel("Name",{exact:true}).fill("Guest After Expiry");
  await page.locator("#create-room").click();
  await expect(page.locator("#lobby-screen")).toHaveClass(/active/);
});

test("the conflict screen keeps the earned guest wallet separate from an existing account",async({page,context,browser,baseURL},testInfo)=>{
  const existing=await browser.newContext({baseURL});
  try {
    await existing.addCookies([{name:"pf-test-selected",value:"conflict-pilot",url:baseURL!}]);
    const owner=await existing.newPage();
    await owner.goto("/");
    await ready(owner);
    await signIn(owner);
    await expect(balance(owner)).toHaveText("0");
  } finally {await existing.close();}
  await context.addCookies([{name:"pf-test-selected",value:"conflict-pilot",url:baseURL!}]);
  await page.goto("/");
  await ready(page);
  await earnGuestProgress(page);
  await openAccount(page);
  await expect(balance(page)).not.toHaveText("0");
  const guestWallet=await balance(page).innerText();
  await panel(page).getByRole("button",{name:"Sign in with Google"}).click();
  await expect(panel(page)).toHaveAttribute("data-state","conflict");
  await panel(page).screenshot({path:testInfo.outputPath("account-conflict.png")});
  await panel(page).getByRole("button",{name:"Keep playing as guest"}).click();
  await expect(panel(page)).toBeHidden();
  await ready(page);
  await openAccount(page);
  await expect(balance(page)).toHaveText(guestWallet);
  await panel(page).getByRole("button",{name:"Sign in with Google"}).click();
  await expect(panel(page)).toHaveAttribute("data-state","conflict");
  const decision=page.waitForResponse(response=>new URL(response.url()).pathname==="/api/account/session"&&
    response.request().postDataJSON()?.choice==="existing");
  await panel(page).getByRole("button",{name:"Continue with account progress"}).click();
  expect((await decision).status()).toBe(200);
  await signedIn(page);
  await expect(balance(page)).toHaveText("0");
  await panel(page).getByRole("button",{name:"Sign Out",exact:true}).click();
  await expect(balance(page)).toHaveText(guestWallet);
});
