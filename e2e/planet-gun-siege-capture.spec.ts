import {test,expect} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {PG_OBJECTIVES} from "@planetfall/shared";
import {selectExperimentalFamily,openLobbyConfiguration} from "./select-family";
import {state,route} from "./pg-world-route";

test.use({channel:"chromium",viewport:{width:960,height:540},video:"on"});
test("Siege physically captures a full uplink while a living defender remains elsewhere",async({browser},info)=>{
 test.setTimeout(150000);
 const contexts=await Promise.all([browser.newContext({viewport:{width:960,height:540}}),browser.newContext({viewport:{width:960,height:540}})]);
 const host=await contexts[0].newPage(),guest=await contexts[1].newPage(),errors:string[]=[];
 try{
  for(const [page,name]of [[host,"Capture Attacker"],[guest,"Living Defender"]]as const){page.on("pageerror",e=>errors.push(e.message));await page.goto("/");await page.getByLabel("Name",{exact:true}).fill(name);await selectExperimentalFamily(page,"planet-gun");await page.locator("#settings-open").click();await page.locator("#graphics-quality").selectOption("low");await page.locator("#settings-close").click();}
  await host.locator("#create-room").click();await host.getByLabel("PlanetGun submode").selectOption("planetsiege");
  await guest.locator("#room-code").fill(await host.locator("#pg-code").innerText());await guest.locator("#join-room").click();
  await openLobbyConfiguration(host);await host.locator("#pg-fill").uncheck();await guest.locator("#pg-ready").click();await host.locator("#pg-ready").click();await host.locator("#pg-start").click();
  await expect.poll(async()=>(await state(host))?.mode?.subphase).toBe("prepare");
  const initial={attacker:await state(host),defender:await state(guest)};
  await writeFile(info.outputPath("spawn-state.json"),JSON.stringify(initial,null,2));
  expect(initial.attacker.players).toBe(2);expect(initial.attacker.local.team).toBe(initial.attacker.mode.attackTeam);
  // Normal mouse-look and WASD leave the compound. No state writes, kills,
  // teleports or shortened capture timers are used in this playthrough.
  await test.step("defender physically leaves the uplink",()=>route(guest,{x:-27,y:0,z:16},info.outputPath("defender-route-failure.json")));
  const departed=await state(guest);expect(departed.local.hp).toBeGreaterThan(0);
  expect(Math.hypot(departed.local.position.x-initial.defender.local.position.x,departed.local.position.z-initial.defender.local.position.z)).toBeGreaterThan(15);
  await expect.poll(async()=>(await state(host))?.mode?.subphase,{timeout:45000}).toBe("action");
  const objective=PG_OBJECTIVES.uplink[0];await test.step("attacker walks from spawn into uplink",()=>route(host,objective.position,info.outputPath("attacker-route-failure.json")));
  await expect.poll(async()=>(await state(host)).mode.capture).toBeGreaterThan(0);
  const entered=await state(host),at=Date.now();expect(entered.local.hp).toBeGreaterThan(0);expect(entered.mode.capture).toBeLessThan(.4);
  await host.screenshot({path:info.outputPath("uplink-capture-progress.png")});
  await expect.poll(async()=>(await state(host)).mode.capture,{timeout:20000}).toBe(1);
  const complete={attacker:await state(host),defender:await state(guest)};
  expect(Date.now()-at).toBeGreaterThan(9000);expect(complete.attacker.mode.subphase).toBe("intermission");
  expect(complete.attacker.mode.roundScores[complete.attacker.local.team]).toBe(1);
  for(const s of [complete.attacker,complete.defender]){expect(s.local.hp).toBeGreaterThan(0);expect(s.mode.pilots[s.local.id].life).toBe("alive");}
  await host.screenshot({path:info.outputPath("uplink-captured-both-alive.png")});await writeFile(info.outputPath("full-capture-playthrough.json"),JSON.stringify({initial,departed,entered,complete},null,2));expect(errors).toEqual([]);
 }catch(error){await writeFile(info.outputPath("failure-state.json"),JSON.stringify({attacker:await state(host).catch(()=>null),defender:await state(guest).catch(()=>null)},null,2));throw error;}finally{await Promise.all(contexts.map(c=>c.close()));}
});
