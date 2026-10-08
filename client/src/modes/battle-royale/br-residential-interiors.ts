import { BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_STRUCTURES, type BrStructure, type Vec3 } from "@planetfall/shared";

// These helpers emit deck-local heights. Their authored collider/loot inputs
// remain world-space even when the renderer passes a zero-base visual copy.
const baseById = new Map(BR_STRUCTURES.map(structure=>[structure.id,structure.position.y]));
function localBlocks(structure:BrStructure){
  const base=baseById.get(structure.id)??structure.position.y;
  return BR_MAP_BLOCKS.filter(block=>block.id.startsWith(`${structure.id}-`))
    .map(block=>({...block,position:{...block.position,y:block.position.y-base}}));
}
function localLoot(structure:BrStructure){
  const base=baseById.get(structure.id)??structure.position.y;
  return BR_LOOT_SOCKETS.filter(socket=>socket.structureId===structure.id)
    .map(socket=>({...socket,position:{...socket.position,y:socket.position.y-base}}));
}

export type ResidentialPart = { finish: "frame" | "panel" | "glass" | "light" | "accent" | "foliage"; position: Vec3; scale: Vec3; rotationX?: number;
  role?: "lounge-chair" | "lounge-table" | "reception-counter" | "lobby-planter" | "wall-trim" };
export type ResidentialSign = { text: string; position: Vec3; width: number };

