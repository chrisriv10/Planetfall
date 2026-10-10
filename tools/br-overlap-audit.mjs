import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { BR_STRUCTURES, BR_BRIDGE_PIERS, BR_GREENWAY_TREES } from "../shared/dist/index.js";
import { buildStorefrontFrameParts } from "../client/src/modes/battle-royale/br-facades.ts";
import { buildBrFacadeSkin } from "../client/src/modes/battle-royale/br-facade-skin.ts";
import { buildBrEntranceHeaderFinish } from "../client/src/modes/battle-royale/br-entrance-header-finish.ts";
import { buildBrDoorwayParts, buildBrFreightPilasters } from "../client/src/modes/battle-royale/br-facade-attachments.ts";
import { buildBrFacadeLeds } from "../client/src/modes/battle-royale/br-facade-leds.ts";
import { brFacadeIntersections } from "../client/src/modes/battle-royale/br-facade-intersections.ts";
import { buildBrFacadeSign, getBrFacadeSignText } from "../client/src/modes/battle-royale/br-facade-signs.ts";

const output=process.argv[2]??"artifacts/br-overlap-audit/report.json";
const buildingIntersections=[], facadeIntersections=[], neighboringFacadeIntersections=[], neighboringAttachmentIntersections=[];
const assemblies=[];
let pairs=0, facadeBoxes=0;
for(let i=0;i<BR_STRUCTURES.length;i++){
  const a=BR_STRUCTURES[i];
  for(const b of BR_STRUCTURES.slice(i+1)){
    pairs++;
    const x=(a.size.x+b.size.x)/2-Math.abs(a.position.x-b.position.x);
    const z=(a.size.z+b.size.z)/2-Math.abs(a.position.z-b.position.z);
    const y=Math.min(a.position.y+a.size.y,b.position.y+b.size.y)-Math.max(a.position.y,b.position.y);
    if(Math.min(x,y,z)>.01)buildingIntersections.push({a:a.id,b:b.id,overlap:{x,y,z},positions:[a.position,b.position]});
  }
  const text=getBrFacadeSignText(a),crest=text?buildBrFacadeSign(a,text):null;
  const mounts=crest?.parts.map(p=>({...p,face:a.entrance,position:{...p.position,y:p.position.y-a.position.y}}))??[];
  const headerParts=buildBrEntranceHeaderFinish(a).map(p=>({...p,position:{...p.position,y:p.position.y-a.position.y}}));
  const parts=[...buildBrFacadeSkin(a),...headerParts,...buildBrDoorwayParts(a),...buildBrFreightPilasters(a),...buildStorefrontFrameParts(a),...buildBrFacadeLeds(a),...mounts];
  facadeBoxes+=parts.length;
  assemblies.push({structure:a,parts});
  for(const [partIndex,part] of parts.entries())for(const b of BR_STRUCTURES){
    if(b.id===a.id)continue;
    const p={...part.position,y:part.position.y+a.position.y};
    const overlap={x:(part.scale.x+b.size.x)/2-Math.abs(p.x-b.position.x),
      y:Math.min(p.y+part.scale.y/2,b.position.y+b.size.y)-Math.max(p.y-part.scale.y/2,b.position.y),
      z:(part.scale.z+b.size.z)/2-Math.abs(p.z-b.position.z)};
    if(Math.min(overlap.x,overlap.y,overlap.z)>.01)neighboringFacadeIntersections.push({structure:a.id,neighbor:b.id,partIndex,part,overlap});
  }
  facadeIntersections.push(...brFacadeIntersections(parts).map(issue=>({structure:a.id,...issue,
    paneBox:parts[issue.pane],decorationBox:parts[issue.decoration]})));
}
for(let i=0;i<assemblies.length;i++)for(const b of assemblies.slice(i+1)){
  const a=assemblies[i],sa=a.structure,sb=b.structure;
  if(Math.abs(sa.position.x-sb.position.x)>(sa.size.x+sb.size.x)/2+8||Math.abs(sa.position.z-sb.position.z)>(sa.size.z+sb.size.z)/2+8)continue;
  for(const [ai,ap]of a.parts.entries())for(const [bi,bp]of b.parts.entries()){
    const overlap={x:(ap.scale.x+bp.scale.x)/2-Math.abs(ap.position.x-bp.position.x),
      y:(ap.scale.y+bp.scale.y)/2-Math.abs(ap.position.y+sa.position.y-bp.position.y-sb.position.y),
      z:(ap.scale.z+bp.scale.z)/2-Math.abs(ap.position.z-bp.position.z)};
    if(Math.min(overlap.x,overlap.y,overlap.z)>.01)neighboringAttachmentIntersections.push({a:sa.id,b:sb.id,partA:ai,partB:bi,boxA:ap,boxB:bp,overlap});
  }
}
const report={
  generatedAt:new Date().toISOString(),
  scope:"All authored building envelopes and the production facade skin composition (glazing, service ribs, Nova storefront details and Solar service skins), doorway frames/awnings, freight pilasters, storefront uprights, facade LEDs and supported sign mounts. Shared physics/route tests separately validate bridge piers and tree trunks.",
  limits:"This does not certify every decorative mesh or animated figure. Bounding envelopes cannot prove triangle-level separation. Plant foliage, thin mullions and backing panels are intentional facade joins; broad boxes penetrating the outward glass face are flagged.",
  checked:{structures:BR_STRUCTURES.length,buildingPairs:pairs,facadeBoxes,bridgePiers:BR_BRIDGE_PIERS.length,greenwayTrees:BR_GREENWAY_TREES.length},
  buildingIntersections,facadeIntersections,neighboringFacadeIntersections,neighboringAttachmentIntersections,
  passed:buildingIntersections.length===0&&facadeIntersections.length===0&&neighboringFacadeIntersections.length===0&&neighboringAttachmentIntersections.length===0,
};
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({checked:report.checked,buildingIntersections:buildingIntersections.length,facadeIntersections:facadeIntersections.length,neighboringFacadeIntersections:neighboringFacadeIntersections.length,neighboringAttachmentIntersections:neighboringAttachmentIntersections.length,passed:report.passed,output}));
if(!report.passed)process.exitCode=1;
