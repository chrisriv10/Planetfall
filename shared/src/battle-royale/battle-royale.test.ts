import { describe, expect, it } from "vitest";
import { BR_ROAD_ROUTES, brAuthoredDeckHeight, brFloorHeightAt } from "./index.js";
import {
  BR_BALANCE, BR_BOT_DIFFICULTY, BR_CRATE_SOCKETS, BR_DISTRICT_PLANS, BR_ISLAND_OUTLINE, BR_LOOT_SOCKETS, BR_MAP, BR_MAP_BLOCKS, BR_NAV_NODES, BR_POIS, BR_ROADS, BR_SECONDARY_LOCATIONS, BR_STORM_PHASES, BR_STRUCTURES, BR_TERRACES, BR_TERRAIN_PATCHES, BR_WEAPONS, applyBrDamage, brApproachPlanarVelocity, brBlockPlanarHalfExtents, brDropVelocity, brFlatDeckCollision, brForcedDropVelocity, brHasStandingClearance, brMantleTopAt, brMuzzlePosition, brNextWaypoint, brPlayerHitDistance, brRarityDamage, brRoadGradeFloorAt, brRoadIntersectsFootprint, brShipPath, isInsideBrIsland, isInsideBrIslandInterior,
  brBlocksNear, brPickupDisposition, createEmptyBrInventory, raySphereDistance, reloadBrItem, stepBrMovement, stormContains, type BrInventoryItem, type BrMotionState
} from "./index.js";