/** Shallow landing markers on the south wall, never freestanding in the stair. */
export function buildResidentialLandingMarkers(structure: BrStructure): {parts: ResidentialPart[]; signs: ResidentialSign[]} {
  const parts: ResidentialPart[] = [], signs: ResidentialSign[] = [];
  if (!structure.enterable || !["apartment", "hotel"].includes(structure.archetype)) return {parts, signs};
  // Existing interior wall cassettes project .61m from the wall centre.
  // Mount on that visible skin, not on the collider face behind the cladding.
  const wallZ = structure.position.z - structure.size.z / 2 + .625;
  for (const landing of localBlocks(structure).filter(b => b.id.startsWith(`${structure.id}-deck-`) && b.id.endsWith("-landing"))) {
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
  for(const slab of localBlocks(structure).filter(b=>b.kind==="platform"&&!b.id.endsWith("-floor"))) {
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

/** Thin service/display bays on the stair-side wall. These break up the former
 * blank full-height panel while remaining behind the stair and combat lane. */
export function buildResidentialServiceWall(structure: BrStructure): ResidentialPart[] {
  if(!structure.enterable||!["apartment","hotel"].includes(structure.archetype))return [];
  const parts:ResidentialPart[]=[];
  const {x,z}=structure.position,width=structure.size.x,depth=structure.size.z;
  const wallFace=x+width/2-.325;
  const loot=localLoot(structure);
  const floorHeight=structure.size.y/structure.floors;
  for(let floor=0;floor<structure.floors;floor++){
    const floorY=floor===0?.36:floor*floorHeight+.175;
    const usableHeight=floorHeight-.75;
    for(const side of [-1,1]){
      const center=z+side*depth*.29,span=Math.min(4.2,depth*.31);
      if(structure.entrance==="east"&&Math.abs(center-z)-span/2<2.8)continue;
      if(loot.some(socket=>socket.position.y>floorY-.4&&socket.position.y<floorY+usableHeight+.4&&
        socket.position.x>wallFace-1.1&&Math.abs(socket.position.z-center)<span/2+1))continue;
      const add=(finish:ResidentialPart["finish"],dx:number,y:number,dz:number,sx:number,sy:number,sz:number)=>
        parts.push({finish,position:{x:wallFace-dx,y:floorY+y,z:center+dz},scale:{x:sx,y:sy,z:sz}});
      add("frame",.06,usableHeight/2,0,.12,usableHeight,span);
      add("panel",.13,usableHeight/2,0,.045,usableHeight-.18,span-.18);
      for(const end of [-1,1])add("frame",.17,usableHeight/2,end*(span/2-.17),.025,usableHeight-.32,.16);
      add("glass",.18,usableHeight*.55,0,.025,Math.min(1.4,usableHeight*.34),span-.65);
      add("accent",.2,usableHeight*.27,-span*.22,.018,.5,.11);
      add("light",.2,usableHeight-.24,0,.018,.055,span-.5);
    }
  }
  return parts;
}

/** Framed lobby panels on the solid halves of the entrance wall. The central
 * 4.8m authoritative opening remains visually and physically unobstructed. */
export function buildResidentialEntranceWall(structure: BrStructure): ResidentialPart[] {
  if(!structure.enterable||!["apartment","hotel"].includes(structure.archetype))return [];
  const parts:ResidentialPart[]=[];
  const {x,z}=structure.position,width=structure.size.x,depth=structure.size.z;
  const ns=structure.entrance==="north"||structure.entrance==="south";
  const sign=structure.entrance==="north"||structure.entrance==="east"?1:-1;
  const span=ns?width:depth,normal=(ns?depth:width)/2;
  const bayWidth=(span-6.4)/2;
  if(bayWidth<2)return parts;
  const normalCoordinate=(ns?z:x)+sign*(normal-.41);
  const add=(finish:ResidentialPart["finish"],lateral:number,y:number,breadth:number,height:number,thickness:number)=>{
    // The original pieces shared one center, burying the panel, glazing and
    // accents inside the opaque frame. Each visible layer clears the last.
    const inset=finish==="frame"?0:finish==="panel"?.09:finish==="glass"?.13:.16;
    const face=normalCoordinate-sign*inset;
    parts.push({finish,position:{x:ns?x+lateral:face,y,z:ns?face:z+lateral},scale:{x:ns?breadth:thickness,y:height,z:ns?thickness:breadth}});
  };
  for(const side of [-1,1]){
    const lateral=side*(3.2+bayWidth/2);
    add("frame",lateral,2.15,bayWidth,3.55,.12);
    add("panel",lateral,2.15,bayWidth-.18,3.35,.045);
    add("glass",lateral,2.45,bayWidth-.55,1.45,.025);
    add("accent",lateral-side*(bayWidth*.28),1.15,.09,.58,.018);
    add("light",lateral,3.68,bayWidth-.42,.055,.018);
  }
  return parts;
}

/** Visual-only underside construction for the authored residential ramps. The
 * walking surface and collision remain untouched; every piece stays beneath
 * and inside the existing ramp envelope. */
export function buildResidentialRampSkins(structure: BrStructure): ResidentialPart[] {
  if(!structure.enterable||!["apartment","hotel"].includes(structure.archetype))return [];
  const parts:ResidentialPart[]=[];
  for(const ramp of localBlocks(structure).filter(block=>block.kind==="ramp"&&block.id.startsWith(`${structure.id}-stairs-`))){
    const angle=ramp.rotation?.x;
    if(angle===undefined||!Number.isFinite(angle)||angle<=.05||angle>=1.1||ramp.size.x<1||ramp.size.z<5)continue;
    const cos=Math.cos(angle),sin=Math.sin(angle),underside=-ramp.size.y/2,length=ramp.size.z-1.5;
    const add=(finish:ResidentialPart["finish"],lx:number,ly:number,lz:number,sx:number,sy:number,sz:number)=>parts.push({
      finish,rotationX:angle,
      position:{x:ramp.position.x+lx,y:ramp.position.y+ly*cos-lz*sin,z:ramp.position.z+ly*sin+lz*cos},
      scale:{x:sx,y:sy,z:sz}
    });
    for(const side of [-1,1]){
      const edge=side*(ramp.size.x/2-.1);
      add("frame",edge,underside-.08,0,.16,.14,length);
      for(const along of [-.28,.28])add(side<0?"accent":"light",edge,underside-.155,along*length,.065,.018,1.2);
    }
    for(const along of [-.3,0,.3])add("panel",0,underside-.06,along*length,ramp.size.x-.42,.08,.13);
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
  const blocks=localBlocks(structure);
  const loot=localLoot(structure);
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
      const add=(finish:ResidentialPart["finish"],distance:number,y:number,dz:number,sx:number,sy:number,sz:number,role?:ResidentialPart["role"])=>
        bay.push({finish,position:{x:wallFace+distance,y:floorY+y,z:center+dz},scale:{x:sx,y:sy,z:sz},role});
      const bayHeight=structure.size.y/structure.floors-1;
      // Broad wall bay and high lintel give these tall rooms human-scale layers.
      add("panel",.03,bayHeight/2+.1,0,.04,bayHeight,4.25);
      for(const end of [-1,1])add("frame",.075,bayHeight/2+.1,end*2.13,.09,bayHeight,.065);
      add("frame",.07,bayHeight+.1,0,.1,.12,4.3);
      if(structure.archetype==="hotel")for(const height of [1.22,3.72])
        add("frame",.063,height,0,.025,.045,4.08,"wall-trim");
      // Framed wall textile/artwork with an asymmetric orbital city motif.
      add("frame",.085,2.42,0,.14,2.24,3.65);
      add("glass",.17,2.42,0,.035,1.94,3.34);
      for(let stripe=0;stripe<3;stripe++) {
        add(stripe===1?"accent":"panel",.2,2.14+stripe*.25,-.88+stripe*.78,.025,.16,1.04);
        add("panel",.21,2.68-stripe*.16,-.96+stripe*.65,.025,.4,.065);
      }
      if(structure.archetype==="hotel"){
        // Two visibly independent lounge chairs and a small intervening table,
        // not a continuous 3.6m seat slab. All remain in the old shallow bay.
        for(const seat of [-1.16,1.16]){
          add("frame",.44,.35,seat,.67,.1,1.04,"lounge-chair");
          add("panel",.46,.47,seat,.64,.14,.96,"lounge-chair");
          add("panel",.16,.82,seat,.2,.58,.96,"lounge-chair");
          for(const end of [-1,1]){
            add("frame",.44,.15,seat+end*.36,.42,.3,.09,"lounge-chair");
            add("panel",.45,.66,seat+end*.54,.73,.12,.12,"lounge-chair");
          }
        }
        add("frame",.47,.19,0,.14,.34,.36,"lounge-table");
        add("panel",.47,.4,0,.62,.08,.62,"lounge-table");
      }else{
        // Housing retains its communal bench vocabulary, scaled against the
        // shared ~2m astronaut: .53m seat top and 1.07m back top rather than
        // the former .62m / 1.23m oversized arrangement.
        add("frame",.43,.36,0,.7,.12,3.6);
        for(const end of [-1,1]) {
          add("frame",.43,.14,end*1.4,.46,.28,.16);
          add("panel",.45,.62,end*1.72,.78,.14,.2);
          add("frame",.45,.48,end*1.72,.58,.2,.13);
        }
        for(const seat of [-1,0,1]) {
          add("panel",.46,.45,seat*1.07,.64,.16,1.01);
          add("panel",.16,.82,seat*1.07,.2,.5,1.01);
        }
      }
      for(const end of [-1,1]) {
        add("frame",.16,2.56,end*2.04,.22,.74,.19);
        add("light",.285,2.56,end*2.04,.025,.46,.08);
      }
      if(!clearBay(center,2.2,floorY))continue;
      parts.push(...bay);
    }
    if(floor===0&&clearBay(z,1.75,floorY)) {
      const add=(finish:ResidentialPart["finish"],distance:number,y:number,dz:number,sx:number,sy:number,sz:number,role?:ResidentialPart["role"])=>
        parts.push({finish,position:{x:wallFace+distance,y:floorY+y,z:z+dz},scale:{x:sx,y:sy,z:sz},role});
      add("frame",.13,1.62,0,.22,2.8,3.35);
      add("panel",.265,1.62,0,.08,2.58,3.1);
      if(structure.archetype==="hotel") {
        add("frame",.34,2.01,0,.1,1.35,2.62);
        add("glass",.4,2.01,0,.025,1.13,2.38);
        for(let row=0;row<3;row++) {
          add(row===0?"accent":"panel",.42,2.35-row*.32,-.2,.018,.09,1.35);
          add("light",.43,2.35-row*.32,.9,.018,.09,.11);
        }
        // Leg-supported reception counter; open underneath, wall backed, and
        // shorter than the former floating shelf. No new floor island/collider.
        add("frame",.46,1.07,0,.62,.15,2.72,"reception-counter");
        add("panel",.48,1.165,0,.56,.04,2.56,"reception-counter");
        for(const end of [-1,1]){
          add("frame",.46,.535,end*1.16,.45,1.07,.12,"reception-counter");
          add("panel",.7,.61,end*1.16,.035,.72,.085,"reception-counter");
        }
        add("light",.785,.96,0,.025,.045,1.35,"reception-counter");
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
    // Paired planted light-wells give the ground-floor service wall a real
    // lobby composition instead of leaving the check-in/parcel bay floating
    // alone. They stay shallow against the west wall, clear of the reception
    // counter, central combat route, authored dividers and loot sockets.
    if(floor===0&&clearBay(z,3.05,floorY)) {
      const add=(finish:ResidentialPart["finish"],distance:number,y:number,dz:number,sx:number,sy:number,sz:number)=>
        parts.push({finish,position:{x:wallFace+distance,y:floorY+y,z:z+dz},scale:{x:sx,y:sy,z:sz},role:"lobby-planter"});
      for(const side of [-1,1]) {
        const center=side*2.48;
        add("frame",.42,.25,center,.72,.5,.82);
        add("panel",.48,.53,center,.58,.09,.68);
        add("light",.785,.35,center,.025,.08,.56);
        // Three small octahedral leaf clusters reuse the shared grass/canopy
        // path. Their shallow wall-normal reach stays within the planter base;
        // staggered width/height reads as foliage rather than a solid bush wall.
        add("foliage",.48,.84,center-side*.2,.28,.42,.48);
        add("foliage",.48,.75,center+side*.22,.25,.34,.4);
        add("foliage",.48,.65,center,.3,.27,.52);
      }
    }
    // High mounted wayfinding is readable from the stair landing, not a false door.
    const signZ=z-depth*.29;
    signs.push({text:floor===0?(structure.archetype==="hotel"?"HOTEL LOUNGE":"RESIDENT LOUNGE"):`LEVEL ${String(floor+1).padStart(2,"0")}`,
      position:{x:wallFace+.25,y:floorY+Math.min(4,structure.size.y/structure.floors-.85),z:signZ},width:3.1});
  }
  return {parts,signs};
}
