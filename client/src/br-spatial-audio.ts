export interface AudioPosition { x: number; y: number; z: number; }
/** Closest point on a finite confirmed shot, never on its infinite extension. */
export function brShotFlybyPoint(origin:AudioPosition,direction:AudioPosition,length:number,listener:AudioPosition):AudioPosition|null {
  if(![origin.x,origin.y,origin.z,direction.x,direction.y,direction.z,length,listener.x,listener.y,listener.z].every(Number.isFinite)||length<=0)return null;
  const norm=Math.hypot(direction.x,direction.y,direction.z);if(norm<.001)return null;
  const x=direction.x/norm,y=direction.y/norm,z=direction.z/norm;
  const distance=(listener.x-origin.x)*x+(listener.y-origin.y)*y+(listener.z-origin.z)*z;
  // Do not turn the muzzle, or shots that stop before reaching us, into flybys.
  if(distance<3||distance>length)return null;
  const point={x:origin.x+x*distance,y:origin.y+y*distance,z:origin.z+z*distance};
  return Math.hypot(point.x-listener.x,point.y-listener.y,point.z-listener.z)<=6?point:null;
}
/** Bounded distance mix in the same yaw convention as the BR camera. */
export function brSpatialMix(source: AudioPosition, listener: AudioPosition, yaw: number, range = 180): { gain: number; pan: number; cutoff: number } {
  if (![source.x, source.y, source.z, listener.x, listener.y, listener.z, yaw, range].every(Number.isFinite) || range <= 0) return { gain: 0, pan: 0, cutoff: 700 };
  const dx = source.x - listener.x, dy = source.y - listener.y, dz = source.z - listener.z;
  const distance = Math.hypot(dx, dy, dz), planar = Math.hypot(dx, dz);
  const proximity = Math.max(0, 1 - distance / range);
  return {
    gain: proximity * proximity,
    pan: planar > .001 ? Math.max(-.9, Math.min(.9, (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / planar)) : 0,
    cutoff: 700 + 5300 * proximity * proximity
  };
}
