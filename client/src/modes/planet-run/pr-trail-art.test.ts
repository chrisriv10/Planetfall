import * as THREE from "three";
import {describe,it,expect,vi} from "vitest";
import {SHOP_CATALOG} from "@planetfall/shared";
import {cosmeticTrailStyle} from "../../cosmetic-flight-trail";
import {createPrTrailArt} from "./pr-trail-art";

function fixture(){
  const scene=new THREE.Scene(),art=createPrTrailArt(scene);
  const mesh=scene.getObjectByName("planet-run-cosmetic-trail") as THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
  return {scene,art,mesh,position:new THREE.Vector3()};
}

describe("PlanetRun flight trail",()=>{
  it("retains the catalog width, particle silhouette, braiding and dark edged wake",()=>{
    const {art,mesh,position}=fixture(),u=mesh.material.uniforms;
    for(const [id,kind,shape] of [["plasma-helix",1,0],["solar-petals",0,1],["void-wake",3,0],["bubbles",0,2],["sparks",0,3]] as const){
      art.update(position,id,"#aabbcc",.05,true,true,.04);
      const style=cosmeticTrailStyle(id),color=SHOP_CATALOG.find(i=>i.category==="trail"&&i.id===id)?.color;
      expect(u.tint.value).toEqual(new THREE.Color(color??"#aabbcc"));
      expect(u.kind.value).toBe(kind);expect(u.shape.value).toBe(shape);
      expect(u.width.value).toBe(style.width);expect(u.particleSize.value).toBe(style.particles);expect(u.dashed.value).toBe(+style.dashed);
      expect(mesh.material.blending).toBe(id==="void-wake"?THREE.NormalBlending:THREE.AdditiveBlending);
      expect(mesh.count).toBe(1);
    }
    art.dispose();
  });
  it("reuses the same storage, stops uploads on far and idle, and clears history on teleports",()=>{
    const {art,mesh,position}=fixture(),buffer=mesh.instanceMatrix.array,geometry=mesh.geometry;
    const uploads=vi.spyOn(mesh,"setMatrixAt");
    const sample=(near:boolean,emit:boolean)=>art.update(position,"plasma-helix","#def",.05,near,emit,.03);
    sample(true,false);expect(uploads).not.toHaveBeenCalled();
    for(let i=0;i<100;i++){position.x+=.3;sample(true,true);}
    expect(mesh.visible).toBe(true);expect(mesh.count).toBeLessThanOrEqual(8);
    expect(mesh.count).toBeGreaterThan(2);expect(mesh.instanceMatrix.array).toBe(buffer);expect(mesh.geometry).toBe(geometry);
    position.x+=50;sample(true,true);expect(mesh.count).toBe(1);
    uploads.mockClear();const version=mesh.instanceMatrix.version;
    sample(false,true);sample(false,true);sample(true,false);
    expect(mesh.visible).toBe(false);expect(uploads).not.toHaveBeenCalled();expect(mesh.instanceMatrix.version).toBe(version);
    sample(true,true);for(let i=0;i<9;i++)sample(true,false);
    expect(mesh.visible).toBe(false);
    art.dispose();
  });
  it("releases the batch, geometry and material once",()=>{
    const {art,mesh,scene}=fixture(),disposed=[vi.fn(),vi.fn(),vi.fn()];
    mesh.addEventListener("dispose",disposed[0]);mesh.geometry.addEventListener("dispose",disposed[1]);mesh.material.addEventListener("dispose",disposed[2]);
    art.dispose();art.dispose();expect(scene.children).toHaveLength(0);for(const event of disposed)expect(event).toHaveBeenCalledTimes(1);
  });
});
