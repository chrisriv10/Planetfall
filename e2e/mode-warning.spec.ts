import {expect,test} from "@playwright/test";
test("experimental family warnings preserve selection, trap focus and do not reappear on return",async({page})=>{
  await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Warning Pilot");await expect(page.locator("#family-planetfall")).toBeEnabled();
  await page.locator("#family-planetfall").click();await expect(page.locator("#mode-warning")).toBeHidden();
  for(const [id,stage]of [["br","LATE ALPHA"],["pr","ALPHA"],["pg","PROTOTYPE"]]){
    await page.locator(`#family-${id}`).click();await expect(page.locator("#mode-warning")).toBeVisible();
    await expect(page.locator("#mode-warning")).toContainText(stage);
    await expect(page.locator("#family-planetfall")).toHaveClass(/selected/);
    await page.keyboard.press("Shift+Tab");await expect(page.locator("#mode-warning-cancel")).toBeFocused();
    await page.keyboard.press("Tab");await expect(page.locator("#mode-warning-continue")).toBeFocused();
    await page.keyboard.press("Escape");await expect(page.locator("#mode-warning")).toBeHidden();
    await expect(page.locator("#family-planetfall")).toHaveClass(/selected/);
    await page.locator(`#family-${id}`).click();await page.locator("#mode-warning-cancel").click();
    await page.locator(`#family-${id}`).click();await page.locator("#mode-warning-continue").click();
    await expect(page.locator(`#family-${id}`)).toHaveClass(/selected/);
    await page.locator("#create-room").click();await page.locator(id==="br"?"#br-leave-lobby":id==="pr"?"#pr-leave-lobby":"#pg-leave-lobby").click();
    await expect(page.locator("#home-screen")).toBeVisible();await expect(page.locator("#mode-warning")).toBeHidden();
    expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();
    await page.locator("#family-planetfall").click();
  }
});