describe("Battle Royale shared rules", () => {
  it("preserves exact ordered collision candidates across cache cells and broad queries", () => {
    for (let x = -600; x <= 600; x += 25) for (let z = -600; z <= 600; z += 25) {
      for (const radius of [0, .6, 2.5, 8, 96]) {
        const point = { x: x + .001, y: 0, z: z - .001 };
        const original = BR_MAP_BLOCKS.filter(block => {const half=brBlockPlanarHalfExtents(block);return Math.abs(block.position.x-point.x)<=half.x+radius && Math.abs(block.position.z-point.z)<=half.z+radius;});
        expect(brBlocksNear(point, radius)).toEqual(original);
      }
    }
  });

  it("broadphases the low approach of rotated service-road grades",()=>{
    for(const road of BR_ROADS.filter(entry=>entry.id.endsWith("-grade"))){
      const midpoint={x:road.to.x,y:road.to.y,z:road.to.z};
      expect(brBlocksNear(midpoint,BR_BALANCE.playerRadius+.25).some(block=>block.id===`${road.id}-surface`),road.id).toBe(true);
    }
  });
  it("distinguishes stackable pickups, full ammo and an explicit inventory swap", () => {
    const inventory=createEmptyBrInventory().map((_,index):BrInventoryItem=>({instanceId:`slot-${index}`,itemId:"pulse-rifle",rarity:"common",count:1,magazine:30}));
    const ammo={light:999,heavy:0,plasma:0};const position={x:0,y:0,z:0};
    expect(brPickupDisposition(inventory,ammo,{id:"ammo",ammoType:"light",rarity:"common",position,count:10})).toBe("full");
    expect(brPickupDisposition(inventory,ammo,{id:"gun",itemId:"rail-laser",rarity:"rare",position,count:1})).toBe("swap");
    inventory[2]={instanceId:"patch",itemId:"med-patch",rarity:"common",count:3,magazine:0};
    expect(brPickupDisposition(inventory,ammo,{id:"heal",itemId:"med-patch",rarity:"common",position,count:2})).toBe("collect");
    const empty=createEmptyBrInventory();
    expect(brPickupDisposition(empty,ammo,{id:"gun",itemId:"rail-laser",rarity:"rare",position,count:1})).toBe("collect");
  });
  it("applies combat damage to Shield before HP and storm damage directly to HP", () => {
    expect(applyBrDamage(100, 25, 50)).toEqual({ hp: 75, shield: 0, hpDamage: 25, shieldDamage: 25, shieldBroken: true });
    expect(applyBrDamage(100, 25, 50, true)).toEqual({ hp: 50, shield: 25, hpDamage: 50, shieldDamage: 0, shieldBroken: false });
  });

  it("keeps rarity scaling bounded and every weapon mechanically defined", () => {
    for (const weapon of Object.values(BR_WEAPONS)) {
      expect(weapon.damage).toBeGreaterThan(0);
      expect(weapon.fireIntervalMs).toBeGreaterThan(0);
      expect(brRarityDamage(weapon.id, "legendary") / brRarityDamage(weapon.id, "common")).toBeCloseTo(1.18);
    }
  });

  it("reloads only the available ammunition into a magazine", () => {
    const item: BrInventoryItem = { instanceId: "x", itemId: "pulse-rifle", rarity: "common", count: 1, magazine: 24 };
    const ammo = { light: 4, heavy: 0, plasma: 0 };
    expect(reloadBrItem(item, ammo)).toBe(4);
    expect(item.magazine).toBe(28);
    expect(ammo.light).toBe(0);
    expect(createEmptyBrInventory()).toEqual([null, null, null, null, null]);
  });

  it("generates a ship route crossing the playable island", () => {
    for (const seed of [1, 42, 99_123]) {
      const route = brShipPath(seed);
      expect(Math.hypot(route.start.x, route.start.z)).toBeGreaterThan(BR_MAP.radius);
      expect(Math.hypot(route.end.x, route.end.z)).toBeGreaterThan(BR_MAP.radius);
      const midpoint = { x: (route.start.x + route.end.x) / 2, z: (route.start.z + route.end.z) / 2 };
      expect(Math.hypot(midpoint.x, midpoint.z)).toBeLessThan(BR_MAP.radius);
    }
  });

  it("distinguishes expanded island reach from a genuinely safe interior inset",()=>{
    const edge={x:BR_ISLAND_OUTLINE[0][0],y:0,z:BR_ISLAND_OUTLINE[0][1]};
    expect(isInsideBrIsland(edge,20)).toBe(true);
    expect(isInsideBrIslandInterior(edge,20)).toBe(false);
    expect(isInsideBrIslandInterior({x:0,y:0,z:0},20)).toBe(true);
  });

  it("validates storm containment and ray intersections deterministically", () => {
    const storm = { phaseIndex: 0, center: { x: 0, z: 0 }, radius: 100, nextCenter: { x: 0, z: 0 }, nextRadius: BR_STORM_PHASES[0].radius, stage: "waiting" as const, stageEndsAt: null, damagePerSecond: 1 };
    expect(stormContains(storm, { x: 99, y: 4, z: 0 })).toBe(true);
    expect(stormContains(storm, { x: 101, y: 4, z: 0 })).toBe(false);
    expect(raySphereDistance({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 1)).toBeCloseTo(9);
    expect(raySphereDistance({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 10, z: 0 }, 1)).toBeNull();
    expect(BR_BALANCE.maxPlayers).toBe(40);
  });

  it("keeps bot difficulty bounded without changing authoritative rules", () => {
    expect(BR_BOT_DIFFICULTY.easy.reactionMs).toBeGreaterThan(BR_BOT_DIFFICULTY.normal.reactionMs);
    expect(BR_BOT_DIFFICULTY.normal.reactionMs).toBeGreaterThan(BR_BOT_DIFFICULTY.hard.reactionMs);
    expect(BR_BOT_DIFFICULTY.easy.aimError).toBeGreaterThan(BR_BOT_DIFFICULTY.hard.aimError);
    expect(BR_BOT_DIFFICULTY.hard.aggression).toBeLessThan(1);
  });

  it("connects interior inclines to upper landings without covering the stairwell",()=>{
    let checked=0;
    for(const structure of BR_STRUCTURES.filter(s=>s.enterable))for(let floor=1;floor<structure.floors;floor++){
      const ramp=BR_MAP_BLOCKS.find(b=>b.id===`${structure.id}-stairs-${floor}`)!;
      const landing=BR_MAP_BLOCKS.find(b=>b.id===`${structure.id}-deck-${floor}-landing`)!;
      const angle=ramp.rotation!.x;
      const highY=ramp.position.y+Math.sin(angle)*ramp.size.z/2;
      const highZ=ramp.position.z-Math.cos(angle)*ramp.size.z/2;
      expect(highY).toBeCloseTo(landing.position.y,8);
      expect(highZ).toBeCloseTo(landing.position.z+landing.size.z/2,8);
      expect(landing.position.z-landing.size.z/2).toBeCloseTo(structure.position.z-structure.size.z/2,8);
      expect(landing.size.z).toBeGreaterThanOrEqual(1.49);
      expect(landing.size.z).toBeLessThan(structure.size.z/2);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("keeps authored room plans inside their shells with a clear entrance approach",()=>{
    let checked=0;
    for(const structure of BR_STRUCTURES.filter(entry=>entry.enterable)){
      const roomWalls=BR_MAP_BLOCKS.filter(block=>block.id.startsWith(`${structure.id}-room-`));
      if(roomWalls.length){
        const storeyHeight=structure.size.y/structure.floors;
        for(let floor=0;floor<structure.floors;floor++)expect(
          roomWalls.some(wall=>wall.position.y>structure.position.y+floor*storeyHeight&&wall.position.y<structure.position.y+(floor+1)*storeyHeight),
          `${structure.id} has no authored room plan on level ${floor+1}`
        ).toBe(true);
      }
      for(const wall of roomWalls){
        expect(Math.abs(wall.position.x-structure.position.x)+wall.size.x/2,`${wall.id} escapes the shell on X`).toBeLessThanOrEqual(structure.size.x/2+.001);
        expect(Math.abs(wall.position.z-structure.position.z)+wall.size.z/2,`${wall.id} escapes the shell on Z`).toBeLessThanOrEqual(structure.size.z/2+.001);
        checked++;
      }
      const direction=structure.entrance==="north"?{x:0,z:-1}:structure.entrance==="south"?{x:0,z:1}:structure.entrance==="east"?{x:-1,z:0}:{x:1,z:0};
      const edge={
        x:structure.position.x-direction.x*(structure.entrance==="east"||structure.entrance==="west"?structure.size.x/2:structure.size.z/2),
        z:structure.position.z-direction.z*(structure.entrance==="north"||structure.entrance==="south"?structure.size.z/2:structure.size.x/2)
      };
      for(const distance of [1,2.5,4]){
        const point={x:edge.x+direction.x*distance,z:edge.z+direction.z*distance};
        for(const wall of roomWalls){
          const blocked=Math.abs(point.x-wall.position.x)<=wall.size.x/2+.6&&Math.abs(point.z-wall.position.z)<=wall.size.z/2+.6;
          expect(blocked,`${wall.id} blocks the ${structure.entrance} entrance approach`).toBe(false);
        }
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("joins every roof ramp centerline to the deck and building edge in every orientation", () => {
    const directions=new Set<string>();
    for(const structure of BR_STRUCTURES.filter(s=>s.enterable&&s.roofAccess)){
      const accessSide=structure.roofAccessSide??structure.entrance;
      directions.add(accessSide);
      const ramp=BR_MAP_BLOCKS.find(b=>b.id===`${structure.id}-roof-ramp`)!;
      const ns=accessSide==="north"||accessSide==="south";
      const sign=accessSide==="north"||accessSide==="east"?1:-1;
      const axis=ns?"z":"x",angle=ns?ramp.rotation!.x:ramp.rotation!.z;
      const along=-sign*ramp.size[axis]/2;
      const highY=ramp.position.y+(ns?-Math.sin(angle):Math.sin(angle))*along;
      const highAxis=ramp.position[axis]+Math.cos(angle)*along;
      expect(highY).toBeCloseTo(structure.position.y+structure.size.y,8);
      expect(highAxis).toBeCloseTo(structure.position[axis]+sign*structure.size[axis]/2,8);
      expect(ramp.position.y-(highY-ramp.position.y)).toBeCloseTo(structure.position.y,8);
    }
    expect(directions.size).toBe(4);
  });

  it("gives residential neighborhoods their intended architectural identity", () => {
    for (const id of ["horizon-homes","northwest-housing","academy-dorms"]) {
      const structures=BR_STRUCTURES.filter(s=>s.districtId===id);
      expect(structures[0].archetype).toBe("apartment");
      expect(structures.some(s=>s.archetype==="shop")).toBe(true);
      expect(structures.some(s=>s.archetype==="hangar"||s.archetype==="greenhouse")).toBe(false);
    }
    expect(BR_STRUCTURES.find(s=>s.id==="comet-hotel-1")?.archetype).toBe("hotel");
  });

  it("keeps every structure shell clear of authored roads and neighboring secondary structures",()=>{
    const secondaryIds=new Set(BR_SECONDARY_LOCATIONS.map((entry)=>entry.id));
    const secondary=BR_STRUCTURES.filter((entry)=>secondaryIds.has(entry.districtId));
    for(const structure of BR_STRUCTURES)for(const road of BR_ROADS){
      expect(brRoadIntersectsFootprint(road,structure.position,structure.size,.2),`${structure.id} overlaps ${road.id}`).toBe(false);
    }
    for(let first=0;first<BR_STRUCTURES.length;first++)for(let second=first+1;second<BR_STRUCTURES.length;second++){
      const a=BR_STRUCTURES[first],b=BR_STRUCTURES[second];
      if(!secondaryIds.has(a.districtId)&&!secondaryIds.has(b.districtId))continue;
      const overlapsX=Math.abs(a.position.x-b.position.x)<(a.size.x+b.size.x)/2;
      const overlapsZ=Math.abs(a.position.z-b.position.z)<(a.size.z+b.size.z)/2;
      expect(overlapsX&&overlapsZ,`${a.id} overlaps ${b.id}`).toBe(false);
    }
  });

  it("builds one authored island with nine distinct connected districts and enterable structures", () => {
    expect(BR_POIS).toHaveLength(9);
    expect(BR_SECONDARY_LOCATIONS).toHaveLength(39);
    expect(BR_ISLAND_OUTLINE.length).toBeGreaterThanOrEqual(16);
    expect(BR_STRUCTURES).toHaveLength(185);
    expect(BR_STRUCTURES.filter((structure)=>structure.enterable)).toHaveLength(103);
    expect(BR_ROADS.length).toBeGreaterThanOrEqual(46);
    expect(BR_TERRAIN_PATCHES.length).toBeGreaterThanOrEqual(BR_POIS.length);
    for (const poi of BR_POIS) {
      const structures = BR_STRUCTURES.filter((structure) => structure.districtId === poi.id);
      const blocks = BR_MAP_BLOCKS.filter((block) => block.districtId === poi.id);
      expect(structures.length).toBeGreaterThanOrEqual(3);
      expect(blocks.some((block) => block.id.endsWith("floor"))).toBe(true);
      expect(blocks.some((block) => block.id.endsWith("roof"))).toBe(true);
      expect(blocks.filter((block) => block.kind === "wall").length).toBeGreaterThanOrEqual(10);
      expect(structures.some((structure) => structure.roofAccess)).toBe(true);
      expect(isInsideBrIsland(poi.position)).toBe(true);
    }
    for(const location of BR_SECONDARY_LOCATIONS){expect(isInsideBrIsland(location.position)).toBe(true);expect(BR_STRUCTURES.filter((structure)=>structure.districtId===location.id)).toHaveLength(["transit-court","south-exchange","farm-transfer","ring-service"].includes(location.id)?4:3);}
    for(const structure of BR_STRUCTURES){expect(isInsideBrIsland(structure.position)).toBe(true);for(const [sx,sz] of [[-1,-1],[-1,1],[1,-1],[1,1]] as const)expect(isInsideBrIsland({x:structure.position.x+sx*structure.size.x/2,y:0,z:structure.position.z+sz*structure.size.z/2})).toBe(true);}
    expect(BR_MAP_BLOCKS.filter((block)=>block.kind==="ramp").length).toBeGreaterThanOrEqual(15);
    for(const patch of BR_TERRAIN_PATCHES) expect(isInsideBrIsland(patch.position)).toBe(true);
  });

  it("encloses the south-ring junction with accessible facing buildings, not scattered deck props",()=>{
    const plan=BR_DISTRICT_PLANS.find(p=>p.id==="south-exchange")!;
    const structures=BR_STRUCTURES.filter(s=>s.districtId===plan.id);
    expect(structures).toHaveLength(4);
    expect(structures.every(s=>s.enterable)).toBe(true);
    const main=BR_ROAD_ROUTES.find(r=>r.id==="south-exchange-main")!;
    const ring=BR_ROAD_ROUTES.find(r=>r.id==="ring-s")!;
    expect(main.from).toEqual({x:-76,y:.1,z:-310});
    expect(main.to).toEqual({x:-76,y:.1,z:-390});
    for(const s of structures){
      expect(s.entrance).toBe(s.position.x<main.from.x?"east":"west");
      expect(Math.abs(s.position.x-main.from.x)-s.size.x/2).toBe(13);
      for(const road of BR_ROADS)expect(brRoadIntersectsFootprint(road,s.position,s.size,1),`${s.id}: ${road.id}`).toBe(false);
      const loot=BR_LOOT_SOCKETS.filter(socket=>socket.structureId===s.id);
      expect(loot.length).toBeGreaterThan(0);
      expect(loot.every(socket=>socket.position.y>s.position.y)).toBe(true);
    }
    expect(ring.from.z).toBe(-340);
    expect(main.from.z).toBeGreaterThan(ring.from.z);
    expect(main.to.z).toBeLessThan(ring.from.z);
    for(const z of [-330,-340,-350,-357,-366]){
      const p={x:-76,y:.035,z};
      const result=brFlatDeckCollision(p,{x:0,y:0,z:.1},false);
      expect(result?.grounded,`street at ${z}`).toBe(true);
    }
  });

  it("replaces the empty Helios–Farms underpass with a raised transfer block and continuous street joins",()=>{
    const plan=BR_DISTRICT_PLANS.find(p=>p.id==="farm-transfer")!;
    expect(plan.origin).toEqual({x:189,y:4,z:196});
    const structures=BR_STRUCTURES.filter(s=>s.districtId===plan.id);
    expect(structures).toHaveLength(4);
    expect(structures.every(s=>s.enterable&&s.position.y===4)).toBe(true);
    expect(new Set(structures.map(s=>s.archetype))).toEqual(new Set(["warehouse","shop","office","utility"]));
    for(const s of structures)for(const [sx,sz] of [[-1,-1],[-1,1],[1,-1],[1,1]] as const){
      expect(brAuthoredDeckHeight({x:s.position.x+sx*s.size.x/2,z:s.position.z+sz*s.size.z/2}),s.id).toBe(4);
    }
    const links=["transit-farm-boulevard","transit-farm-boulevard-entry","transit-farm-boulevard-middle","transit-farm-boulevard-farm"].map(id=>BR_ROAD_ROUTES.find(r=>r.id===id)!);
    for(let i=1;i<links.length;i++){
      expect(links[i-1].to).toEqual(links[i].from);
      expect(links[i].from.y).toBe(4.1);expect(links[i].to.y).toBe(4.1);
    }
    const main=BR_ROAD_ROUTES.find(r=>r.id==="farm-transfer-main")!;
    expect(main.to).toEqual({x:189,y:4.1,z:220});
    const farms=BR_ROAD_ROUTES.find(r=>r.id==="farm-circulation-s")!;
    expect(main.to.z).toBe(farms.from.z);expect(main.to.y).toBe(farms.from.y);
    expect(main.to.x).toBeGreaterThan(farms.from.x);expect(main.to.x).toBeLessThan(farms.to.x);
    const p={x:180,y:4.035,z:199};
    expect(brFloorHeightAt(p,p.y+2.5)).toBe(4);
    const result=brFlatDeckCollision(p,{x:.03,y:-.1,z:0},false)!;
    expect(result.grounded).toBe(true);expect(p.y+result.movement.y).toBeCloseTo(4.035);
    const sockets=BR_LOOT_SOCKETS.filter(s=>s.districtId===plan.id);
    expect(sockets.length).toBeGreaterThanOrEqual(8);
    expect(sockets.every(s=>s.position.y>4)).toBe(true);
  });

  it("uses a fixed road-first Nova Plaza plan with a connected four-way intersection",()=>{
    const streets=BR_ROAD_ROUTES.filter(road=>road.id.startsWith("nova-street-"));
    expect(streets.map(road=>road.id).sort()).toEqual([
      "nova-street-a-east","nova-street-a-west","nova-street-b-north","nova-street-b-south"
    ]);
    for(const street of streets)expect([street.from,street.to].some(point=>point.x===-175&&point.z===-135)).toBe(true);
    const intersection=BR_NAV_NODES.find(node=>node.position.x===-175&&node.position.z===-135);
    expect(intersection?.neighbors.length).toBeGreaterThanOrEqual(4);
    for(const structure of BR_STRUCTURES.filter(entry=>entry.districtId==="nova-plaza")){
      for(const street of streets)expect(brRoadIntersectsFootprint(street,structure.position,structure.size,.2),`${structure.id} blocks ${street.id}`).toBe(false);
    }
  });

  it("authors fixed raised terraces with aligned playable ramps",()=>{
    const raisedDistricts=BR_TERRACES.filter(terrace=>terrace.gradedRoadAccess);
    expect(raisedDistricts.length).toBeGreaterThanOrEqual(8);
    expect(Math.max(...raisedDistricts.map(terrace=>terrace.height))).toBeGreaterThanOrEqual(8);
    expect(new Set(BR_TERRACES.map(terrace=>terrace.height)).size).toBeGreaterThanOrEqual(4);
    for(const terrace of BR_TERRACES){
      const platform=BR_MAP_BLOCKS.find(block=>block.id===`${terrace.id}-platform`)!;
      const ramp=BR_MAP_BLOCKS.find(block=>block.id===`${terrace.id}-ramp`)!;
      expect(platform).toBeTruthy();
      expect(platform.position.y+platform.size.y/2).toBeCloseTo(terrace.height+(terrace.gradedRoadAccess?0:brAuthoredDeckHeight(terrace.position)),8);
      if(terrace.gradedRoadAccess){
        expect(ramp).toBeUndefined();
        const grade=BR_MAP_BLOCKS.find(block=>block.kind==="ramp"&&block.districtId===terrace.districtId&&block.id.endsWith("-surface"));
        expect(grade,`${terrace.id} has no road grade`).toBeTruthy();
        for(const structure of BR_STRUCTURES.filter(entry=>entry.districtId===terrace.districtId)){
          expect(structure.position.y).toBe(terrace.height);
          expect(Math.abs(structure.position.x-platform.position.x)+structure.size.x/2).toBeLessThanOrEqual(platform.size.x/2+.01);
          expect(Math.abs(structure.position.z-platform.position.z)+structure.size.z/2).toBeLessThanOrEqual(platform.size.z/2+.01);
        }
        continue;
      }
      expect(ramp).toBeTruthy();
      const northSouth=terrace.accessSide==="north"||terrace.accessSide==="south";
      const angle=northSouth?ramp.rotation!.x:ramp.rotation!.z;
      expect(Math.abs(Math.sin(angle)*(northSouth?ramp.size.z:ramp.size.x))).toBeCloseTo(terrace.height,8);
      for(const road of BR_ROADS)expect(brRoadIntersectsFootprint(road,ramp.position,ramp.size,.1),`${ramp.id} overlaps ${road.id}`).toBe(false);
      for(const structure of BR_STRUCTURES){
        const overlaps=Math.abs(platform.position.x-structure.position.x)<(platform.size.x+structure.size.x)/2+.2
          &&Math.abs(platform.position.z-structure.position.z)<(platform.size.z+structure.size.z)/2+.2;
        expect(overlaps,`${platform.id} overlaps ${structure.id}`).toBe(false);
      }
    }
  });

  it("keeps independent exterior traversal ramps out of one another's lanes",()=>{
    const exterior=BR_MAP_BLOCKS.filter(block=>block.kind==="ramp"&&(block.id.endsWith("-roof-ramp")||BR_TERRACES.some(terrace=>block.id===`${terrace.id}-ramp`)));
    for(let first=0;first<exterior.length;first++)for(let second=first+1;second<exterior.length;second++){
      const a=exterior[first],b=exterior[second];
      const overlapsX=Math.abs(a.position.x-b.position.x)<(a.size.x+b.size.x)/2+.5;
      const overlapsZ=Math.abs(a.position.z-b.position.z)<(a.size.z+b.size.z)/2+.5;
      expect(overlapsX&&overlapsZ,`${a.id} collides with ${b.id}`).toBe(false);
    }
  });

  it("keeps every district connected and places loot in authored playable structures",()=>{
    const visited=new Set<string>([BR_NAV_NODES[0].id]),queue=[BR_NAV_NODES[0].id];while(queue.length){const current=queue.shift()!;const node=BR_NAV_NODES.find((entry)=>entry.id===current)!;for(const next of node.neighbors)if(!visited.has(next)){visited.add(next);queue.push(next);}}
    expect(visited.size).toBe(BR_NAV_NODES.length);expect(BR_LOOT_SOCKETS.length).toBeGreaterThan(BR_STRUCTURES.filter((structure)=>structure.enterable).length);expect(BR_CRATE_SOCKETS).toHaveLength(BR_POIS.length+Math.ceil(BR_SECONDARY_LOCATIONS.length/3));
    for(const socket of BR_LOOT_SOCKETS){expect(isInsideBrIsland(socket.position)).toBe(true);const structure=BR_STRUCTURES.find((entry)=>entry.id===socket.structureId)!;expect(structure).toBeTruthy();expect(Math.abs(socket.position.x-structure.position.x)).toBeLessThan(structure.size.x/2);expect(Math.abs(socket.position.z-structure.position.z)).toBeLessThan(structure.size.z/2);expect(socket.position.y).toBeGreaterThan(structure.position.y);}
    for(const crate of BR_CRATE_SOCKETS)expect(isInsideBrIsland(crate)).toBe(true);
    for(const target of BR_POIS.slice(1))expect(isInsideBrIsland(brNextWaypoint(BR_POIS[0].position,target.position))).toBe(true);
  });

  it("keeps bot navigation goals outside authored building footprints",()=>{
    const byId=new Map(BR_NAV_NODES.map(node=>[node.id,node]));
    for(const node of BR_NAV_NODES){
      expect(isInsideBrIsland(node.position,5),node.id).toBe(true);
      for(const structure of BR_STRUCTURES){
        const overlaps=Math.abs(node.position.x-structure.position.x)<=structure.size.x/2+2&&Math.abs(node.position.z-structure.position.z)<=structure.size.z/2+2;
        expect(overlaps,`${node.id} is trapped inside ${structure.id}`).toBe(false);
      }
      for(const neighborId of node.neighbors){
        if(node.id>=neighborId)continue;
        const neighbor=byId.get(neighborId)!;
        const edge={id:`${node.id}-${neighbor.id}`,from:node.position,to:neighbor.position,width:0};
        for(const structure of BR_STRUCTURES)expect(brRoadIntersectsFootprint(edge,structure.position,structure.size,1),`${edge.id} crosses ${structure.id}`).toBe(false);
      }
    }
  });

  it("keeps exterior roof access clear of roads and neighboring buildings",()=>{
    const ramps=BR_MAP_BLOCKS.filter(block=>block.id.endsWith("-roof-ramp"));
    // Roof access is intentional vertical design, not a default appendage on
    // every building. Keep enough routes for each major district while
    // preventing the old forest of long exterior ramps from returning.
    expect(ramps.length).toBeGreaterThanOrEqual(9);
    expect(ramps.length).toBeLessThanOrEqual(16);
    for(const ramp of ramps){
      for(const road of BR_ROADS)expect(brRoadIntersectsFootprint(road,ramp.position,ramp.size,.1),`${ramp.id} overlaps ${road.id}`).toBe(false);
      const ownerId=ramp.id.slice(0,-"-roof-ramp".length);
      for(const structure of BR_STRUCTURES){
        if(structure.id===ownerId)continue;
        const overlaps=Math.abs(ramp.position.x-structure.position.x)<(ramp.size.x+structure.size.x)/2+.2
          &&Math.abs(ramp.position.z-structure.position.z)<(ramp.size.z+structure.size.z)/2+.2;
        expect(overlaps,`${ramp.id} overlaps ${structure.id}`).toBe(false);
      }
    }
  });

  it("authors complete secondary districts with connected circulation and reserved open space",()=>{
    expect(BR_DISTRICT_PLANS).toHaveLength(BR_SECONDARY_LOCATIONS.length);
    const distanceToSegment=(point:{x:number;z:number},from:{x:number;z:number},to:{x:number;z:number})=>{
      const dx=to.x-from.x,dz=to.z-from.z,denominator=dx*dx+dz*dz;
      const amount=denominator<=1e-8?0:Math.max(0,Math.min(1,((point.x-from.x)*dx+(point.z-from.z)*dz)/denominator));
      return Math.hypot(point.x-(from.x+dx*amount),point.z-(from.z+dz*amount));
    };
    const arterials=BR_ROADS.filter(road=>road.kind==="arterial");
    const serviceRoads=BR_ROADS.filter(road=>road.kind==="service");
    expect(Math.max(...serviceRoads.map(road=>Math.hypot(road.to.x-road.from.x,road.to.z-road.from.z)))).toBeLessThanOrEqual(125);
    for(const plan of BR_DISTRICT_PLANS){
      const location=BR_SECONDARY_LOCATIONS.find(entry=>entry.id===plan.id)!;
      expect(plan.origin).toEqual(location.position);
      expect(plan.parcels).toHaveLength(BR_STRUCTURES.filter(structure=>structure.districtId===plan.id).length);
      expect(new Set(plan.parcels.map(parcel=>parcel.role))).toEqual(new Set(["anchor","support","service"]));
      expect(plan.streets.length).toBeGreaterThanOrEqual(2);
      expect(plan.streets.some(street=>distanceToSegment(plan.origin,street.from,street.to)<.01)).toBe(true);
      const serviceId=`service-${BR_SECONDARY_LOCATIONS.findIndex(location=>location.id===plan.id)}`;
      const service=BR_ROAD_ROUTES.find(road=>road.id===serviceId||road.id===`${serviceId}-grade`);
      // These blocks straddle existing collectors at their actual origins;
      // they do not need duplicate indexed service-road geometry.
      // Civic Frontage extends the lower Security route, using its established
      // feeder to Zero rather than duplicating it or joining the upper bridge.
      const connection=plan.id==="civic-frontage"?BR_ROAD_ROUTES.find(r=>r.id==="service-23")?.to:
        ["ring-service","west-junction","transfer-yard","nova-landing"].includes(plan.id)?plan.origin:service?.to;
      expect(connection,`${plan.id} arterial access`).toBeDefined();
      expect(Math.min(...arterials.map(road=>distanceToSegment(connection!,road.from,road.to)))).toBeLessThan(.01);
      for(const endpoint of plan.streets.flatMap(street=>[street.from,street.to]))expect(isInsideBrIsland(endpoint,3)).toBe(true);
      for(const structure of BR_STRUCTURES.filter(entry=>entry.districtId===plan.id)){
        const parcel=plan.parcels.find(entry=>entry.id.replace("-parcel-","-")===structure.id)!;
        expect(parcel).toBeTruthy();
        expect(structure.position).toEqual(parcel.position);
        expect(Math.hypot(structure.position.x-plan.origin.x,structure.position.z-plan.origin.z)).toBeLessThanOrEqual(68);
        const overlapsOpenZone=Math.abs(structure.position.x-plan.openZone.position.x)<structure.size.x/2+plan.openZone.radius
          &&Math.abs(structure.position.z-plan.openZone.position.z)<structure.size.z/2+plan.openZone.radius;
        expect(overlapsOpenZone,`${structure.id} occupies ${plan.openZone.purpose}`).toBe(false);
      }
    }
  });

  it("joins the two raised southern districts with one continuous walkable transfer bridge",()=>{
    const bridge=BR_ROAD_ROUTES.find(road=>road.id==="south-transfer-bridge");
    const terminal=BR_ROAD_ROUTES.find(road=>road.id==="south-terminal-main");
    const shipworks=BR_ROAD_ROUTES.find(road=>road.id==="south-shipworks-main");
    expect(bridge).toEqual({
      id:"south-transfer-bridge",
      from:{x:45,y:3.6,z:-415},to:{x:160,y:4.1,z:-400},
      width:9,color:"#33485d",kind:"arterial"
    });
    expect(terminal?.to).toEqual(bridge?.from);
    expect(shipworks?.from).toEqual(bridge?.to);
    const surface=BR_MAP_BLOCKS.find(block=>block.id==="south-transfer-bridge-surface");
    expect(surface?.kind).toBe("ramp");
    expect(brRoadGradeFloorAt(surface!,bridge!.from)).toBeCloseTo(3.5);
    expect(brRoadGradeFloorAt(surface!,bridge!.to)).toBeCloseTo(4);
    expect(brNextWaypoint({x:15,y:3.5,z:-415},{x:190,y:4,z:-400}).y).toBeGreaterThan(3);

    const yaw=Math.atan2(bridge!.to.x-bridge!.from.x,-(bridge!.to.z-bridge!.from.z));
    let rapierJoinFrames=0;
    let motion:BrMotionState={position:{x:45,y:3.5,z:-415},velocity:{x:0,y:0,z:0},yaw,grounded:true,crouched:false,deployment:"grounded",downed:false,lastJumpSignal:false,lastCrouchSignal:false,slideEndsAt:0,traversalCooldownUntil:0,lastGroundedAt:0,jumpBufferedUntil:0};
    for(let tick=0;tick<330;tick++)motion=stepBrMovement(motion,{moveX:0,moveY:1,yaw,jump:false,sprint:true,crouch:false},1/30,tick*1000/30,(position,movement,options)=>{
      const fast=brFlatDeckCollision(position,movement,options.jumping);
      if(fast)return fast;
      // The exact terrace joins intentionally fall through to Rapier in the
      // real controller. Model a grounded no-op for those few frames here;
      // the invariant is that the deterministic grade itself never drops the
      // player through the island or strands them short of Shipworks.
      rapierJoinFrames++;
      return{movement:{x:0,y:0,z:0},grounded:true,ceiling:false};
    });
    expect(rapierJoinFrames).toBeLessThan(25);
    expect(motion.position.x).toBeGreaterThan(159);
    expect(motion.position.y).toBeCloseTo(4.035);
    expect(motion.grounded).toBe(true);
  });

  it("connects the western housing and signal districts without crossing their buildings",()=>{
    const links=["west-neighborhood-link-a","west-neighborhood-link-b","west-neighborhood-link-c"].map(id=>BR_ROAD_ROUTES.find(road=>road.id===id)!);
    expect(links.every(Boolean)).toBe(true);
    expect(links[0].from).toEqual({x:-285,y:.1,z:-30});
    expect(links[0].to).toEqual(links[1].from);
    expect(links[1].to).toEqual(links[2].from);
    expect(links[2].to).toEqual({x:-375,y:.1,z:-125});
    for(const road of links)for(const structure of BR_STRUCTURES){
      expect(brRoadIntersectsFootprint(road,structure.position,structure.size,1),`${road.id} crosses ${structure.id}`).toBe(false);
    }
    const next=brNextWaypoint({x:-285,y:0,z:-30},{x:-405,y:0,z:-125});
    expect(next.x).toBeLessThan(-340);
    expect(next.z).toBeLessThan(-100);
  });

  it("continues the western neighborhood avenue through Signal Station into Nova",()=>{
    const avenue=BR_ROAD_ROUTES.find(road=>road.id==="west-transit-avenue")!;
    const signal=BR_ROAD_ROUTES.find(road=>road.id==="signal-station-main")!;
    const nova=BR_ROAD_ROUTES.find(road=>road.id==="nova-street-a-west")!;
    expect(avenue.from).toEqual(signal.to);
    expect({x:avenue.to.x,z:avenue.to.z}).toEqual({x:nova.from.x,z:nova.from.z});
    expect(avenue.to.y).toBeCloseTo(nova.from.y,1);
    expect(Math.hypot(avenue.to.x-avenue.from.x,avenue.to.z-avenue.from.z)).toBeGreaterThan(120);
    for(const structure of BR_STRUCTURES){
      expect(brRoadIntersectsFootprint(avenue,structure.position,structure.size,1),`avenue crosses ${structure.id}`).toBe(false);
    }
  });

  it("closes the North Gardens and Mall Annex street loop with a clear promenade",()=>{
    const promenade=BR_ROAD_ROUTES.find(road=>road.id==="north-garden-promenade")!;
    const gardens=BR_ROAD_ROUTES.find(road=>road.id==="north-gardens-main")!;
    const mall=BR_ROAD_ROUTES.find(road=>road.id==="mall-annex-main")!;
    expect(promenade.from).toEqual(gardens.from);
    expect(promenade.to).toEqual(mall.to);
    expect(Math.hypot(promenade.to.x-promenade.from.x,promenade.to.z-promenade.from.z)).toBeGreaterThan(100);
    for(const structure of BR_STRUCTURES){
      expect(brRoadIntersectsFootprint(promenade,structure.position,structure.size,1),`promenade crosses ${structure.id}`).toBe(false);
    }
  });

  it("descends from Emergency Depot into Salvage Row through the southwest connective field",()=>{
    const grade=BR_ROAD_ROUTES.find(road=>road.id==="southwest-salvage-grade")!;
    const link=BR_ROAD_ROUTES.find(road=>road.id==="southwest-salvage-link")!;
    const depot=BR_ROAD_ROUTES.find(road=>road.id==="emergency-depot-main")!;
    const salvage=BR_ROAD_ROUTES.find(road=>road.id==="salvage-row-cross")!;
    expect(grade.from).toEqual(depot.from);
    expect(grade.to).toEqual(link.from);
    expect(link.to).toEqual(salvage.from);
    const surface=BR_MAP_BLOCKS.find(block=>block.id==="southwest-salvage-grade-surface")!;
    expect(surface.kind).toBe("ramp");
    expect(brRoadGradeFloorAt(surface,grade.from)).toBeCloseTo(5.5);
    expect(brRoadGradeFloorAt(surface,grade.to)).toBeCloseTo(0);
    for(const road of [grade,link])for(const structure of BR_STRUCTURES){
      expect(brRoadIntersectsFootprint(road,structure.position,structure.size,1),`${road.id} crosses ${structure.id}`).toBe(false);
    }
  });

  it("joins Cargo Spur and Dock Service with a clear freight boulevard",()=>{
    const boulevard=BR_ROAD_ROUTES.find(road=>road.id==="south-freight-boulevard")!;
    const cargo=BR_ROAD_ROUTES.find(road=>road.id==="cargo-spur-main")!;
    const dock=BR_ROAD_ROUTES.find(road=>road.id==="dock-service-main")!;
    expect(boulevard.from).toEqual(cargo.to);
    expect(boulevard.to).toEqual(dock.from);
    expect(Math.hypot(boulevard.to.x-boulevard.from.x,boulevard.to.z-boulevard.from.z)).toBeGreaterThan(125);
    for(const structure of BR_STRUCTURES){
      expect(brRoadIntersectsFootprint(boulevard,structure.position,structure.size,1),`boulevard crosses ${structure.id}`).toBe(false);
    }
  });

  it("connects Dock Service, Engine Gate and elevated East Freight as one industrial triangle",()=>{
    const west=BR_ROAD_ROUTES.find(road=>road.id==="dock-engine-link-west")!;
    const east=BR_ROAD_ROUTES.find(road=>road.id==="dock-engine-link-east")!;
    const gate=BR_ROAD_ROUTES.find(road=>road.id==="dock-engine-link-gate")!;
    const freightDeck=BR_ROAD_ROUTES.find(road=>road.id==="east-freight-engine-deck")!;
    const freightTurn=BR_ROAD_ROUTES.find(road=>road.id==="east-freight-engine-deck-turn")!;
    const grade=BR_ROAD_ROUTES.find(road=>road.id==="east-freight-engine-grade")!;
    const dock=BR_ROAD_ROUTES.find(road=>road.id==="dock-service-main")!;
    const engineMain=BR_ROAD_ROUTES.find(road=>road.id==="engine-gate-main")!;
    const engineCross=BR_ROAD_ROUTES.find(road=>road.id==="engine-gate-cross")!;
    const freight=BR_ROAD_ROUTES.find(road=>road.id==="east-freight-main")!;
    expect(west.from).toEqual(dock.to);
    expect(west.to).toEqual(east.from);
    expect(east.to).toEqual(gate.from);
    expect(gate.to).toEqual(engineMain.from);
    expect(freightDeck.from).toEqual(freight.to);
    expect(freightTurn.from).toEqual(freightDeck.to);
    expect(grade.from).toEqual(freightTurn.to);
    expect(grade.to).toEqual(engineCross.from);
    const surface=BR_MAP_BLOCKS.find(block=>block.id==="east-freight-engine-grade-surface")!;
    expect(surface.kind).toBe("ramp");
    expect(brRoadGradeFloorAt(surface,grade.from)).toBeCloseTo(8);
    expect(brRoadGradeFloorAt(surface,grade.to)).toBeCloseTo(0);
    for(const road of [west,east,gate,freightDeck,freightTurn,grade])for(const structure of BR_STRUCTURES){
      expect(brRoadIntersectsFootprint(road,structure.position,structure.size,.75),`${road.id} crosses ${structure.id}`).toBe(false);
    }
  });

  it("forms a clear outer skywalk between Mall Annex and North Gardens",()=>{
    const west=BR_ROAD_ROUTES.find(road=>road.id==="north-skywalk-west")!;
    const east=BR_ROAD_ROUTES.find(road=>road.id==="north-skywalk-east")!;
    const mall=BR_ROAD_ROUTES.find(road=>road.id==="mall-annex-cross")!;
    const gardens=BR_ROAD_ROUTES.find(road=>road.id==="north-gardens-main")!;
    expect(west.from).toEqual(mall.to);
    expect(west.to).toEqual(east.from);
    expect(east.to).toEqual(gardens.from);
    for(const road of [west,east])for(const structure of BR_STRUCTURES){
      expect(brRoadIntersectsFootprint(road,structure.position,structure.size,1),`${road.id} crosses ${structure.id}`).toBe(false);
    }
  });

  it("gives elevated Solar Field a second clear exit into the north ring",()=>{
    const deck=BR_ROAD_ROUTES.find(road=>road.id==="solar-rim-deck-link")!;
    const grade=BR_ROAD_ROUTES.find(road=>road.id==="solar-rim-grade")!;
    const solar=BR_ROAD_ROUTES.find(road=>road.id==="solar-field-main")!;
    const ring=BR_ROAD_ROUTES.find(road=>road.id==="ring-n")!;
    expect(deck.from).toEqual(solar.to);
    expect(grade.from).toEqual(deck.to);
    expect({x:grade.to.x,z:grade.to.z}).toEqual({x:ring.from.x,z:ring.from.z});
    expect(grade.to.y).toBeCloseTo(ring.from.y,1);
    const surface=BR_MAP_BLOCKS.find(block=>block.id==="solar-rim-grade-surface")!;
    expect(surface.kind).toBe("ramp");
    expect(brRoadGradeFloorAt(surface,grade.from)).toBeCloseTo(4);
    expect(brRoadGradeFloorAt(surface,grade.to)).toBeCloseTo(ring.from.y-.1);
    for(const road of [deck,grade])for(const structure of BR_STRUCTURES){
      expect(brRoadIntersectsFootprint(road,structure.position,structure.size,1),`${road.id} crosses ${structure.id}`).toBe(false);
    }
  });

  it("joins the southern civic decks with an inner promenade and outer boardwalk",()=>{
    const ids=["south-rim-promenade","south-rim-boardwalk-west","south-rim-boardwalk-main","south-rim-boardwalk-link"];
    const [promenade,west,main,link]=ids.map(id=>BR_ROAD_ROUTES.find(road=>road.id===id)!);
    const depotMain=BR_ROAD_ROUTES.find(road=>road.id==="emergency-depot-main")!;
    const depotCross=BR_ROAD_ROUTES.find(road=>road.id==="emergency-depot-cross")!;
    const terminalMain=BR_ROAD_ROUTES.find(road=>road.id==="south-terminal-main")!;
    const terminalCross=BR_ROAD_ROUTES.find(road=>road.id==="south-terminal-cross")!;
    expect(promenade.from).toEqual(depotMain.to);
    expect(promenade.to).toEqual(terminalMain.from);
    expect(west.from).toEqual(depotCross.from);
    expect(west.to).toEqual(main.from);
    expect(main.to).toEqual(link.from);
    expect(link.to).toEqual(terminalCross.from);
    for(const road of [promenade,west,main,link])for(const structure of BR_STRUCTURES){
      expect(brRoadIntersectsFootprint(road,structure.position,structure.size,.75),`${road.id} crosses ${structure.id}`).toBe(false);
    }
    const promenadeSurface=BR_MAP_BLOCKS.find(block=>block.id==="south-rim-promenade-surface")!;
    expect(promenadeSurface.kind).toBe("ramp");
    expect(brRoadGradeFloorAt(promenadeSurface,promenade.from)).toBeCloseTo(5.5);
    expect(brRoadGradeFloorAt(promenadeSurface,promenade.to)).toBeCloseTo(3.5);
  });

  it("connects Central Heights, Relay Market and Comet Hotel at one clear civic junction",()=>{
    const west=BR_ROAD_ROUTES.find(road=>road.id==="central-market-avenue-west")!;
    const east=BR_ROAD_ROUTES.find(road=>road.id==="central-market-avenue-east")!;
    const bend=BR_ROAD_ROUTES.find(road=>road.id==="central-market-avenue-bend")!;
    const entry=BR_ROAD_ROUTES.find(road=>road.id==="central-market-avenue-entry")!;
    const hotel=BR_ROAD_ROUTES.find(road=>road.id==="central-hotel-promenade")!;
    const hotelSouth=BR_ROAD_ROUTES.find(road=>road.id==="central-hotel-promenade-south")!;
    const hotelEntry=BR_ROAD_ROUTES.find(road=>road.id==="central-hotel-promenade-entry")!;
    const heights=BR_ROAD_ROUTES.find(road=>road.id==="central-heights-main")!;
    const market=BR_ROAD_ROUTES.find(road=>road.id==="relay-market-main")!;
    const hotelStreet=BR_ROAD_ROUTES.find(road=>road.id==="comet-hotel-main")!;
    expect(west.from).toEqual(heights.to);
    expect(west.to).toEqual(east.from);
    expect(hotel.from).toEqual(east.from);
    expect(east.to).toEqual(bend.from);
    expect(bend.to).toEqual(entry.from);
    expect(entry.to).toEqual(market.from);
    expect(hotel.to).toEqual(hotelSouth.from);
    expect(hotelSouth.to).toEqual(hotelEntry.from);
    expect(hotelEntry.to).toEqual(hotelStreet.to);
    for(const road of [west,east,bend,entry,hotel,hotelSouth,hotelEntry])for(const structure of BR_STRUCTURES){
      expect(brRoadIntersectsFootprint(road,structure.position,structure.size,.75),`${road.id} crosses ${structure.id}`).toBe(false);
    }
  });

  it("builds a clear south-central street grid from Crash through Comet Hotel to Cargo Spur",()=>{
    const vertical=BR_ROAD_ROUTES.find(road=>road.id==="hotel-south-avenue")!;
    const arrival=BR_ROAD_ROUTES.find(road=>road.id==="hotel-south-avenue-entry")!;
    const link=BR_ROAD_ROUTES.find(road=>road.id==="hotel-south-avenue-link")!;
    const west=BR_ROAD_ROUTES.find(road=>road.id==="crash-hotel-avenue")!;
    const east=BR_ROAD_ROUTES.find(road=>road.id==="hotel-cargo-avenue")!;
    const hotel=BR_ROAD_ROUTES.find(road=>road.id==="comet-hotel-cross")!;
    const cargo=BR_ROAD_ROUTES.find(road=>road.id==="cargo-spur-main")!;
    expect(arrival.from).toEqual(hotel.from);
    expect(arrival.to).toEqual(link.from);
    expect(link.to).toEqual(vertical.from);
    expect(vertical.to.z).toBe(-340);
    expect(west.to).toEqual(east.from);
    expect(east.to).toEqual(cargo.from);
    expect(west.to.x).toBe(vertical.to.x);
    expect(BR_ROADS.some(road=>road.id.startsWith("hotel-south-avenue")&&road.from.x===west.to.x&&road.to.x===west.to.x&&road.from.z>=west.to.z&&road.to.z<=west.to.z)).toBe(true);
    expect(west.to.z).toBeGreaterThan(vertical.to.z);
    expect(west.to.z).toBeLessThan(vertical.from.z);
    for(const road of [arrival,link,vertical,west,east])for(const structure of BR_STRUCTURES){
      expect(brRoadIntersectsFootprint(road,structure.position,structure.size,.75),`${road.id} crosses ${structure.id}`).toBe(false);
    }
  });

  it("routes Zero Point traffic directly through the Coolant Plant district",()=>{
    const avenue=BR_ROAD_ROUTES.find(road=>road.id==="zero-coolant-avenue")!;
    const zero=BR_ROAD_ROUTES.find(road=>road.id==="zero-circulation-n")!;
    const coolant=BR_ROAD_ROUTES.find(road=>road.id==="coolant-plant-cross")!;
    expect(avenue.from).toEqual(zero.from);
    expect(avenue.to).toEqual(coolant.from);
    for(const structure of BR_STRUCTURES){
      expect(brRoadIntersectsFootprint(avenue,structure.position,structure.size,1),`avenue crosses ${structure.id}`).toBe(false);
    }
  });

  it("keeps every fixed cover prop clear of roads and building shells",()=>{
    const cover=BR_MAP_BLOCKS.filter(block=>block.kind==="cover");
    expect(cover.length).toBeGreaterThanOrEqual(BR_SECONDARY_LOCATIONS.length+40);
    for(const block of cover){
      expect([...BR_POIS,...BR_SECONDARY_LOCATIONS].some(location=>location.id===block.districtId)).toBe(true);
      expect(isInsideBrIsland(block.position)).toBe(true);
      for(const road of BR_ROADS)expect(brRoadIntersectsFootprint(road,block.position,block.size,.5),`${block.id} overlaps ${road.id}`).toBe(false);
      for(const structure of BR_STRUCTURES){
        const overlaps=Math.abs(block.position.x-structure.position.x)<(block.size.x+structure.size.x)/2+.5
          &&Math.abs(block.position.z-structure.position.z)<(block.size.z+structure.size.z)/2+.5;
        expect(overlaps,`${block.id} overlaps ${structure.id}`).toBe(false);
      }
    }
  });

  it("keeps authored tactical cover on all four long district transitions",()=>{
    const expected:Record<string,[number,number]>={
      "coolant-exchange-cover-west":[-43,125],"coolant-exchange-cover-east":[-7,125],
      "south-orbit-cover-west":[7,-175],"south-orbit-cover-east":[43,-175],
      "crash-transit-cover-west":[-218,-275],"crash-transit-cover-east":[-182,-275],
      "east-power-cover-west":[157,-25],"east-power-cover-east":[193,-25],
      "west-neighborhood-cover-south":[-307,-76],"west-neighborhood-cover-north":[-328,-58],
      "south-freight-cover-west":[160,-270],"south-freight-cover-east":[220,-290],
      "north-skywalk-cover-west":[-187,423],"north-skywalk-cover-east":[-120,435]
    };
    for(const [id,[x,z]] of Object.entries(expected)){
      const block=BR_MAP_BLOCKS.find(candidate=>candidate.id===id);
      expect(block?.kind,id).toBe("cover");
      expect(block?.position,id).toEqual({x,y:1,z});
      expect(block?.size,id).toEqual(id.startsWith("west-neighborhood")||id.startsWith("north-skywalk")?{x:6,y:2,z:2}:{x:7,y:2,z:3});
    }
  });

  it("buffers and coyote-accepts exactly one jump inside bounded windows",()=>{
    const base:BrMotionState={position:{x:70,y:.4,z:70},velocity:{x:0,y:-1,z:0},yaw:0,grounded:false,crouched:false,deployment:"grounded",downed:false,lastJumpSignal:false,lastCrouchSignal:false,slideEndsAt:0,traversalCooldownUntil:0,lastGroundedAt:1000,jumpBufferedUntil:0};
    const coyote=stepBrMovement(base,{moveX:0,moveY:0,yaw:0,jump:true,sprint:false,crouch:false},.02,1100);expect(coyote.velocity.y).toBeGreaterThan(0);expect(coyote.jumpBufferedUntil).toBe(0);
    const held=stepBrMovement(coyote,{moveX:0,moveY:0,yaw:0,jump:true,sprint:false,crouch:false},.02,1120);expect(held.velocity.y).toBeLessThan(coyote.velocity.y);
    const expired=stepBrMovement({...base,lastGroundedAt:1000},{moveX:0,moveY:0,yaw:0,jump:true,sprint:false,crouch:false},.02,1000+BR_BALANCE.coyoteMs+1);expect(expired.velocity.y).toBeLessThan(0);
    const buffered=stepBrMovement({...base,position:{x:70,y:.04,z:70},velocity:{x:0,y:-2,z:0},lastGroundedAt:Number.NEGATIVE_INFINITY},{moveX:0,moveY:0,yaw:0,jump:true,sprint:false,crouch:false},.001,2000);
    const landed=stepBrMovement(buffered,{moveX:0,moveY:0,yaw:0,jump:false,sprint:false,crouch:false},.04,2040);expect(landed.velocity.y).toBe(BR_BALANCE.jumpSpeed);expect(landed.grounded).toBe(false);expect(landed.jumpBufferedUntil).toBe(0);
  });

  it("gives an auto-deployed chute useful cross-island travel with finite steering",()=>{
    let motion:BrMotionState={position:{x:0,y:BR_BALANCE.autoDeployHeight,z:0},velocity:{x:0,y:-BR_BALANCE.chuteSpeed,z:0},yaw:0,grounded:false,crouched:false,deployment:"chute",downed:false,lastJumpSignal:false,lastCrouchSignal:false,slideEndsAt:0,traversalCooldownUntil:0,lastGroundedAt:Number.NEGATIVE_INFINITY,jumpBufferedUntil:0};
    for(let step=0;step<50;step++)motion=stepBrMovement(motion,{moveX:0,moveY:1,yaw:0,jump:false,sprint:false,crouch:false},.1,step*100);
    expect(-motion.position.z).toBeGreaterThan(65);
    expect(Math.hypot(motion.velocity.x,motion.velocity.z)).toBeLessThanOrEqual(BR_BALANCE.chuteHorizontalSpeed+.001);
    expect(Object.values(motion.position).every(Number.isFinite)).toBe(true);
  });

  it("keeps the full storm cadence compact without removing a readable first loot window",()=>{
    const totalMs=BR_STORM_PHASES.reduce((sum,phase)=>sum+phase.waitMs+phase.closeMs,0);
    expect(BR_STORM_PHASES[0].waitMs).toBeGreaterThanOrEqual(50_000);
    expect(totalMs).toBeLessThanOrEqual(365_000);
    expect(BR_STORM_PHASES.every((phase,index)=>index===0||phase.waitMs<=BR_STORM_PHASES[index-1].waitMs)).toBe(true);
  });

  it("lets automatic deployment traverse between neighbouring districts",()=>{
    let motion:BrMotionState={position:{x:-400,y:BR_BALANCE.shipHeight,z:0},velocity:{x:0,y:-5,z:0},yaw:Math.PI/2,grounded:false,crouched:false,deployment:"freefall",downed:false,lastJumpSignal:false,lastCrouchSignal:false,slideEndsAt:0,traversalCooldownUntil:0,lastGroundedAt:Number.NEGATIVE_INFINITY,jumpBufferedUntil:0};
    for(let tick=0;tick<30*30&&motion.deployment!=="grounded";tick++)motion=stepBrMovement(motion,{moveX:0,moveY:1,yaw:Math.PI/2,jump:false,sprint:false,crouch:false},1/30,tick*1000/30);
    expect(motion.deployment).toBe("grounded");
    expect(motion.position.x).toBeGreaterThan(-50);
    expect(motion.position.x).toBeLessThan(220);
  });

  it("lands an automatic deployment promptly without giving up glide range",()=>{
    let motion:BrMotionState={position:{x:0,y:BR_BALANCE.shipHeight,z:0},velocity:{x:0,y:-5,z:0},yaw:0,grounded:false,crouched:false,deployment:"freefall",downed:false,lastJumpSignal:false,lastCrouchSignal:false,slideEndsAt:0,traversalCooldownUntil:0,lastGroundedAt:Number.NEGATIVE_INFINITY,jumpBufferedUntil:0};
    let elapsedMs=0;
    while(motion.deployment!=="grounded"&&elapsedMs<25_000){
      motion=stepBrMovement(motion,{moveX:0,moveY:1,yaw:0,jump:false,sprint:false,crouch:false},1/60,elapsedMs);
      elapsedMs+=1000/60;
    }
    expect(motion.deployment).toBe("grounded");
    expect(elapsedMs).toBeLessThan(16_000);
    expect(-motion.position.z).toBeGreaterThan(340);
  });

  it("makes early Ion Wing deployment meaningfully extend landing range",()=>{
    const simulate=(early:boolean)=>{
      let motion:BrMotionState={position:{x:0,y:BR_BALANCE.shipHeight,z:0},velocity:{x:0,y:-5,z:0},yaw:Math.PI/2,grounded:false,crouched:false,deployment:early?"chute":"freefall",downed:false,lastJumpSignal:false,lastCrouchSignal:false,slideEndsAt:0,traversalCooldownUntil:0,lastGroundedAt:Number.NEGATIVE_INFINITY,jumpBufferedUntil:0};
      for(let tick=0;tick<60*45&&motion.position.y>0;tick++){
        motion=stepBrMovement(motion,{moveX:0,moveY:1,yaw:Math.PI/2,jump:false,sprint:false,crouch:false},1/60,tick*1000/60);
      }
      return motion.position.x;
    };
    const early=simulate(true),late=simulate(false);
    expect(early).toBeGreaterThan(620);
    expect(early-late).toBeGreaterThan(180);
  });

  it("brakes and reverses ground motion without overshooting",()=>{
    const moving:BrMotionState={position:{x:80,y:0,z:80},velocity:{x:0,y:0,z:-BR_BALANCE.walkSpeed},yaw:0,grounded:true,crouched:false,deployment:"grounded",downed:false,lastJumpSignal:false,lastCrouchSignal:false,slideEndsAt:0,traversalCooldownUntil:0,lastGroundedAt:0,jumpBufferedUntil:0};
    const stopped=stepBrMovement(moving,{moveX:0,moveY:0,yaw:0,jump:false,sprint:false,crouch:false},.1,100);
    expect(stopped.velocity.z).toBeLessThanOrEqual(0);expect(Math.abs(stopped.velocity.z)).toBeLessThan(BR_BALANCE.walkSpeed-4.5);
    const reversed=stepBrMovement(moving,{moveX:0,moveY:-1,yaw:0,jump:false,sprint:false,crouch:false},.1,100);
    expect(reversed.velocity.z).toBeLessThanOrEqual(0);expect(Math.abs(reversed.velocity.z)).toBeLessThan(BR_BALANCE.walkSpeed);
  });

  it("uses the flat-deck fast path only away from authored collision",()=>{
    const open=brFlatDeckCollision({x:72,y:.04,z:72},{x:.4,y:-.1,z:0},false);
    expect(open?.grounded).toBe(true);expect(open?.movement.x).toBe(.4);expect(open?.movement.y).toBeCloseTo(-.005);
    const building=BR_STRUCTURES.find(structure=>!structure.enterable)!;
    expect(brFlatDeckCollision({...building.position,y:.04},{x:.1,y:-.1,z:0},false)).toBeNull();
  });

  it("inherits finite forward Starliner momentum on drop",()=>{
    const ship={start:{x:-620,y:195,z:0},end:{x:620,y:195,z:0},startedAt:1000,endsAt:43_000};
    const velocity=brDropVelocity(ship,Math.PI/2);
    expect(velocity.x).toBeGreaterThan(20);expect(velocity.y).toBe(-5);expect(Math.abs(velocity.z)).toBeLessThan(.001);
    expect(Object.values(velocity).every(Number.isFinite)).toBe(true);
  });

  it("forces final ejection toward playable island space",()=>{
    const ship={start:{x:-620,y:195,z:70},end:{x:620,y:195,z:70},startedAt:1000,endsAt:37_000};
    for(const position of [{x:430,z:70},{x:-420,z:-60},{x:0,z:0}]){
      const velocity=brForcedDropVelocity(ship,position);
      const radius=Math.hypot(position.x,position.z);
      if(radius>.001)expect((velocity.x*-position.x+velocity.z*-position.z)/radius).toBeGreaterThanOrEqual(8-.001);
      expect(velocity.y).toBe(-5);
      expect(Object.values(velocity).every(Number.isFinite)).toBe(true);
    }
  });

  it("uses one deterministic movement step for sprint, jump, slide, and descent", () => {
    const base: BrMotionState = { position: { x: 100, y: 0, z: 100 }, velocity: { x: 0, y: 0, z: 0 }, yaw: 0, grounded: true, crouched: false, deployment: "grounded", downed: false, lastJumpSignal: false, lastCrouchSignal: false, slideEndsAt: 0, traversalCooldownUntil: 0 };
    const sprint = stepBrMovement(base, { moveX: 0, moveY: 1, yaw: 0, jump: false, sprint: true, crouch: false }, .1, 1000);
    expect(sprint.velocity.z).toBeLessThan(0); expect(Math.hypot(sprint.velocity.x, sprint.velocity.z)).toBeLessThanOrEqual(BR_BALANCE.sprintSpeed);
    const jump = stepBrMovement({ ...sprint, lastJumpSignal: false }, { moveX: 0, moveY: 1, yaw: 0, jump: true, sprint: false, crouch: false }, .05, 1050);
    expect(jump.grounded).toBe(false); expect(jump.velocity.y).toBeGreaterThan(0);
    const falling: BrMotionState = { ...base, position: { x: 80, y: 20, z: 80 }, velocity: { x: 0, y: -10, z: 0 }, grounded: false, deployment: "freefall" };
    const chute = stepBrMovement(falling, { moveX: 0, moveY: 0, yaw: 0, jump: false, sprint: false, crouch: false }, .1, 2000);
    expect(chute.deployment).toBe("chute"); expect(chute.velocity.y).toBeGreaterThanOrEqual(-BR_BALANCE.chuteSpeed);
  });

  it("bounds planar acceleration and braking without diagonal gain or reversal",()=>{
    const accelerated=brApproachPlanarVelocity({x:0,y:3,z:0},{x:10,y:3,z:10},3.4);
    expect(Math.hypot(accelerated.x,accelerated.z)).toBeCloseTo(3.4,6);expect(accelerated.y).toBe(3);
    const braked=brApproachPlanarVelocity({x:1,y:0,z:0},{x:0,y:0,z:0},3.4);
    expect(braked.x).toBe(0);expect(braked.z).toBe(0);
    const reversed=brApproachPlanarVelocity({x:2,y:0,z:0},{x:-7,y:0,z:0},1.2);
    expect(reversed.x).toBeCloseTo(.8,6);expect(reversed.x).toBeGreaterThanOrEqual(0);
  });

  it("requires directional, reachable mantle geometry and standing head clearance", () => {
    const cover = BR_MAP_BLOCKS.find((block) => block.kind === "cover")!;
    const feet = { x: cover.position.x, y: 0, z: cover.position.z + cover.size.z / 2 + BR_BALANCE.playerRadius + .04 };
    expect(brMantleTopAt(feet, { x: 0, y: .12, z: -.2 })).toBeCloseTo(cover.position.y + cover.size.y / 2);
    expect(brMantleTopAt(feet, { x: 0, y: .12, z: .2 })).toBeNull();
    expect(brMantleTopAt(feet, { x: 0, y: .12, z: 0 })).toBeNull();
    const ceiling = BR_MAP_BLOCKS.find((block) => block.id.includes("-deck-1-left"))!;
    const ceilingBottom = ceiling.position.y - ceiling.size.y / 2;
    const crouchedHeight = BR_BALANCE.playerRadius * 2 + .12;
    expect(brHasStandingClearance({ x: ceiling.position.x, y: ceilingBottom - crouchedHeight, z: ceiling.position.z })).toBe(false);
    expect(brHasStandingClearance({ x: ceiling.position.x, y: ceilingBottom - BR_BALANCE.playerHeight - .2, z: ceiling.position.z })).toBe(true);
  });

  it("shares finite camera aim, muzzle, body, and head hit math", () => {
    const muzzle=brMuzzlePosition({ x: 2, y: 3, z: 4 }, 0, 0);expect(muzzle.x).toBeCloseTo(2);expect(muzzle.y).toBeCloseTo(3.72);expect(muzzle.z).toBeCloseTo(3.12);
    const origin = { x: 0, y: 1.13, z: 5 }; const direction = { x: 0, y: 0, z: -1 }; const feet = { x: 0, y: 0, z: 0 };
    expect(brPlayerHitDistance(origin, direction, feet)?.headshot).toBe(true);
    expect(brPlayerHitDistance({ x: 0, y: .5, z: 5 }, direction, feet)?.headshot).toBe(false);
    expect(brPlayerHitDistance({ x: 3, y: .5, z: 5 }, direction, feet)).toBeNull();
  });
});
