import { BR_LOOT_SOCKETS, BR_MAP_BLOCKS, type BrStructure, type Vec3 } from "@planetfall/shared";

export type ResidentialPart = { finish: "frame" | "panel" | "glass" | "light" | "accent"; position: Vec3; scale: Vec3 };
export type ResidentialSign = { text: string; position: Vec3; width: number };

/** Shallow landing markers on the south wall, never freestanding in the stair. */
export function buildResidentialLandingMarkers(structure: BrStructure): {parts: ResidentialPart[]; signs: ResidentialSign[]} {
  const parts: ResidentialPart[] = [], signs: ResidentialSign[] = [];
  if (!structure.enterable || !["apartment", "hotel"].includes(structure.archetype)) return {parts, signs};
  // Existing interior wall cassettes project .61m from the wall centre.
  // Mount on that visible skin, not on the collider face behind the cladding.
  const wallZ = structure.position.z - structure.size.z / 2 + .625;
  for (const landing of BR_MAP_BLOCKS.filter(b => b.id.startsWith(`${structure.id}-deck-`) && b.id.endsWith("-landing"))) {
    const width = Math.min(3.6, landing.size.x - .6), x = landing.position.x;
    const floorY = landing.position.y + landing.size.y / 2;
    const floorHeight = structure.size.y / structure.floors;
    if (width < 2 || floorHeight < 3.4) continue;
    if (structure.entrance === "south" && Math.abs(x - structure.position.x) - width / 2 < 2.8) continue;
    const add = (finish: ResidentialPart["finish"], dx:number, y:number, sx:number, sy:number, offset:number, thickness:number) =>
      parts.push({finish, position:{x:x+dx,y:floorY+y,z:wallZ+offset}, scale:{x:sx,y:sy,z:thickness}});
    add("frame", 0, 1.9, width, 2.5, .045, .06);
    add("panel", 0, 1.9, width-.16, 2.32, .085, .02);
    add("glass", 0, 2.2, width-.42, .92, .105, .018);
    add("accent", -width/2+.2, 1.3, .09, .56, .105, .018);
    add("frame", .2, 1.45, width-.9, .065, .105, .018);
    add("frame", .2, 1.2, width-.9, .065, .105, .018);
    add("light", 0, 3.1, width-.38, .045, .105, .018);
    const level = Math.round(landing.position.y / floorHeight) + 1;
    signs.push({text:`LEVEL ${String(level).padStart(2,"0")}`,position:{x,y:floorY+2.2,z:wallZ+.13},width:width-.58});
  }
  return {parts, signs};
}

/** Thin soffit panels follow real overhead slabs, leaving stairwell voids open. */
export function buildResidentialCeiling(structure: BrStructure): ResidentialPart[] {
  if(!structure.enterable||!["apartment","hotel"].includes(structure.archetype))return [];
  const parts:ResidentialPart[]=[];
  for(const slab of BR_MAP_BLOCKS.filter(b=>b.id.startsWith(`${structure.id}-`)&&b.kind==="platform"&&!b.id.endsWith("-floor"))) {
    const width=slab.size.x-1.3,depth=slab.size.z-1.3;
    if(width<2.5||depth<3)continue;
    const ceilingY=slab.position.y-slab.size.y/2;
    const add=(finish:ResidentialPart["finish"],dx:number,dz:number,sx:number,sz:number,drop:number,height:number)=>
      parts.push({finish,position:{x:slab.position.x+dx,y:ceilingY-drop,z:slab.position.z+dz},scale:{x:sx,y:height,z:sz}});
    // A lighter central raft breaks the dark lid without changing room height.
    add("panel",0,0,width*.78,depth*.8,.035,.04);
    const bays=Math.max(2,Math.ceil(depth/5));
    for(let bay=0;bay<=bays;bay++)add("frame",0,-depth*.4+depth*.8*bay/bays,width*.82,.065,.07,.035);
    for(const side of [-1,1]) {
      add("frame",side*width*.4,0,.22,depth*.82,.07,.06);
      add("light",side*width*.4,0,.065,depth*.75,.11,.015);
    }
  }
  return parts;
}

/** Shallow lounge furniture against the west wall, away from the east stair.
 * Whole bays are omitted at doorways, dividers or loot, never partially clipped. */
