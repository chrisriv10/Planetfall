import {test,expect} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {selectExperimentalFamily,openLobbyConfiguration} from "./select-family";
test.use({channel:"chromium"});

test("control edits detect conflicts, support mouse/wheel and unbinding, preserve context and survive refresh",async({page})=>{
 await page.goto("/");await page.locator("#settings-open").click();
 const editor=page.locator(".controls-editor");await editor.locator("summary").click();
 const context=editor.locator(".controls-context");await context.selectOption("planet-gun:planetsiege");
 const bind=async(action:string,key:string)=>{await editor.locator(`.controls-binding[data-action="${action}"]`).click();await page.keyboard.press(key);};
 await bind("jump","j");await expect(editor.locator('[data-action="jump"]')).toContainText("J");
 await bind("leanLeft","j");await expect(editor.locator(".controls-status")).toContainText("already assigned to Jump");
 await page.keyboard.press("Escape");await expect(page.locator("#settings-overlay")).toBeVisible();
 await expect(editor.locator('[data-action="leanLeft"]')).toContainText("Z");
 await editor.locator('[data-action="aim"]').click();await page.keyboard.press("Delete");
 await expect(editor.locator('[data-action="aim"]')).toContainText("Unbound");
 await editor.locator('[data-action="fire"]').click();await editor.locator(".controls-status").click({button:"right"});
 await expect(editor.locator('[data-action="fire"]')).toHaveAttribute("aria-label",/RMB/);
 await editor.locator('[data-action="leanRight"]').click();await page.mouse.wheel(0,-120);
 await expect(editor.locator('[data-action="leanRight"]')).toContainText("WHEEL ↑");
 await context.selectOption("planetfall");await expect(editor.locator('[data-action="jump"]')).toContainText("SPACE");
 await page.locator("#settings-close").click();await page.reload();await page.locator("#settings-open").click();
 await editor.locator("summary").click();await context.selectOption("planet-gun:planetsiege");
 await expect(editor.locator('[data-action="jump"]')).toContainText("J");
 await expect(editor.locator('[data-action="aim"]')).toContainText("Unbound");
 await expect(editor.locator('[data-action="fire"]')).toHaveAttribute("aria-label",/RMB/);
 await expect(editor.locator('[data-action="leanRight"]')).toContainText("WHEEL ↑");
 await editor.getByRole("button",{name:"Reset all bindings",exact:true}).click();
 await expect(editor.locator('[data-action="jump"]')).toContainText("SPACE");
 await expect(editor.locator('[data-action="leanRight"]')).toContainText("C");
});

test("PlanetGun applies remapped arrows, fire, wheel jump, pause and scoreboard to the live player",async({page,context})=>{
 const friend=await context.newPage();
 for(const [p,name]of [[page,"Binding Pilot"],[friend,"Binding Friend"]]as const){await p.goto("/");await p.getByLabel("Name",{exact:true}).fill(name);await selectExperimentalFamily(p,"planet-gun");}
 await page.locator("#settings-open").click();await page.locator(".controls-editor summary").click();await page.locator(".controls-context").selectOption("planet-gun");
 for(const [action,key]of [["moveForward","ArrowUp"],["fire","h"],["pause","p"],["scoreboard","l"]]){await page.locator(`.controls-binding[data-action="${action}"]`).click();await page.keyboard.press(key);}
 await page.locator('.controls-binding[data-action="jump"]').click();await page.mouse.wheel(0,-120);await page.locator("#settings-close").click();
 await page.locator("#create-room").click();await expect(page.locator("#pg-lobby-screen")).toBeVisible();await openLobbyConfiguration(page);await page.locator("#pg-fill").uncheck();
 const code=await page.locator("#pg-code").innerText();await friend.locator("#room-code").fill(code);await friend.locator("#join-room").click();await friend.locator("#pg-ready").click();await page.locator("#pg-ready").click();await page.locator("#pg-start").click();
 const state=()=>page.evaluate(()=>(window as any).__PLANETFALL_PG_DEBUG__?.());await expect.poll(async()=>(await state())?.phase).toBe("playing");
 await page.bringToFront();await page.locator("#game-canvas").click({position:{x:640,y:360}});await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("game-canvas");
 const start=(await state()).local.position;await page.keyboard.down("w");await page.waitForTimeout(350);await page.keyboard.up("w");
 const idle=(await state()).local.position;expect(Math.hypot(idle.x-start.x,idle.z-start.z)).toBeLessThan(.15);
 await page.keyboard.down("ArrowUp");await page.waitForTimeout(450);await page.keyboard.up("ArrowUp");
 const moved=(await state()).local.position;expect(Math.hypot(moved.x-idle.x,moved.z-idle.z)).toBeGreaterThan(1);
 const shots=(await state()).local.guns[0].shots;await page.mouse.click(640,360);await page.waitForTimeout(150);expect((await state()).local.guns[0].shots).toBe(shots);
 await page.keyboard.down("h");await page.waitForTimeout(160);await page.keyboard.up("h");await expect.poll(async()=>(await state()).local.guns[0].shots).toBeGreaterThan(shots);
 await page.mouse.wheel(0,-120);await expect.poll(async()=>(await state()).local.velocity.y).toBeGreaterThan(1);
 await page.keyboard.press("p");await expect(page.locator("#pause-overlay")).toBeVisible();expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();
 await page.keyboard.press("p");await expect(page.locator("#pause-overlay")).not.toBeVisible();
 await page.keyboard.press("l");await expect(page.locator("#pg-scoreboard")).toBeVisible();await page.keyboard.press("l");await expect(page.locator("#pg-scoreboard")).not.toBeVisible();
 await page.keyboard.press("Escape");await page.locator("#pause-leave").click();await expect(page.locator("#home-screen")).toBeVisible();await friend.close();
});

