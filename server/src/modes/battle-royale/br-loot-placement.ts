import type { Vec3 } from "@planetfall/shared";

type RayDistance = (origin: Vec3, direction: Vec3, maximum: number) => number;
export type BrLootPlacement = { position: Vec3; surfaceY: number };

/** Resolve static loot against the authoritative collision world. Origins are
 * pickup-height points, not slab centres or the player's old floor height. */
export function placeBrLoot(origin: Vec3, requested: Vec3, rayDistance: RayDistance): BrLootPlacement {
  const dx=requested.x-origin.x,dz=requested.z-origin.z,length=Math.hypot(dx,dz);
  const direction={x:dx/(length||1),y:0,z:dz/(length||1)};
  // Leave room for the rotating pickup, and never drop it through a wall.
  const hit=length>0?rayDistance(origin,direction,length+.4):length+.4;
  const travel=Math.min(length,Math.max(0,hit-.4));
  let position={...origin},surfaceY=Number.NEGATIVE_INFINITY;
  // Include the footprint so an inclined surface cannot cut through the
  // downhill side of a rotating model or its rarity ring.
  // The rarity field reaches .72 * 1.28m at its largest display scale.
  for(let remaining=travel;;remaining=Math.max(0,remaining-.2)){
    position={x:origin.x+direction.x*remaining,y:origin.y,z:origin.z+direction.z*remaining};
    surfaceY=Number.NEGATIVE_INFINITY;let centreY=Number.NEGATIVE_INFINITY;
    for(const [x,z] of [[0,0],[.95,0],[-.95,0],[0,.95],[0,-.95],[.67,.67],[-.67,.67],[.67,-.67],[-.67,-.67]]){
      const start={x:position.x+x,y:origin.y+.35,z:position.z+z};
      const distance=rayDistance(start,{x:0,y:-1,z:0},512);
      if(distance>1e-6&&distance<512){const top=start.y-distance;surfaceY=Math.max(surfaceY,top);if(x===0&&z===0)centreY=top;}
    }
    // Offset ammunition or a forward drop can cross an upper-floor opening.
    // Keep it on the supported side instead of hovering over a deep stairwell.
    if(surfaceY-centreY<=.5||remaining===0)break;
  }
  // Keep an off-island elimination finite if no world support exists below it.
  if(!Number.isFinite(surfaceY))surfaceY=origin.y-.58;
  position.y=surfaceY+.58;
  return {position,surfaceY};
}