export function buildResidentialInterior(structure: BrStructure): {parts: ResidentialPart[]; signs: ResidentialSign[]} {
  const parts: ResidentialPart[]=[], signs: ResidentialSign[]=[];
  if(!structure.enterable || !["apartment","hotel"].includes(structure.archetype))return {parts,signs};
  const {x,z}=structure.position, width=structure.size.x, depth=structure.size.z;
  const wallFace=x-width/2+.325;
  const blocks=BR_MAP_BLOCKS.filter(b=>b.id.startsWith(`${structure.id}-`));
  const loot=BR_LOOT_SOCKETS.filter(s=>s.structureId===structure.id);
  const clearBay=(center:number,halfWidth:number,floorY:number)=> {
    if(structure.entrance==="west"&&center-halfWidth<z+2.8&&center+halfWidth>z-2.8)return false;
    if(blocks.some(b=>b.id.includes("-room-")&&b.position.y+b.size.y/2>floorY&&
      b.position.x+b.size.x/2>wallFace&&b.position.x-b.size.x/2<wallFace+.88&&
      b.position.z+b.size.z/2+.2>center-halfWidth&&b.position.z-b.size.z/2-.2<center+halfWidth))return false;
    return !loot.some(s=>s.position.y>floorY-.5&&s.position.y<floorY+3.7&&
      s.position.x>wallFace-1&&s.position.x<wallFace+1.88&&s.position.z>center-halfWidth-1&&s.position.z<center+halfWidth+1);
  };
  for(let floor=0;floor<structure.floors;floor++) {
    const floorY=floor===0?.36:floor*structure.size.y/structure.floors+.175;
    for(const side of [-1,1]) {
      const center=z+side*depth*.29, bay:ResidentialPart[]=[];
      const add=(finish:ResidentialPart["finish"],distance:number,y:number,dz:number,sx:number,sy:number,sz:number)=>
        bay.push({finish,position:{x:wallFace+distance,y:floorY+y,z:center+dz},scale:{x:sx,y:sy,z:sz}});
      const bayHeight=structure.size.y/structure.floors-1;
      // Broad wall bay and high lintel give these tall rooms human-scale layers.
      add("panel",.03,bayHeight/2+.1,0,.04,bayHeight,4.25);
      for(const end of [-1,1])add("frame",.075,bayHeight/2+.1,end*2.13,.09,bayHeight,.065);
      add("frame",.07,bayHeight+.1,0,.1,.12,4.3);
      // Framed wall textile/artwork with an asymmetric orbital city motif.
      add("frame",.085,2.42,0,.14,2.24,3.65);
      add("glass",.17,2.42,0,.035,1.94,3.34);
      for(let stripe=0;stripe<3;stripe++) {
        add(stripe===1?"accent":"panel",.2,2.14+stripe*.25,-.88+stripe*.78,.025,.16,1.04);
        add("panel",.21,2.68-stripe*.16,-.96+stripe*.65,.025,.4,.065);
      }
      // Bench: separate cushions, backrest, arms and feet, not a solid cover box.
      add("frame",.43,.38,0,.7,.14,3.6);
      for(const end of [-1,1]) {
        add("frame",.43,.15,end*1.4,.46,.3,.16);
        add("panel",.45,.72,end*1.72,.78,.18,.2);
        add("frame",.45,.54,end*1.72,.58,.26,.13);
      }
      for(const seat of [-1,0,1]) {
        add("panel",.46,.53,seat*1.07,.64,.18,1.01);
        add("panel",.16,.92,seat*1.07,.2,.62,1.01);
      }
      for(const end of [-1,1]) {
        add("frame",.16,2.56,end*2.04,.22,.74,.19);
        add("light",.285,2.56,end*2.04,.025,.46,.08);
      }
      if(!clearBay(center,2.2,floorY))continue;
      parts.push(...bay);
    }
    if(floor===0&&clearBay(z,1.75,floorY)) {
      const add=(finish:ResidentialPart["finish"],distance:number,y:number,dz:number,sx:number,sy:number,sz:number)=>
        parts.push({finish,position:{x:wallFace+distance,y:floorY+y,z:z+dz},scale:{x:sx,y:sy,z:sz}});
      add("frame",.13,1.62,0,.22,2.8,3.35);
      add("panel",.265,1.62,0,.08,2.58,3.1);
      if(structure.archetype==="hotel") {
        add("frame",.34,2.01,0,.1,1.35,2.62);
        add("glass",.4,2.01,0,.025,1.13,2.38);
        for(let row=0;row<3;row++) {
          add(row===0?"accent":"panel",.42,2.35-row*.32,-.2,.018,.09,1.35);
          add("light",.43,2.35-row*.32,.9,.018,.09,.11);
        }
        add("frame",.46,1.25,0,.62,.15,2.72);
        add("panel",.48,1.34,0,.56,.04,2.56);
      } else {
        // Housing gets parcel compartments, not another hotel kiosk.
        for(let row=0;row<3;row++)for(const col of [-1,1]) {
          add("frame",.325,.75+row*.78,col*.73,.05,.65,1.3);
          add("panel",.365,.75+row*.78,col*.73,.045,.57,1.21);
          add("accent",.4,.75+row*.78,col*.73+.4,.025,.08,.18);
        }
      }
      signs.push({text:structure.archetype==="hotel"?"CHECK IN":"PARCELS",position:{x:wallFace+.28,y:floorY+3.32,z},width:2.7});
    }
    // High mounted wayfinding is readable from the stair landing, not a false door.
    const signZ=z-depth*.29;
    signs.push({text:floor===0?(structure.archetype==="hotel"?"HOTEL LOUNGE":"RESIDENT LOUNGE"):`LEVEL ${String(floor+1).padStart(2,"0")}`,
      position:{x:wallFace+.25,y:floorY+Math.min(4,structure.size.y/structure.floors-.85),z:signZ},width:3.1});
  }
  return {parts,signs};
}
