import {expect,type Page} from "@playwright/test";
/** Inspecting a portrait is a draft; confirmation applies the authoritative selection. */
export async function selectPgCharacter(page:Page,id:string,primary?:string){
  await page.locator(".screen.active .pg-character-open").click();
  const screen=page.locator("#pg-character-selection-screen");
  await expect(screen).toBeVisible();
  await screen.locator(`[data-character-id="${id}"]`).click();
  await expect(screen.locator(`[data-character-id="${id}"]`)).toHaveAttribute("aria-pressed","true");
  if(primary)await screen.getByLabel("Primary weapon",{exact:true}).selectOption(primary);
  await screen.locator(".pg-selection-confirm").click();
  await expect(screen).toBeHidden();
}
/** Host settings are deliberately collapsed in the social ready room. */
export async function openLobbyConfiguration(page:Page){
  const settings=page.locator(".screen.active.ready-room .lobby-configuration");
  await expect(settings).toBeVisible();
  if(!await settings.evaluate(element=>(element as HTMLDetailsElement).open))await settings.locator(":scope > summary").click();
}
/** Capturing gameplay is a UI action; the next separate press aims/fires. */
export async function capturePgMouse(page:Page){
  if(await page.evaluate(()=>document.pointerLockElement?.id==="game-canvas"))return;
  const size=await page.locator("#game-canvas").boundingBox();expect(size).not.toBeNull();
  await page.locator("#game-canvas").click({position:{x:size!.width/2,y:size!.height/2}});
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("game-canvas");
}
export async function selectExperimentalFamily(page:Page,family:"battle-royale"|"planet-run"|"planet-gun"){
  await page.locator(family==="battle-royale"?"#family-br":family==="planet-run"?"#family-pr":"#family-pg").click();
  await expect(page.locator("#mode-warning")).toBeVisible();
  await page.locator("#mode-warning-continue").click();await expect(page.locator("#mode-warning")).toBeHidden();
}
