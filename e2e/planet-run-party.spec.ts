import {expect,test} from '@playwright/test';
import {selectExperimentalFamily} from './select-family';

test('PlanetRun themed thirty-pilot courses and responsive canonical winner stage',async({page},info)=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1280,height:720});await page.goto('/');
 await page.getByLabel('Name',{exact:true}).fill('Party Pilot');await selectExperimentalFamily(page,'planet-run');
 await page.locator('#settings-open').click();await page.locator('#graphics-quality').selectOption('high');await page.locator('#settings-close').click();
 for(const round of ['cargo-cyclone','solar-sweep','meteor-garden','flux-gardens','capacitor-causeway','shatterdeck']){
  await page.locator('#create-room').click();await expect(page.locator('#pr-lobby-screen')).toBeVisible();
  await expect(page.locator('#pr-lobby-screen')).toHaveAttribute('data-pr-visible','true');
  await expect(page.locator('#pr-lobby-screen .pr-lobby-card')).toHaveCount(1);
  await expect(page.locator('#pr-lobby-screen aside, #pr-lobby-screen .pr-showcase-motif')).toHaveCount(0);
  await expect(page.locator('#pr-host-controls')).toBeVisible();
  await page.locator('#pr-target').selectOption('30');if(await page.locator('#pr-dev-review').getAttribute('open')===null)await page.locator('#pr-dev-review summary').click();
  await page.locator(`[data-round="${round}"]`).click();
  const state=()=>page.locator('#pr-dev-state').textContent().then(v=>JSON.parse(v!));
  await expect.poll(async()=>(await state()).phase).toBe('running');
  const debug=await state();expect(debug.players).toBe(30);expect(debug.roundId).toBe(round);expect(debug.worldCalls).toBeGreaterThan(0);expect(debug.worldCalls).toBeLessThan(200);
  await expect(page.locator('#pr-hud')).toHaveAttribute('data-pr-round',round);
  await expect(page.locator('#pr-hud')).toHaveAttribute('data-pr-visible','true');
  await expect(page.locator('#pr-lobby-screen')).toHaveAttribute('data-pr-visible','false');
  if(round!=='shatterdeck'){await page.locator('#pr-leave-game').click();await expect(page.locator('#home-screen')).toBeVisible();}
 }
 // This is a real thirty-pilot final. Ordinary tile contact determines the winner.
 await expect(page.locator('#pr-results-screen')).toBeVisible({timeout:135000});
 const stage=page.locator('.pr-winner-stage'),card=page.locator('.pr-results-card');
 await expect(stage).toBeVisible();await expect(page.locator('#pr-winner-title')).toContainText('wins!');
 let s=await stage.boundingBox(),c=await card.boundingBox();expect(s!.x).toBeGreaterThan(c!.x+c!.width);
 await page.screenshot({path:info.outputPath('party-winner-desktop.png')});
 await page.setViewportSize({width:768,height:600});await expect(stage).toBeVisible();
 s=await stage.boundingBox();c=await card.boundingBox();expect(s!.y+s!.height).toBeLessThanOrEqual(c!.y);
 await page.screenshot({path:info.outputPath('party-winner-laptop.png')});
 await page.locator('#pr-return').click();await expect(page.locator('#pr-lobby-screen')).toBeVisible();
 await expect(page.locator('#pr-results-screen')).toHaveAttribute('data-pr-visible','false');
 await page.locator('#pr-leave-lobby').click();await expect(page.locator('#home-screen')).toBeVisible();
 expect(errors).toEqual([]);
});
