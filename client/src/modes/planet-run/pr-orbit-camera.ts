interface Point {x:number;y:number;z:number}
/** Interpolate only radius. Cartesian interpolation of opposite orbit points
 * takes a shortcut through the pilot during a fast half-turn. */
export function prOrbitRadius(previous:number,wanted:number,clearance:number,dt:number,snap=false):number {
 const limit=Math.max(1,Math.min(wanted,clearance));
 if(snap||!Number.isFinite(previous)||previous>limit)return limit;
 return previous+(limit-previous)*(1-Math.exp(-10*Math.max(0,Math.min(.05,dt))));
}
export function setPrOrbitPosition(out:Point,target:Readonly<Point>,yaw:number,pitch:number,radius:number):void {
 out.x=target.x+Math.sin(yaw)*Math.cos(pitch)*radius;
 out.y=target.y+Math.sin(pitch)*radius;
 out.z=target.z+Math.cos(yaw)*Math.cos(pitch)*radius;
}
