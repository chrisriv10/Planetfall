import {afterEach,describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {BrScanMarkers} from "./br-scan-markers";
class Element {
  style:Record<string,string>={};children:Element[]=[];textContent="";className="";clientWidth=800;clientHeight=600;
  setAttribute=vi.fn();remove=vi.fn();append(...children:Element[]){this.children.push(...children);}
}
function setup(){
  const created:Element[]=[];
  vi.stubGlobal("document",{createElement:()=>{const e=new Element();created.push(e);return e;}});
  const markers=new BrScanMarkers();const camera=new THREE.PerspectiveCamera(60,4/3,.1,1000);camera.updateMatrixWorld();
  return {markers,camera,created,root:markers.element as unknown as Element};
}
afterEach(()=>vi.unstubAllGlobals());
describe("approximate scanner marker pool",()=>{
  it("projects fixed server samples without refining their position or creating DOM per frame",()=>{
    const {markers,camera,created,root}=setup();const count=created.length;
    const sample={position:{x:0,y:0,z:-20},expiresAt:2000};const before=JSON.stringify(sample);
    for(const now of [100,500,1000]){
      markers.update([sample],camera,now);
      expect(root.children[0].style.left).toBe("400px");expect(root.children[0].style.top).toBe("300px");
      expect(root.children[0].children[1].textContent).toBe("APPROX");
    }
    expect(JSON.stringify(sample)).toBe(before);expect(created).toHaveLength(count);
    markers.update(Array(60).fill(sample),camera,1000);expect(root.children.filter(c=>c.style.display==="block")).toHaveLength(40);
    markers.dispose();markers.dispose();expect(root.remove).toHaveBeenCalledTimes(1);
  });
  it("hides expired, rear, distant, offscreen and invalid samples",()=>{
    const {markers,camera,root}=setup();
    const samples=[{position:{x:0,y:0,z:10},expiresAt:2000},{position:{x:0,y:0,z:-121},expiresAt:2000},{position:{x:80,y:0,z:-20},expiresAt:2000},{position:{x:NaN,y:0,z:-20},expiresAt:2000},{position:{x:0,y:0,z:-20},expiresAt:100}];
    markers.update(samples,camera,100);expect(root.children.every(c=>c.style.display==="none")).toBe(true);
    markers.update([{position:{x:0,y:0,z:-20},expiresAt:2000}],camera,100);markers.clear();
    expect(root.children.every(c=>c.style.display==="none")).toBe(true);markers.dispose();
  });
});
