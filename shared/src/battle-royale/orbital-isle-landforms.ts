import type { Vec3 } from "../index.js";
import type { BrGreenwayTree } from "./orbital-isle-greenways.js";

export interface BrLandform {
  id:string;center:{x:number;z:number};width:number;depth:number;height:number;
  columns:number;rows:number;vertices:Float32Array;indices:Uint32Array;
}

function landform(id:string,x:number,z:number,width:number,depth:number,height:number):BrLandform {
  const columns=12,rows=16,vertices:number[]=[],indices:number[]=[];
  for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
    const nx=column/columns*2-1,nz=row/rows*2-1;
    // Fixed asymmetric raised soil, with a smooth zero-height perimeter.
    // No random terrain: the same triangles are used by all peers/renderers.
    const radius=Math.hypot(nx+nz*.12*(1-nx*nx),nz);
    const y=radius<1?height*(1+Math.cos(Math.PI*radius))/2:0;
    vertices.push(x+nx*width/2,y,z+nz*depth/2);
  }
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const a=row*(columns+1)+column,b=a+1,c=a+columns+1,d=c+1;
    // The island already supplies the zero-height floor. Omit fully flat
    // triangles so the grove has a soil-shaped edge instead of a rectangular
    // coplanar patch that can flicker against the existing deck.
    if(vertices[a*3+1]>0||vertices[c*3+1]>0||vertices[b*3+1]>0)indices.push(a,c,b);
    if(vertices[b*3+1]>0||vertices[c*3+1]>0||vertices[d*3+1]>0)indices.push(b,c,d);
  }
  return {id,center:{x,z},width,depth,height,columns,rows,vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
}

/** Confirmed open connective gaps, clear of roads, raised decks and buildings. */
export const BR_LANDFORMS:readonly BrLandform[]=[
  landform("east-rim-grove",454,-110,28,56,4.5),
  landform("south-engine-garden",259,-368,48,48,6.5),
  landform("western-overlook-grove",-460,70,26,44,4),
];

export function brLandformsNear(point:{x:number;z:number},radius=0):readonly BrLandform[]{
  return BR_LANDFORMS.filter(h=>Math.abs(point.x-h.center.x)<=h.width/2+radius&&Math.abs(point.z-h.center.z)<=h.depth/2+radius);
}

/** Exact barycentric height of the rendered/collidable triangle, not an
 * analytic curve that could diverge between the mesh and floor query. */
export function brLandformHeightAt(h:BrLandform,point:{x:number;z:number}):number|null {
  const x=(point.x-h.center.x)/h.width+.5,z=(point.z-h.center.z)/h.depth+.5;
  if(x<0||x>1||z<0||z>1)return null;
  const gx=x*h.columns,gz=z*h.rows,column=Math.min(h.columns-1,Math.floor(gx)),row=Math.min(h.rows-1,Math.floor(gz)),fx=gx-column,fz=gz-row;
  const a=row*(h.columns+1)+column,b=a+1,c=a+h.columns+1,d=c+1;
  const y=(index:number)=>h.vertices[index*3+1];
  return fx+fz<=1?y(a)+(y(b)-y(a))*fx+(y(c)-y(a))*fz:y(d)+(y(c)-y(d))*(1-fx)+(y(b)-y(d))*(1-fz);
}

export function brLandformSurfaceAt(point:{x:number;z:number}):number|null {
  let height:number|null=null;
  for(const h of brLandformsNear(point)){const y=brLandformHeightAt(h,point);if(y!==null)height=Math.max(height??-Infinity,y);}
  return height;
}

export const BR_LANDFORM_TREES:readonly BrGreenwayTree[]=BR_LANDFORMS.flatMap((h,band)=>{
  const offsets=h.id==="south-engine-garden"?[[-12,-14],[12,-12],[-13,3],[12,8],[-9,16],[9,19]]:[[-6,-12],[6,-5],[-5,8],[5,17]];
  return offsets.map(([x,z],index)=>{
    const point={x:h.center.x+x,z:h.center.z+z};
    return {id:`landform-${h.id}-${index}`,band:h.id,position:{...point,y:brLandformHeightAt(h,point)!},height:8+index%3,radius:3.2+(index%2)*.4,color:h.id==="western-overlook-grove"?"violet":band===0?"cyan":"mint"} as BrGreenwayTree;
  });
});