test("PlanetRun applies remapped movement, jump and pause without retaining the former keys",async({page},info)=>{
 const commands:any[]=[];
 page.on("websocket",socket=>socket.on("framesent",event=>{const text=String(event.payload);if(!text.startsWith('42["pr:player:input"'))return;commands.push(JSON.parse(text.slice(2))[1]);}));
  await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Run Binding Pilot");await selectExperimentalFamily(page,"planet-run");await page.locator("#settings-open").click();await page.locator(".controls-editor summary").click();await page.locator(".controls-context").selectOption("planet-run");
  for(const [action,key]of [["moveForward","u"],["jump","j"],["pause","p"]]){await page.locator(`.controls-binding[data-action="${action}"]`).click();await page.keyboard.press(key);}
  await page.locator("#settings-close").click();await page.locator("#create-room").click();await expect(page.locator("#pr-lobby-screen")).toBeVisible();await openLobbyConfiguration(page);await page.locator("#pr-target").selectOption("10");await page.locator("#pr-fill").check();
  // Keep a normal race roster. Wait for autonomous racers to pass before
  // comparing stationary positions, so crowd bumps cannot masquerade as input.
  await page.locator("#pr-ready").click();await page.locator("#pr-start").click();await page.bringToFront();
  const state=()=>page.evaluate(()=>(window as any).__PLANETFALL_PR_DEBUG__?.());await expect.poll(async()=>(await state())?.phase).toBe("running");
  await expect.poll(async()=>{const s=await state();return s.pilotStates.filter((p:any)=>p.isBot).every((p:any)=>p.position.z<s.local.position.z-2.5);}).toBe(true);
  await expect.poll(async()=>{const s=await state();return Math.hypot(s.local.velocity.x,s.local.velocity.z);}).toBeLessThan(.05);
  const before=await state();expect(before.players).toBe(10);expect(before.roundId).not.toBe("shatterdeck");
  const start=before.local.position,index=commands.length;await page.keyboard.down("w");await page.waitForTimeout(350);await page.keyboard.up("w");
  const idle=await state(),formerCommands=commands.slice(index);expect(formerCommands.length).toBeGreaterThan(3);expect(formerCommands.every(p=>p.moveX===0&&p.moveZ===0)).toBe(true);
  expect(idle.local.position.z).toBeCloseTo(start.z,1);
  await page.keyboard.down("u");await page.waitForTimeout(450);await page.keyboard.up("u");const moved=await state();expect(moved.local.grounded).toBe(true);expect(moved.local.position.z).toBeLessThan(start.z-1);
  await page.keyboard.down("j");await page.waitForTimeout(100);await page.keyboard.up("j");const jumped=await state();expect(jumped.local.velocity.y).toBeGreaterThan(1);
  await page.keyboard.press("p");await expect(page.locator("#pause-overlay")).toBeVisible();await page.keyboard.press("p");await expect(page.locator("#pause-overlay")).not.toBeVisible();
  await writeFile(info.outputPath("run-remapped-input.json"),JSON.stringify({before,idle,moved,jumped,formerCommands},null,2));
  await page.locator("#pr-leave-game").click();await expect(page.locator("#home-screen")).toBeVisible();
});
