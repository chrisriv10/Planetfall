import * as THREE from "three";
import { BR_ELEVATION_REGIONS, type Vec3 } from "@planetfall/shared";
import type { BrMaterialLibrary } from "./br-materials";

export type BrAcademyFrontageFinish = "paintedMetal" | "structuralDark" | "brushedMetal" | "energyCyan";
export interface BrAcademyFrontagePart {
  role: "panel" | "contact" | "seam" | "maintenance" | "indicator";
  finish: BrAcademyFrontageFinish;
  position: Vec3;
  scale: Vec3;
}
type Deck = {x:number;z:number;width:number;depth:number;height:number};
const academyDeck = BR_ELEVATION_REGIONS.find(region=>region.id==="astra-campus-deck")!;

/** World-height, north-facing skins on the existing solid retaining wall.
 * The 4m corner setback leaves the dorm frontage and western ramps alone.
 * No new walkable mass, collision, lights, textures, or frame-time updates.
 */
export function buildBrAcademyLowerFrontage(deck:Deck=academyDeck):BrAcademyFrontagePart[]{
  if(![deck.x,deck.z,deck.width,deck.depth,deck.height].every(Number.isFinite)||deck.width<40||deck.depth<12||deck.height<4)return [];
  const parts:BrAcademyFrontagePart[]=[],west=deck.x-deck.width/2,north=deck.z+deck.depth/2;
  const start=west+4,bayWidth=6.4,count=5;
  const add=(role:BrAcademyFrontagePart["role"],finish:BrAcademyFrontageFinish,x:number,y:number,
    width:number,height:number,outward:number,thickness:number)=>parts.push({role,finish,
      position:{x,y,z:north+outward},scale:{x:width,y:height,z:thickness}});
  // Panels stop short of the cap and ground. Thin horizontal joints give the
  // tall retaining face a structural scale instead of freestanding furniture.
  for(let bay=0;bay<count;bay++){
    const x=start+(bay+.5)*bayWidth;
    add("panel","paintedMetal",x,deck.height/2,bayWidth-.2,deck.height-1.1,.018,.03);
    add("contact","structuralDark",x,.29,bayWidth-.08,.5,.039,.07);
    add("seam","brushedMetal",x,deck.height-.25,bayWidth-.12,.15,.052,.04);
    add("seam","brushedMetal",x,deck.height*.49,bayWidth-.3,.055,.047,.025);
    // Alternate two maintenance cassettes, clearly attached to the wall.
    if(bay===1||bay===3){
      add("maintenance","structuralDark",x,1.75,1.5,1.9,.049,.05);
      add("maintenance","brushedMetal",x,1.75,1.32,1.7,.081,.014);
      for(let slot=0;slot<3;slot++)add("maintenance","structuralDark",x,1.4+slot*.2,.95,.06,.094,.01);
      add("indicator","energyCyan",x+.46,2.31,.16,.055,.098,.014);
    }
  }
  for(let joint=0;joint<=count;joint++)add("seam","structuralDark",start+joint*bayWidth,
    deck.height/2,.12,deck.height-.35,.049,.075);
  return parts;
}

/** Optional renderer adapter. Uses borrowed library resources and four bounded
 * instanced batches. Caller owns placement/LOD; dispose releases only instances,
 * never the library's shared unit box or materials. No camera collision hooks.
 */
export function createBrAcademyLowerFrontage(materials:Pick<BrMaterialLibrary,"unitBox"|"get">){
  const group=new THREE.Group();group.name="academy-lower-frontage";
  const batches=new Map<BrAcademyFrontageFinish,BrAcademyFrontagePart[]>();
  for(const part of buildBrAcademyLowerFrontage()){
    const batch=batches.get(part.finish)??[];batch.push(part);batches.set(part.finish,batch);
  }
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion();
  const meshes:THREE.InstancedMesh[]=[];
  for(const [finish,parts] of batches){
    const mesh=new THREE.InstancedMesh(materials.unitBox,materials.get(finish),parts.length);
    mesh.name=`academy-lower-frontage-${finish}`;
    parts.forEach((part,index)=>mesh.setMatrixAt(index,matrix.compose(
      position.set(part.position.x,part.position.y,part.position.z),rotation,
      scale.set(part.scale.x,part.scale.y,part.scale.z))));
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
    group.add(mesh);meshes.push(mesh);
  }
  let disposed=false;
  return {group,dispose(){
    if(disposed)return;disposed=true;group.removeFromParent();
    for(const mesh of meshes)mesh.dispose();group.clear();
  }};
}
