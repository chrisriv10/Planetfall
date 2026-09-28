import { describe, expect, it } from "vitest";
import { BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_STRUCTURES, BR_WEAPONS, isBrWeapon, type BrMapBlock, type Vec3 } from "@planetfall/shared";
import { generateBrLoot } from "./br-loot-generation";

function distanceToBlock(point:Vec3,block:BrMapBlock):number{
  const dx=point.x-block.position.x,dy=point.y-block.position.y,dz=point.z-block.position.z;
  const rotation=block.rotation??{x:0,y:0,z:0};
  const a=Math.cos(rotation.x),b=Math.sin(rotation.x),c=Math.cos(rotation.y),d=Math.sin(rotation.y),e=Math.cos(rotation.z),f=Math.sin(rotation.z);
  const r00=c*e,r01=-c*f,r02=d;
  const r10=a*f+b*d*e,r11=a*e-b*d*f,r12=-b*c;
  const r20=b*f-a*d*e,r21=b*e+a*d*f,r22=a*c;
  const local={x:r00*dx+r10*dy+r20*dz,y:r01*dx+r11*dy+r21*dz,z:r02*dx+r12*dy+r22*dz};
  const outside={x:Math.max(Math.abs(local.x)-block.size.x/2,0),y:Math.max(Math.abs(local.y)-block.size.y/2,0),z:Math.max(Math.abs(local.z)-block.size.z/2,0)};
  return Math.hypot(outside.x,outside.y,outside.z);
}

describe("BR authored loot distribution", () => {
  it("gives every enterable structure a weapon with compatible ammunition", () => {
    let id = 0;
    const loot = generateBrLoot(BR_LOOT_SOCKETS, 20260924, (kind) => `${kind}-${id++}`);
    for (const structure of BR_STRUCTURES.filter((entry) => entry.enterable)) {
      const socketIds = new Set(BR_LOOT_SOCKETS.filter((entry) => entry.structureId === structure.id).map((entry) => entry.id));
      const sockets = BR_LOOT_SOCKETS.filter((entry) => socketIds.has(entry.id));
      const near = loot.filter((entry) => sockets.some((socket) => Math.hypot(entry.position.x-socket.position.x,entry.position.z-socket.position.z)<2));
      const weapon = near.find((entry) => entry.itemId && isBrWeapon(entry.itemId));
      expect(weapon, structure.id).toBeTruthy();
      const ammoType = weapon?.itemId && isBrWeapon(weapon.itemId) ? BR_WEAPONS[weapon.itemId].ammo : null;
      if (ammoType) expect(near.some((entry) => entry.ammoType === ammoType), structure.id).toBe(true);
    }
  });

  it("is deterministic, varied and denser than one item per structure", () => {
    const make = (seed:number) => generateBrLoot(BR_LOOT_SOCKETS, seed, (kind) => `${kind}`)
      .map((entry) => `${entry.itemId ?? entry.ammoType}:${entry.rarity}`);
    expect(make(7)).toEqual(make(7));
    expect(make(7)).not.toEqual(make(8));
    expect(make(7).length).toBeGreaterThan(BR_STRUCTURES.filter((entry)=>entry.enterable).length * 2.5);
  });

  it("rewards vertical exploration in every multi-storey enterable structure",()=>{
    for(const structure of BR_STRUCTURES.filter(entry=>entry.enterable&&entry.floors>=2)){
      const upper=BR_LOOT_SOCKETS.find(socket=>socket.structureId===structure.id&&socket.id.endsWith("-upper-loot"));
      expect(upper,structure.id).toBeTruthy();
      expect(upper!.position.y).toBeCloseTo(structure.position.y+structure.size.y/structure.floors+.58,5);
    }
  });

  it("keeps every authored pickup clear of blocking collision",()=>{
    const blockers=BR_MAP_BLOCKS.filter(block=>block.kind==="wall"||block.kind==="cover"||block.kind==="ramp");
    for(const socket of BR_LOOT_SOCKETS)for(const block of blockers){
      // The pickup model occupies less than a player's radius, but still needs
      // enough clearance to hover without phasing through a wall or prop.
      expect(distanceToBlock(socket.position,block),`${socket.id} intersects ${block.id}`).toBeGreaterThanOrEqual(.38);
    }
  });
});
