import {expect,type Page} from "@playwright/test";
export async function selectExperimentalFamily(page:Page,family:"battle-royale"|"planet-run"|"planet-gun"){
  await page.locator(family==="battle-royale"?"#family-br":family==="planet-run"?"#family-pr":"#family-pg").click();
  await expect(page.locator("#mode-warning")).toBeVisible();
  await page.locator("#mode-warning-continue").click();await expect(page.locator("#mode-warning")).toBeHidden();
}
