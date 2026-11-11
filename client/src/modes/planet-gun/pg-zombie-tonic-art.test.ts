import * as THREE from "three";
import {afterEach,describe,it,expect,vi} from "vitest";
import {createPgZombieTonicArt} from "./pg-zombie-tonic-art";

const sites=[
  {id:"core-reserve",name:"Core Reserve",color:0xff866b,price:1000},
  {id:"quick-circuit",name:"Quick Circuit",color:0xa3ff88,price:1200},
  {id:"velocity-blend",name:"Velocity Blend",color:0x82d4ff,price:1400},
].map((s,i)=>({...s,position:{x:-21.8+i*2.2,y:0,z:0},yaw:Math.PI}));
afterEach(()=>vi.unstubAllGlobals());
describe("Ion Tonic cabinets",()=>{
  it("pulses only the newly purchased cabinet once and cancels immediately for reduced motion",()=>{
    const art=createPgZombieTonicArt(sites);
    const [first,second]=art.root.children.map(node=>node.getObjectByName("tonic-flow")!);
    const initial=[sites[0].id], purchased=[...initial,sites[1].id];
    art.update(true,initial,100,"high",false);
    art.update(true,initial,320,"high",false);
    expect(first.scale.y).toBe(.024);
    art.update(true,purchased,400,"high",false);
    art.update(true,purchased,620,"high",false);
    expect(second.scale.y).toBeGreaterThan(.05);
    expect(first.scale.y).toBe(.024);
    art.update(true,purchased,1000,"high",false);
    expect(second.scale.y).toBe(.024);
    art.update(true,initial,1100,"high",false);
    art.update(true,purchased,1200,"high",false);
    art.update(true,purchased,1400,"high",true);
    art.update(true,purchased,1450,"high",false);
    expect(second.scale.y).toBe(.024);
    art.dispose();
  });
  it("bounds all three cabinets and distinguishes their reservoir geometry and readouts",()=>{
    const art=createPgZombieTonicArt(sites);art.root.updateMatrixWorld(true);
    art.update(true,[sites[1].id],300,"medium",true);
    const signatures=new Set<string>();
    for(const site of sites){
      const machine=art.root.getObjectByName(site.id)!,body=machine.getObjectByName("fixed-body-group")!;
      const sign=body.getObjectByName("machine-readout")!;
      expect(sign.getWorldDirection(new THREE.Vector3()).z).toBeGreaterThan(.99);
      const bounds=new THREE.Box3().setFromObject(body);bounds.translate(machine.position.clone().negate());
      expect(bounds.min.x).toBeGreaterThanOrEqual(-.5);expect(bounds.max.x).toBeLessThanOrEqual(.5);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-6);expect(bounds.max.y).toBeLessThanOrEqual(2);
      expect(bounds.min.z).toBeGreaterThanOrEqual(-.4);expect(bounds.max.z).toBeLessThanOrEqual(.4);
      expect(sign.userData.status).toContain(String(site.price));expect(sign.userData.status).toContain(site===sites[1]?"PURCHASED":"AVAILABLE");
      signatures.add(body.children.filter(c=>c instanceof THREE.InstancedMesh).map(c=>c.count).join(","));
    }
    expect(signatures.size).toBe(3);art.dispose();
  });
  it("updates text on changes only, keeps reduced/low displays still and releases shared geometry once",()=>{
    const ctx={fillText:vi.fn(),fillRect:vi.fn()};vi.stubGlobal("document",{createElement:()=>({getContext:()=>ctx})});
    const art=createPgZombieTonicArt(sites);
    const machine=art.root.children[0],sign=machine.getObjectByName("machine-readout") as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
    const flow=machine.getObjectByName("tonic-flow") as THREE.Mesh;
    art.update(false,[],0,"high",false);expect(sign.userData.status).toContain("NO POWER");
    art.update(true,[],0,"high",true);const count=ctx.fillText.mock.calls.length,x=flow.scale.x;
    for(let i=1;i<10;i++)art.update(true,[],i*100,"high",true);
    expect(ctx.fillText).toHaveBeenCalledTimes(count);expect(flow.scale.x).toBe(x);
    art.update(true,[],450,"low",false);expect(flow.scale.x).toBe(x);
    art.update(true,[],450,"high",false);expect(flow.scale.x).toBeGreaterThan(x);
    art.update(true,[sites[0].id],460,"high",false);expect(sign.userData.status).toContain("PURCHASED");expect(ctx.fillText.mock.calls.length).toBeGreaterThan(count);
    const release=vi.spyOn(flow.geometry,"dispose"),releaseSign=vi.spyOn(sign.material.map!,"dispose");
    art.dispose();art.dispose();expect(release).toHaveBeenCalledOnce();expect(releaseSign).toHaveBeenCalledOnce();
  });
});
