import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {PG_MAP} from "@planetfall/shared";
import {PgWorldRenderer} from "./pg-world";

const visible=(world:PgWorldRenderer)=>{const objects:THREE.Object3D[]=[];world.root.traverseVisible(o=>objects.push(o));return objects;};
describe("Nova Block architectural presentation",()=>{
  it("dresses both equipment end faces within the original height and span",()=>{
    const world=new PgWorldRenderer(),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion();
    // New lounge/workbench furniture has its own architectural shell, rather
    // than the generic equipment-enclosure end panels checked here.
    const bodies=PG_MAP.solids.filter(s=>(s.kind==="utility"||s.kind==="transit")&&!s.id.startsWith("nova-")&&!s.id.startsWith("ion-"));
    let panels=0;
    world.root.traverse(o=>{if(!(o instanceof THREE.InstancedMesh)||!o.name.startsWith("cover-end-"))return;
      for(let i=0;i<o.count;i++){
        o.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);
        const solid=bodies.find(s=>Math.abs(Math.abs(position.x-s.center.x)-s.half.x)<.039&&Math.abs(position.z-s.center.z)+scale.z/2<=s.half.z+.00001&&Math.abs(position.y-s.center.y)+scale.y/2<=s.half.y+.00001);
        expect(solid).toBeDefined();expect(Math.abs(position.x-solid!.center.x)+scale.x/2-solid!.half.x).toBeLessThan(.038);
        if(o.name.startsWith("cover-end-panel:"))panels++;
      }
    });
    expect(panels).toBe(bodies.length*2);
    world.setQuality("low");expect(visible(world).some(o=>o.name.startsWith("cover-end-panel:"))).toBe(true);
    expect(visible(world).some(o=>o.name.startsWith("cover-end-vent:"))).toBe(false);world.dispose();
  });
  it("keeps district signs outside facade layers and backed by opaque walls",()=>{
    const canvas={width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})};
    vi.stubGlobal("document",{createElement:()=>canvas});
    const world=new PgWorldRenderer();
    try{
      for(const [name,face,sign]of [["SOLAR / HABITAT 01",-20.6,1],["VOID / OBSERVATORY",26.6,-1],["HYDROPONICS  /  ION RUN",-30.65,1],["MAINTENANCE / 03",29.35,1]] as const){
        const label=world.root.getObjectByName(`district-sign:${name}`) as THREE.Mesh<THREE.PlaneGeometry>;
        expect(label).toBeDefined();expect((label.position.z-face)*sign).toBeCloseTo(.085,5);
        // Entire label stays on its supporting wall segment, never an entrance.
        const half=label.geometry.parameters.width/2;
        const span=name.startsWith("SOLAR")?[-35,-15]:name.startsWith("VOID")?[19,35]:name.startsWith("HYDRO")?[-21,9]:[-7,-3];
        expect(label.position.x-half).toBeGreaterThanOrEqual(span[0]);expect(label.position.x+half).toBeLessThanOrEqual(span[1]);
      }
      const habitat=world.root.getObjectByName("district-sign:NOVA HABITAT") as THREE.Mesh<THREE.PlaneGeometry>;
      const backing=PG_MAP.solids.find(s=>s.id==="nova-nameplate")!;
      expect(habitat.rotation.y).toBe(0); // Positive-Z frontage: readable from the street.
      expect(habitat.position.z-(backing.center.z+backing.half.z)).toBeCloseTo(.085);
      expect(habitat.geometry.parameters.width/2).toBeLessThan(backing.half.x);
      expect(habitat.geometry.parameters.height/2).toBeLessThan(backing.half.y);
    }finally{world.dispose();vi.unstubAllGlobals();}
  });
  it("keeps horizon identity and structural facade detail on Low without dynamic fixture lights",()=>{
    const world=new PgWorldRenderer();world.setQuality("low");const objects=visible(world);
    for(const name of["neighborhood-planet","neighborhood-stars","orbital-structural-silhouettes"])expect(objects.some(o=>o.name===name)).toBe(true);
    for(const prefix of["structural-pilaster:","bay-jamb:","roof-fascia:","gallery-fascia:","cover-panel:","entrance-jamb:"])
      expect(objects.some(o=>o.name.startsWith(prefix))).toBe(true);
    expect(objects.some(o=>o instanceof THREE.Light)).toBe(false);
    const planet=world.root.getObjectByName("neighborhood-planet") as THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;
    expect(planet.position.y+planet.geometry.parameters.radius).toBeGreaterThan(25);
    expect(planet.material.fog).toBe(false);world.dispose();
  });
  it("uses bounded shared materials and instancing rather than a draw per facade panel",()=>{
    const world=new PgWorldRenderer();world.setQuality("high");const objects=visible(world),materials=new Set<THREE.Material>();
    const meshes=objects.filter((o):o is THREE.Mesh=>o instanceof THREE.Mesh);
    for(const mesh of meshes)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(m);
    expect(meshes.length).toBeLessThan(110);expect(materials.size).toBeLessThan(30);
    expect(meshes.filter(o=>o instanceof THREE.InstancedMesh).length).toBeGreaterThan(40);
    for(const mesh of meshes)if(mesh instanceof THREE.InstancedMesh){
      const matrix=new THREE.Matrix4();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);expect(matrix.elements.every(Number.isFinite)).toBe(true);expect(matrix.determinant()).toBeGreaterThan(0);}
    }
    world.dispose();
  });
  it("has distinct layered service surfaces with no transparent wall-sized planes",()=>{
    const world=new PgWorldRenderer(),mat=new THREE.Matrix4(),pos=new THREE.Vector3(),scale=new THREE.Vector3(),rot=new THREE.Quaternion();
    const layers=new Map<string,number[]>();let serviceFeatures=0;
    world.root.traverse(o=>{if(!(o instanceof THREE.InstancedMesh))return;
      if(["panel:","run-panel-seam:","bay-jamb:"].some(prefix=>o.name.startsWith(prefix)))for(let i=0;i<o.count;i++){
        o.getMatrixAt(i,mat);mat.decompose(pos,rot,scale);
        // East service face, whose authoritative X face is 12.65.
        if(pos.x>12.5&&pos.x<12.65){expect(12.65-pos.x+scale.x/2).toBeLessThan(.04);const key=o.name.split(":")[0];layers.set(key,[...(layers.get(key)??[]),pos.x]);}
      }
      const materials=Array.isArray(o.material)?o.material:[o.material];expect(materials.every(m=>!m.transparent)).toBe(true);
      for(const [index,feature]of(o.userData.features??[]).entries())if(feature.name.startsWith("ion-run-")){
        serviceFeatures++;o.getMatrixAt(index,mat);o.geometry.computeBoundingBox();
        const bounds=o.geometry.boundingBox!.clone().applyMatrix4(mat);
        expect(12.65-bounds.min.x,feature.name).toBeLessThan(.04);
        expect(bounds.min.y).toBeGreaterThanOrEqual(0);expect(bounds.max.y).toBeLessThanOrEqual(3.2);
        expect(bounds.min.z).toBeGreaterThanOrEqual(17);expect(bounds.max.z).toBeLessThanOrEqual(33);
      }
    });
    expect(serviceFeatures).toBeGreaterThan(9);
    // Other retained run walls still use separated cassette overlays. Ion's
    // lower bulkhead is now owned by the neighborhood shell above.
    world.dispose();
  });
});
