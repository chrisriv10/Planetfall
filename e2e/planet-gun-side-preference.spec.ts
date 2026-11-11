import {expect,test} from "@playwright/test";
import {openLobbyConfiguration,selectExperimentalFamily} from "./select-family";

test("Strike confirms preferred sides, rolls back illegal balance changes and hides Deathmatch kits",async({browser})=>{
 const context=await browser.newContext(),host=await context.newPage(),guest=await context.newPage();
 try{
  for(const [page,name]of [[host,"Side Host"],[guest,"Side Guest"]]as const){await page.goto("/");await page.getByLabel("Name",{exact:true}).fill(name);await selectExperimentalFamily(page,"planet-gun");}
  await host.locator("#create-room").click();await host.getByLabel("PlanetGun submode").selectOption("planetstrike");
  await host.getByLabel("Preferred starting side").selectOption("defend");await expect(host.locator(".pg-side-preference")).toContainText("STARTING DEFEND");
  await expect(host.locator("#pg-edit-kits")).toBeHidden();
  const code=await host.locator("#pg-code").innerText();await guest.locator("#room-code").fill(code);await guest.locator("#join-room").click();
  await expect(guest.locator(".pg-side-preference")).toContainText("STARTING ATTACK");
  await guest.getByLabel("Preferred starting side").selectOption("defend");await expect(guest.locator(".pg-side-preference")).toContainText("STARTING DEFEND");
  // This requested change is intentionally rejected and immediately rolled back;
  // click expresses the intent without assuming a stable unchecked state.
  await openLobbyConfiguration(host);await host.locator("#pg-fill").click();
  await expect(host.locator("#toast-region")).toContainText("balanced without bot fill");await expect(host.locator("#pg-fill")).toBeChecked();
  await guest.getByLabel("Preferred starting side").selectOption("auto");await expect(guest.locator(".pg-side-preference")).toContainText("STARTING ATTACK");
  await host.locator("#pg-fill").uncheck();await expect(host.locator("#pg-fill")).not.toBeChecked();
  await guest.locator("#pg-ready").click();await host.locator("#pg-ready").click();await host.locator("#pg-start").click();
  await expect(host.locator("#pg-hud")).toBeVisible();await expect(host.locator(".pg-mode-presentation .pg-mode-status")).toContainText("DEFEND");
  await host.keyboard.press("Escape");await expect(host.locator("#resume-button")).toBeVisible();await expect(host.locator("#pause-kits")).toBeHidden();
  await host.locator("#pause-leave").click();await expect(host.locator("#home-screen")).toBeVisible();
 }finally{await context.close();}
});
