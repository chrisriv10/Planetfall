import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {PG_HOME_COMPOSITION,pgHomeAmbientTime} from './pg-home-composition';
import {PgHomePreview} from './pg-home-preview';
afterEach(()=>vi.unstubAllGlobals());
const camera=new THREE.PerspectiveCamera(58,16/9,.1,500);
camera.position.set(20,10,32);camera.lookAt(10,1,-4);camera.updateMatrixWorld(true);
const region={viewportWidth:1920,viewportHeight:1080,left:760,top:120,width:1100,height:800};
function sceneState(root:THREE.Object3D){
  root.updateMatrixWorld(true);const nodes:unknown[]=[];
  root.traverse(o=>nodes.push({visible:o.visible,matrix:[...o.matrixWorld.elements],
    instances:o instanceof THREE.InstancedMesh?Array.from(o.instanceMatrix.array):null,
    materials:o instanceof THREE.Mesh||o instanceof THREE.Points?(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.toJSON()):null}));
  return nodes;
}
describe('fixed arena home composition',()=>{
  it('excludes identified distant orbital context while retaining canonical arena architecture',()=>{
    const view=new PgHomePreview();
    try{
      for(const time of [0,20]){
        view.update(time,camera,region);
        for(const name of ['orbital-neighborhood']){
          const layer=view.root.getObjectByName(name);
          expect(layer).toBeDefined();expect(layer!.visible).toBe(false);
        }
        const visible:THREE.Object3D[]=[];view.root.traverseVisible(node=>visible.push(node));
        expect(visible).toContain(view.root.getObjectByName('nova-block'));
        expect(visible).not.toContain(view.root.getObjectByName('orbital-structural-silhouettes'));
        expect(visible).toContain(view.root.getObjectByName('nova-neighborhood-art'));
        expect(visible.some(node=>node.name.startsWith('foundation:'))).toBe(true);
        expect(visible.some(node=>node instanceof THREE.InstancedMesh&&node.name.startsWith('body-'))).toBe(true);
      }
    }finally{view.dispose();}
  });
  it('keeps the actual home scene static under reduced motion and architecture upright across time',()=>{
    const preference={matches:true};vi.stubGlobal('matchMedia',()=>preference);
    const view=new PgHomePreview();
    try{
      view.update(0,camera,region);const frozen=sceneState(view.root);
      for(const time of [1,7.2,28.6,100]){view.update(time,camera,region);expect(sceneState(view.root)).toEqual(frozen);}
      preference.matches=false;
      for(const time of [2,20,200]){
        view.update(time,camera,region);const architecture=view.root.getObjectByName('nova-block')!;
        expect(architecture.rotation.x).toBe(0);expect(architecture.rotation.z).toBe(0);
        expect(architecture.rotation.y).toBe(PG_HOME_COMPOSITION.yaw);
      }
      preference.matches=true;view.update(201,camera,region);expect(sceneState(view.root)).toEqual(frozen);
    }finally{view.dispose();}
  });
  it('retains world-up architecture and finite bounded ambient time',()=>{
    expect(PG_HOME_COMPOSITION.pitch).toBe(0);
    for(const time of [-10,0,5,100,Infinity,NaN])expect(Number.isFinite(pgHomeAmbientTime(time,false))).toBe(true);
    expect(pgHomeAmbientTime(2,false)).toBe(2000);
  });
  it('freezes ambient motion without changing composition for reduced motion',()=>{
    for(const time of [0,10,100])expect(pgHomeAmbientTime(time,true)).toBe(0);
    expect(Object.isFrozen(PG_HOME_COMPOSITION)).toBe(true);
  });
});
