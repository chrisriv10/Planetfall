import {test,expect} from "@playwright/test";

test("desktop capability keeps guest play available without embedded OAuth",async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,"planetfallDesktop",{value:Object.freeze({platform:"win32",guestOnly:true})}));
  const accountRequests:string[]=[];
  page.on("request",request=>{if(new URL(request.url()).pathname.startsWith("/api/account/"))accountRequests.push(request.method());});
  await page.goto("/");await expect(page.locator("#create-room")).toBeEnabled();
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
