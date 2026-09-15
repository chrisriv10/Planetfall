import * as THREE from "three";

/** Closed eight-sided transport hull, in the ship's existing local envelope.
 * This is visual shell geometry only; route, riders and drop physics are untouched. */
export function createStarlinerHull():THREE.BufferGeometry {
  const sections=[[-34,.9,1.4],[-27,5.2,4.4],[-15,9.5,8],[13,9.5,8],[23,6.8,6],[28,5.2,4]];
  const outline=[[-.65,1],[.65,1],[1,.45],[1,-.45],[.65,-1],[-.65,-1],[-1,-.45],[-1,.45]];
  const geometry=new THREE.BufferGeometry(),positions:number[]=[],panels:number[][]=[[],[],[]];
  const point=(section:number,corner:number)=>{const [z,w,h]=sections[section];const [x,y]=outline[corner%8];return [x*w,y*h,z];};
  const triangle=(material:number,a:number[],b:number[],c:number[])=>panels[material].push(...a,...b,...c);
  for(let section=0;section<sections.length-1;section++)for(let corner=0;corner<8;corner++) {
    const material=corner>=3&&corner<=5?1:corner===2||corner===6?2:0;
    const a=point(section,corner),b=point(section,corner+1),c=point(section+1,corner),d=point(section+1,corner+1);
    triangle(material,a,c,b);triangle(material,b,c,d);
  }
  for(const section of [0,sections.length-1])for(let corner=0;corner<8;corner++) {
    const center=[0,0,sections[section][0]];
    if(section===0)triangle(0,center,point(section,corner),point(section,corner+1));
    else triangle(1,center,point(section,corner+1),point(section,corner));
  }
  // One draw group per material, not one per panel. The shell stays 96 triangles.
  for(let material=0;material<panels.length;material++){
    geometry.addGroup(positions.length/3,panels[material].length/3,material);
    positions.push(...panels[material]);
  }
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();
  return geometry;
}

export function createStarlinerWing():THREE.ExtrudeGeometry {
  const shape=new THREE.Shape();shape.moveTo(4,-11);shape.lineTo(13,-6);shape.lineTo(24,13);shape.lineTo(22,18);shape.lineTo(10,10);shape.lineTo(4,7);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:1.1,bevelEnabled:false,steps:1});
  geometry.translate(0,0,-.55);geometry.rotateX(Math.PI/2);return geometry;
}
