import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHomePreviewFramer } from './home-preview-framing';

describe('home preview projection framing', () => {
  it.each([[1366,768],[1600,900],[1920,1080],[3440,1440],[864,540],[390,844]])('fits offset bounds with live camera pose and FOV at %sx%s', (width,height) => {
    const framer=createHomePreviewFramer();
    const bounds=new THREE.Box3(new THREE.Vector3(-46,-4.9,-38),new THREE.Vector3(46,9.6,38));
    const region={viewportWidth:width,viewportHeight:height,left:width*.48,top:height*.12,width:width*.49,height:height*.74};
    for(const fov of [38,58,85])for(const yaw of [-.3,.7]){
      const camera=new THREE.PerspectiveCamera(fov,width/height,.1,500);
      camera.position.set(20,10,32);camera.lookAt(10,1,-4);camera.updateMatrixWorld(true);
      const root=new THREE.Group();root.rotation.set(.12,yaw,.05);const rotation=root.quaternion.clone();
      framer.fit(root,bounds,camera,region);root.updateMatrixWorld(true);
      expect(root.quaternion.equals(rotation)).toBe(true);
      const point=new THREE.Vector3(),center=bounds.getCenter(new THREE.Vector3()).applyMatrix4(root.matrixWorld).project(camera);
      expect((center.x+1)*width/2).toBeCloseTo(region.left+region.width/2,7);
      expect((1-center.y)*height/2).toBeCloseTo(region.top+region.height/2,7);
      const margin=Math.min(16,region.width*.1,region.height*.1);
      for(let i=0;i<8;i++){
        point.set(i&1?bounds.max.x:bounds.min.x,i&2?bounds.max.y:bounds.min.y,i&4?bounds.max.z:bounds.min.z).applyMatrix4(root.matrixWorld).project(camera);
        const x=(point.x+1)*width/2,y=(1-point.y)*height/2;
        expect(x).toBeGreaterThanOrEqual(region.left+margin);expect(x).toBeLessThanOrEqual(region.left+region.width-margin);
        expect(y).toBeGreaterThanOrEqual(region.top+margin);expect(y).toBeLessThanOrEqual(region.top+region.height-margin);
        expect(point.z).toBeGreaterThan(-1);expect(point.z).toBeLessThan(1);
      }
    }
  });

  it('ignores invalid inputs and keeps near-plane clearance for deep bounds',()=>{
    const framer=createHomePreviewFramer(),root=new THREE.Group(),camera=new THREE.PerspectiveCamera(60,1,2,1000);
    const region={viewportWidth:800,viewportHeight:800,left:0,top:0,width:800,height:800};
    const bounds=new THREE.Box3(new THREE.Vector3(-1,-1,-500),new THREE.Vector3(1,1,500));
    framer.fit(root,bounds,camera,region,.1);root.updateMatrixWorld(true);
    const front=new THREE.Vector3(0,0,500).applyMatrix4(root.matrixWorld);
    expect(-front.z).toBeGreaterThan(camera.near);
    const state=root.matrixWorld.clone();
    framer.fit(root,bounds,camera,{...region,width:NaN});root.updateMatrixWorld(true);expect(root.matrixWorld.equals(state)).toBe(true);
    framer.fit(root,new THREE.Box3(),camera,region);root.updateMatrixWorld(true);expect(root.matrixWorld.equals(state)).toBe(true);
  });
});
