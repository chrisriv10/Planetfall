import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createAstronautVisual} from './astronaut';
import {isAstronautVisorCap} from './astronaut-visor-mask';
describe('astronaut eye treatment',()=>{
 it('masks the actual exposed lateral visor slits while retaining central and lower visor fragments',()=>{
  const rig=createAstronautVisual({identityColor:'#70f5ff',suitAccent:'#ffd84d',isBot:false});
  rig.group.updateMatrixWorld(true);
  const shell=rig.helmet.children[0],ray=new THREE.Raycaster();
  let exposed=0;
  for(let x=-.45;x<=.45;x+=.01)for(let y=-.05;y<=.18;y+=.01){
   ray.set(new THREE.Vector3(x,y+1.46,2),new THREE.Vector3(0,0,-1));
   const shellHit=ray.intersectObject(shell)[0],visorHit=ray.intersectObject(rig.visor)[0];
   if(visorHit&&shellHit&&visorHit.distance<shellHit.distance){
    exposed++;
    const local=rig.visor.worldToLocal(visorHit.point.clone());
    expect(isAstronautVisorCap(local.x,local.y)).toBe(true);
   }
  }
  expect(exposed).toBeGreaterThan(10);
  for(const x of [-.43,-.2,0,.2,.43])expect(isAstronautVisorCap(x,-.12)).toBe(false);
  for(const y of [-.1,0,.2,.43])expect(isAstronautVisorCap(.2,y)).toBe(false);
  const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}} as Parameters<typeof rig.visor.material.onBeforeCompile>[0];
  rig.visor.material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
  expect(shader.fragmentShader).toContain('abs(vAstronautVisorPosition.x) > 0.32 && vAstronautVisorPosition.y > -0.11');
  expect(rig.visor.material.customProgramCacheKey()).toContain('astronaut-visor-cap-mask-v1');
 });
 it('uses two centred static dark ovals in one draw without changing the helmet or visor',()=>{
  const rig=createAstronautVisual({identityColor:'#70f5ff',suitAccent:'#ffd84d',isBot:false});
  const eyes=rig.helmet.getObjectByName('astronaut-eyes') as THREE.InstancedMesh;
  expect(eyes.isInstancedMesh).toBe(true);expect(eyes.count).toBe(2);
  expect((eyes.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0x000000);
  expect(rig.visor.position.toArray()).toEqual([0,.02,.31]);expect(rig.visor.scale.toArray()).toEqual([.98,.74,.42]);
  const positions:THREE.Vector3[]=[];
  for(let i=0;i<2;i++){const matrix=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();eyes.getMatrixAt(i,matrix);matrix.decompose(p,q,s);positions.push(p);expect(p.y).toBeCloseTo(.025);expect(s.y).toBeGreaterThan(s.x);expect(s.z).toBeLessThan(.1);}
  expect(positions[0].x).toBeCloseTo(-positions[1].x);expect(positions[0].z).toBeCloseTo(positions[1].z);
  expect(rig.lodDetails).not.toContain(eyes);
 });
 it('keeps one white highlight inside each enlarged black oval on the same facet',()=>{
  const rig=createAstronautVisual({identityColor:'#70f5ff',suitAccent:'#ffd84d',isBot:false});
  const eyes=rig.helmet.getObjectByName('astronaut-eyes') as THREE.InstancedMesh;
  const highlights=rig.helmet.getObjectByName('astronaut-eye-highlights') as THREE.InstancedMesh;
  expect(highlights.count).toBe(2);expect(highlights.geometry).toBe(eyes.geometry);
  expect((highlights.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xffffff);
  for(let i=0;i<2;i++){
   const eye=new THREE.Matrix4(),dot=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
   eyes.getMatrixAt(i,eye);highlights.getMatrixAt(i,dot);eye.decompose(p,q,s);
   expect(s.x).toBeCloseTo(.42*1.35*1.2);expect(s.y).toBeCloseTo(.72*1.35*1.2);
   expect(Math.abs(p.x)).toBeCloseTo(.16);
   const local=eye.clone().invert().multiply(dot),vertices=highlights.geometry.getAttribute('position');
   for(let j=0;j<vertices.count;j++){
    const vertex=new THREE.Vector3().fromBufferAttribute(vertices,j).applyMatrix4(local);
    expect((vertex.x/.08)**2+(vertex.y/.08)**2).toBeLessThan(.7);
    expect(vertex.z).toBeGreaterThan(0);
   }
  }
  expect(rig.lodDetails).not.toContain(highlights);
 });
});
