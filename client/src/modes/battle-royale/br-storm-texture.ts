import * as THREE from "three";

/** Periodic in both axes so rotating, scrolling layers have no painted seam. */
export function brStormField(u:number,v:number):readonly [number,number] {
  const x=u*Math.PI*2,y=v*Math.PI*2;
  const warp=Math.sin(x*2+y)*.7+Math.sin(x-y*3)*.32;
  const cloud=.5+.5*Math.sin(x+y*2+warp)*Math.cos(y-x+warp*.6);
  const crossing=Math.pow(.5+.5*Math.sin(y*4-x*2+warp*2.8),12);
  // Upright veins bend and split with height instead of becoming rigid light
  // columns. Crossing waves interrupt them to retain the cloud-like motion.
  const upright=Math.pow(.5+.5*Math.sin(x*3+Math.sin(y)*.85+Math.sin(y*2+x)*.35),12);
  const filament=Math.max(crossing*.7,upright)*cloud;
  return [cloud,filament];
}

export function createBrStormTexture():THREE.DataTexture {
  const size=128,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const [cloud,filament]=brStormField((x+.5)/size,(y+.5)/size);
    const cyan=Math.min(1,filament*1.7),offset=(y*size+x)*4;
    pixels[offset]=Math.round(155-71*cyan);
    pixels[offset+1]=Math.round(72+138*cyan);
    pixels[offset+2]=Math.round(244-6*cyan);
    pixels[offset+3]=Math.round(255*(.07+.3*cloud+.26*filament));
  }
  const texture=new THREE.DataTexture(pixels,size,size);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=texture.minFilter=THREE.LinearFilter;
  texture.repeat.set(1,6);
  texture.needsUpdate=true;
  return texture;
}
