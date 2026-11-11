import {WEAPON_FINISHES} from "@planetfall/shared";
import {test,expect} from "@playwright/test";
import {writeFile} from "node:fs/promises";
test.use({channel:"chromium",reducedMotion:"reduce"});

test("the live Kit turntable renders all canonical finishes and survives thumbnail generation",async({page},info)=>{
 await page.goto("/");await expect(page.getByLabel("Name",{exact:true})).toBeVisible();
 // Isolated presentation fixture: real production preview, renderer and models.
 // No player ownership, currency, match input or authoritative state is injected.
 const evidence=await page.evaluate(async(finishes:readonly {id:string}[])=>{
  const {createPgKitPreview}=await import("/src/modes/planet-gun/pg-kit-preview.ts");
  const host=document.createElement("section");host.style.cssText="position:fixed;inset:20px auto auto 20px;width:480px;height:300px;z-index:10000;background:#101a30";document.body.append(host);
  const preview=createPgKitPreview(host),canvas=host.querySelector("canvas")!;
  const reader=document.createElement("canvas");reader.width=480;reader.height=300;const ctx=reader.getContext("2d")!;
  const pixels=()=>{ctx.clearRect(0,0,480,300);ctx.drawImage(canvas,0,0,480,300);return ctx.getImageData(0,0,480,300).data;};
  const difference=(a:Uint8ClampedArray,b:Uint8ClampedArray)=>{let changed=0,visible=0;for(let i=0;i<a.length;i+=4){if(a[i+3]||b[i+3])visible++;if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12)changed++;}return {changed,visible};};
  const samples:any[]=[],images:{name:string;data:string}[]=[];
  try{
   preview.setVisible(true);
   for(const id of ["pulse","nova","photon","quasar","rail","helix","arc","prism","comet","orbit"] as const){
    preview.setWeapon(id,[],"default");const standard=pixels();
    for(const finish of finishes){
     preview.setWeapon(id,[],finish.id);const painted=pixels(),diff=difference(standard,painted);
     const thumbnail=preview.thumbnail(id,[],finish.id),afterThumbnail=pixels();
     samples.push({weapon:id,finish:finish.id,...diff,restored:difference(painted,afterThumbnail).changed,thumbnailBytes:thumbnail.length});
     if(id==="pulse"&&finish.id==="finish-solar-alloy"||id==="orbit"&&finish.id==="finish-copper-circuit"||id==="rail"&&finish.id==="finish-voidglass")images.push({name:`${id}-${finish.id}.png`,data:canvas.toDataURL("image/png")});
    }
   }
  }finally{preview.dispose();host.remove();}
  return {samples,images,remainingFixtureCanvases:host.querySelectorAll("canvas").length};
 },WEAPON_FINISHES.map(({id})=>({id})));
 for(const sample of evidence.samples){expect(sample.visible,sample.weapon).toBeGreaterThan(1000);expect(sample.changed,`${sample.weapon}/${sample.finish} must paint the live turntable`).toBeGreaterThan(100);expect(sample.restored,`${sample.weapon}/${sample.finish} thumbnail must restore live materials`).toBe(0);expect(sample.thumbnailBytes).toBeGreaterThan(1000);}
 expect(evidence.samples).toHaveLength(60);expect(evidence.remainingFixtureCanvases).toBe(0);
 for(const image of evidence.images)await writeFile(info.outputPath(image.name),Buffer.from(image.data.split(",")[1],"base64"));
 await writeFile(info.outputPath("live-finish-pixels.json"),JSON.stringify(evidence.samples,null,2));
});
