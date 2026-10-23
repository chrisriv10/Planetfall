import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {PG_MAP,type PgWeaponId} from "@planetfall/shared";
import {createPgViewmodel,PG_VIEWMODEL_LAYER} from "./pg-viewmodel";
import {PgWorldRenderer} from "./pg-world";
import {BrWeaponModelLibrary} from "../battle-royale/br-weapon-model-library";

describe("PlanetGun local optic clearance",()=>{
  for(const weapon of["pulse","nova","photon","quasar","rail","comet"]as PgWeaponId[])it(`${weapon} leaves the settled ADS center ray clear`,()=>{
    const vm=createPgViewmodel();for(let i=0;i<180;i++)vm.update({weapon,ads:1,recoil:0,reload:0,speed:0,mode:"ground",time:i*1000/60});
    vm.root.updateMatrixWorld(true);const meshes:THREE.Object3D[]=[];vm.root.traverseVisible(o=>{if(o instanceof THREE.Mesh&&!o.userData.pgOpticGlass)meshes.push(o);});
    const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,0,-1),.01,4);ray.layers.set(PG_VIEWMODEL_LAYER);
    expect(ray.intersectObjects(meshes,false).map(h=>h.object.name)).toEqual([]);
    if(weapon==="rail"||weapon==="quasar")for(const [x,y]of[[.025,0],[-.025,0],[0,.025],[0,-.025],[.018,.018],[-.018,-.018]]){
      ray.ray.direction.set(x,y,-1).normalize();expect(ray.intersectObjects(meshes,false).map(h=>h.object.name)).toEqual([]);
    }
    vm.dispose();vm.dispose();
  });
  it("retains closed canonical remote optics and their lens caps",()=>{
    const vm=createPgViewmodel(),library=new BrWeaponModelLibrary();
    for(const [weapon,scope,lens]of[["rail-laser","rail-scope-body","rail-scope-lens"],["quasar-carbine","quasar-optic","quasar-lens"]]as const){
      const model=library.create(weapon,0x81ecdf),mesh=model.getObjectByName(scope)as THREE.Mesh<THREE.CylinderGeometry>;
      expect(mesh.geometry.parameters.openEnded).toBe(false);expect(model.getObjectByName(lens)?.visible).toBe(true);
    }
    vm.dispose();library.dispose();
  });
});

describe("PlanetGun layered surface clearance",()=>{
  it("separates panel overlays and machine caps from their underlying surfaces",()=>{
    const world=new PgWorldRenderer(),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),quaternion=new THREE.Quaternion();
    const panels:{position:THREE.Vector3;scale:THREE.Vector3}[]=[],overlays:{position:THREE.Vector3;scale:THREE.Vector3}[]=[],caps:THREE.Box3[]=[];
    world.root.traverse(o=>{if(!(o instanceof THREE.InstancedMesh))return;
      for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);matrix.decompose(position,quaternion,scale);
        if(o.name.startsWith("panel:"))panels.push({position:position.clone(),scale:scale.clone()});
        if(["run-panel-seam:","window-mullion:","window-transom:"].some(prefix=>o.name.startsWith(prefix)))overlays.push({position:position.clone(),scale:scale.clone()});
        if(o.name.startsWith("machine-cap:"))caps.push(new THREE.Box3().setFromCenterAndSize(position,scale));
      }
    });
    expect(overlays.length).toBeGreaterThan(0);
    for(const overlay of overlays){const axis=overlay.scale.x<overlay.scale.z?"x":"z",along=axis==="x"?"z":"x";
      const panel=panels.find(p=>Math.abs(p.position[along]-overlay.position[along])<.01&&Math.abs(p.position.y-overlay.position.y)<p.scale.y/2&&Math.abs(p.position[axis]-overlay.position[axis])<.05);
      expect(panel).toBeDefined();expect(Math.abs(panel!.position[axis]-overlay.position[axis])).toBeGreaterThan(.012);
    }
    for(const cap of caps){const center=cap.getCenter(new THREE.Vector3()),solid=PG_MAP.solids.find(s=>(s.kind==="utility"||s.kind==="transit")&&Math.abs(s.center.x-center.x)<.001&&Math.abs(s.center.z-center.z)<.001);
      expect(solid).toBeDefined();expect(cap.min.y).toBeGreaterThan(solid!.center.y+solid!.half.y+.001);
    }
    world.dispose();
  });
});
