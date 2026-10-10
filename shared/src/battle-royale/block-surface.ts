import type {BrMapBlock} from './map.js';

/** Highest intersection of a vertical line with the actual oriented cuboid.
 * Empty corners of a rotated block's broadphase bounds are not support. */
export function brBlockTopSurfaceAt(block:BrMapBlock,position:{x:number;z:number}):number|null{
 const dx=position.x-block.position.x,dz=position.z-block.position.z;
 if(!block.rotation)return Math.abs(dx)<=block.size.x/2&&Math.abs(dz)<=block.size.z/2?block.position.y+block.size.y/2:null;
 const {x,y,z}=block.rotation,a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),d=Math.sin(y),e=Math.cos(z),f=Math.sin(z);
 // Columns of the shared XYZ Euler matrix. Dotting with each column maps the
 // world vertical line into local box coordinates without a runtime engine.
 const axes=[
  [c*e,a*f+b*e*d,b*f-a*e*d,block.size.x/2],
  [-c*f,a*e-b*f*d,b*e+a*f*d,block.size.y/2],
  [d,-b*c,a*c,block.size.z/2]
 ];
 let low=-Infinity,high=Infinity;
 for(const [rx,ry,rz,half]of axes){
  const offset=rx*dx+rz*dz;
  if(Math.abs(ry)<1e-10){if(Math.abs(offset)>half+1e-8)return null;continue;}
  const one=(-half-offset)/ry,two=(half-offset)/ry;
  low=Math.max(low,Math.min(one,two));high=Math.min(high,Math.max(one,two));
  if(low>high+1e-8)return null;
 }
 return Number.isFinite(high)?block.position.y+high:null;
}
