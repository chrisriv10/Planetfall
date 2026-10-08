import {afterEach,describe,expect,it,vi} from "vitest";
import {BR_POIS,BR_SECONDARY_LOCATIONS,type BrRoomView} from "@planetfall/shared";
import {brMapPercent} from "./br-map-art";
import {updateBrTacticalMap} from "./br-tactical-map";

// Minimal DOM ownership fixture. The real-browser map test separately verifies
// that image identity and responsive geometry survive live room updates.
class Element{
  parentElement:Element|null=null;
  children:Element[]=[];
  className="";textContent="";title="";hidden=false;
  style:Record<string,unknown>={setProperty:(key:string,value:string)=>{this.style[key]=value;}};
  replacements=0;
  append(...nodes:Element[]){for(const child of nodes){child.remove();child.parentElement=this;this.children.push(child);}}
  replaceChildren(...nodes:Element[]){for(const child of this.children)child.parentElement=null;this.children=[];this.replacements++;this.append(...nodes);}
  remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}}
}
const container=()=>{
  const created:Element[]=[];
  vi.stubGlobal("document",{createElement:()=>{const element=new Element();created.push(element);return element;}});
  const root=new Element();
  return {root,created,render:(x:number,z:number,room:BrRoomView|null=null,teammates:Array<{id:string;position:{x:number;y:number;z:number};color:string}>=[])=>
    updateBrTacticalMap(root as unknown as HTMLElement,{position:{x,y:0,z}},room,teammates)};
};
const room=(centerX:number,ship=true)=>({storm:{center:{x:centerX,z:20},radius:200,nextCenter:{x:30,z:40},nextRadius:100},ship:ship?{start:{x:-100,y:185,z:-50},end:{x:200,y:185,z:150}}:null}) as unknown as BrRoomView;
afterEach(()=>vi.unstubAllGlobals());

describe("persistent Battle Royale tactical map",()=>{
  it("retains static art, every authored label, circles and player across repeated live updates",()=>{
    const fixture=container();fixture.render(0,0,room(10));
    const initial=fixture.root.children.slice(),allocations=fixture.created.length;
    expect(initial.filter(element=>element.className==="br-map-poi")).toHaveLength(BR_POIS.length);
    expect(initial.filter(element=>element.className==="br-map-secondary")).toHaveLength(BR_SECONDARY_LOCATIONS.length);
    for(let sample=0;sample<100;sample++)fixture.render(sample,sample*2,room(sample));
    expect(fixture.root.children).toEqual(initial);
    for(let index=0;index<initial.length;index++)expect(fixture.root.children[index]).toBe(initial[index]);
    expect(fixture.created).toHaveLength(allocations);
    expect(fixture.root.replacements).toBe(1);
    const marker=initial.find(element=>element.className==="br-map-player")!;
    expect(marker.style.left).toBe(`${brMapPercent(99)}%`);expect(marker.style.top).toBe(`${brMapPercent(198)}%`);
    const circle=initial.find(element=>element.className==="br-map-circle")!;
    expect(circle.style.left).toBe(`${brMapPercent(99)}%`);expect(Number.parseFloat(String(circle.style.width))).toBeCloseTo(38.4,10);
  });
  it("updates teammate nodes by ID and removes old crew state without replacing art",()=>{
    const fixture=container(),mate={id:"crew-a",position:{x:10,y:0,z:12},color:"#70f5ff"};
    fixture.render(0,0,room(0),[mate]);
    const art=fixture.root.children[0],marker=fixture.root.children.at(-1)!;
    fixture.render(0,0,room(5),[{...mate,position:{x:80,y:0,z:40},color:"#ffd84d"}]);
    expect(fixture.root.children.at(-1)).toBe(marker);
    expect(marker.style.left).toBe(`${brMapPercent(80)}%`);expect(marker.style["--teammate-color"]).toBe("#ffd84d");
    fixture.render(0,0,room(5),[]);
    expect(marker.parentElement).toBeNull();
    expect(fixture.root.children[0]).toBe(art);
    expect(fixture.root.children.filter(element=>element.className==="br-map-player teammate")).toHaveLength(0);
  });
  it("hides absent room/ship layers and safely recreates only after an external clear",()=>{
    const fixture=container();fixture.render(0,0,room(0));
    const oldArt=fixture.root.children[0],route=fixture.root.children.find(element=>element.className==="br-map-route")!;
    expect(route.hidden).toBe(false);expect(route.style.transform).toBe(`rotate(${Math.atan2(19.2,28.8)}rad)`);
    fixture.render(0,0,room(0,false));expect(route.hidden).toBe(true);
    fixture.render(0,0);
    expect(fixture.root.children.filter(element=>element.className.startsWith("br-map-circle")).every(element=>element.hidden)).toBe(true);
    fixture.root.replaceChildren();fixture.render(0,0,room(5));
    expect(fixture.root.children[0]).not.toBe(oldArt);expect(oldArt.parentElement).toBeNull();
    expect(fixture.root.children.filter(element=>element.className==="br-map-poi")).toHaveLength(9);
  });
});
