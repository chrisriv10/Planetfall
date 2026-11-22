import {test,expect,type Page} from "@playwright/test";

// Isolated account-provider fixture only. No real Google/production identity.
test("genuine guest Career follows account linking and a second browser",async({page,browser},info)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  const other=await browser.newContext(),wing=await other.newPage();
  const enter=async(p:Page,name:string)=>{await p.goto("/");await expect(p.locator("#create-room")).toBeEnabled();await p.getByLabel("Name",{exact:true}).fill(name);};
  const career=(p:Page)=>p.getByRole("dialog",{name:"Career",exact:true});
  try{
    await enter(page,"Career guest");await enter(wing,"Career wing");
    await page.locator("#quick-match").click();await wing.locator("#quick-match").click();
    expect(await page.locator("#lobby-code").innerText()).toBe(await wing.locator("#lobby-code").innerText());
    await page.locator("#ready-button").click();await wing.locator("#ready-button").click();await page.locator("#start-button").click();
    await expect(page.locator("#results-screen")).toBeVisible({timeout:45_000});
    await expect(page.locator("#results-screen")).toContainText("Rewards and Career saved.");
    await page.locator("#leave-button").click();await expect(page.locator("#create-room")).toBeEnabled();
    await page.locator("#career-home").click();await expect(career(page).getByText(/^1 completed · \d+ won$/)).toBeVisible();
    const earned=await career(page).locator(".experience-family-stats").innerText();
    await page.keyboard.press("Escape");await page.locator("#account-home").click();
    await page.locator("#account-overlay").getByRole("button",{name:"Sign in with Google"}).click();
    await expect(page.locator("#account-overlay")).toHaveAttribute("data-state","signed-in");
    await page.keyboard.press("Escape");await page.reload();await expect(page.locator("#create-room")).toBeEnabled();await page.locator("#career-home").click();
    await expect(career(page).locator(".experience-family-stats")).toHaveText(earned,{useInnerText:true});
    await expect(career(page).getByText("First Landing",{exact:true}).locator("..")).toContainText("Unlocked");
    await page.screenshot({path:info.outputPath("career-linked.png")});

    const second=await browser.newContext();
    try{
      const device=await second.newPage();device.on("pageerror",e=>errors.push(e.message));await device.goto("/");await expect(device.locator("#create-room")).toBeEnabled();
      await device.locator("#account-home").click();await device.locator("#account-overlay").getByRole("button",{name:"Sign in with Google"}).click();await expect(device.locator("#account-overlay")).toHaveAttribute("data-state","signed-in");
      await device.keyboard.press("Escape");await device.locator("#career-home").click();
      await expect(career(device).locator(".experience-family-stats")).toHaveText(earned,{useInnerText:true});
      await expect(career(device).getByText("First Landing",{exact:true}).locator("..")).toContainText("Unlocked");
      await device.screenshot({path:info.outputPath("career-second-device.png")});
      await device.reload();await expect(device.locator("#create-room")).toBeEnabled();await device.locator("#career-home").click();await expect(career(device).locator(".experience-family-stats")).toHaveText(earned,{useInnerText:true});
    }finally{await second.close();}
    expect(errors).toEqual([]);
  }finally{await other.close();}
});
