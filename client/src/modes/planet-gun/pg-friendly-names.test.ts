import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {pgFriendlyNameOpacity,pgNameOccluded,createPgFriendlyNames} from "./pg-friendly-names";
const me={id:"me",team:"solar" as const,hp:100},friend={id:"friend",team:"solar" as const,hp:100};
describe("PlanetGun friendly name visibility",()=>{
 it("hides a pilot behind a wall even when the floating label clears its top",()=>{
  const context={font:"",fillStyle:"",strokeStyle:"",lineWidth:1,textAlign:"",measureText:()=>({width:90}),beginPath(){},roundRect(){},fill(){},stroke(){},fillText(){},moveTo(){},lineTo(){}};
  vi.stubGlobal("document",{createElement:()=>({width:1,height:1,getContext:()=>context})});
  const wall={id:"cover",kind:"habitat" as const,center:{x:0,y:1.625,z:-5},half:{x:2,y:1.625,z:.3},mantle:false};
  const clear=createPgFriendlyNames([]),covered=createPgFriendlyNames([wall]);
  try{
   const camera=new THREE.PerspectiveCamera(78,16/9,.03,100);camera.position.set(0,4.37,-10);camera.lookAt(2,2,0);camera.updateMatrixWorld(true);
   const local={...me,name:"Me",position:{x:0,y:2.8,z:-10},crouched:false},ally={...friend,name:"Friend",position:{x:0,y:0,z:0},crouched:false};
   expect(pgNameOccluded(camera.position,{x:0,y:2.55,z:0},[wall])).toBe(false);
   for(const resolver of [undefined,()=>({x:0,y:.25,z:0})]){
    clear.update([local,ally],local,camera,200,720,resolver);covered.update([local,ally],local,camera,200,720,resolver);
    expect(clear.stats().visible).toBe(1);expect(covered.stats().visible).toBe(0);
   }
  }finally{clear.dispose();covered.dispose();vi.unstubAllGlobals();}
 });
 it("removes labels on death and leave, recreates cleanly on respawn, and never allocates enemies",()=>{
  const context={font:"",fillStyle:"",strokeStyle:"",lineWidth:1,textAlign:"",measureText:(name:string)=>({width:name.length*15}),beginPath(){},roundRect(){},fill(){},stroke(){},fillText(){},moveTo(){},lineTo(){}};
  vi.stubGlobal("document",{createElement:()=>({width:1,height:1,getContext:()=>context})});const labels=createPgFriendlyNames();
  try{const camera=new THREE.PerspectiveCamera(78,16/9,.03,100);camera.position.set(-40,1.57,-27);camera.lookAt(-35,1.57,-27);camera.updateMatrixWorld(true);
   const local={...me,name:"Me",position:{x:-40,y:0,z:-27},crouched:false},ally={...friend,name:"Friend",position:{x:-35,y:0,z:-27},crouched:false},enemy={...ally,id:"enemy",team:"void" as const};
   labels.update([local,ally,enemy],local,camera,0,720);expect(labels.stats()).toEqual({allocated:1,visible:1});
   labels.update([local,{...ally,hp:0},enemy],local,camera,150,720);expect(labels.stats()).toEqual({allocated:0,visible:0});
   labels.update([local,ally,enemy],local,camera,300,720);expect(labels.stats().visible).toBe(1);labels.update([local,enemy],local,camera,450,720);expect(labels.stats()).toEqual({allocated:0,visible:0});
  }finally{labels.dispose();vi.unstubAllGlobals();}
 });
 it("never labels the local pilot, opponents or dead pilots",()=>{expect(pgFriendlyNameOpacity(me,me,5,false)).toBe(0);expect(pgFriendlyNameOpacity({...friend,team:"void"},me,5,false)).toBe(0);expect(pgFriendlyNameOpacity({...friend,hp:0},me,5,false)).toBe(0);expect(pgFriendlyNameOpacity(friend,{...me,hp:0},5,false)).toBe(0);});
 it("keeps near names readable then fades and hides beyond 30m",()=>{expect(pgFriendlyNameOpacity(friend,me,15,false)).toBe(1);expect(pgFriendlyNameOpacity(friend,me,22,false)).toBeLessThan(1);expect(pgFriendlyNameOpacity(friend,me,29,false)).toBeGreaterThan(0);expect(pgFriendlyNameOpacity(friend,me,30,false)).toBe(0);expect(pgFriendlyNameOpacity(friend,me,5,true)).toBe(0);});
 it("uses opaque authoritative solids for line of sight instead of a through-wall label",()=>{const wall={id:"wall",kind:"habitat" as const,center:{x:0,y:2,z:-5},half:{x:2,y:2,z:.3},mantle:false};expect(pgNameOccluded({x:0,y:1.6,z:0},{x:0,y:2.3,z:-10},[wall])).toBe(true);expect(pgNameOccluded({x:4,y:1.6,z:0},{x:4,y:2.3,z:-10},[wall])).toBe(false);expect(pgNameOccluded({x:0,y:1.6,z:0},{x:0,y:2.3,z:-2},[wall])).toBe(false);});
});
