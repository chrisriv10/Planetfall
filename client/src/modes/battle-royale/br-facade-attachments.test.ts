import {describe,expect,it} from "vitest";
import {BR_STRUCTURES,type Vec3} from "@planetfall/shared";
import {buildBrDoorwayParts,buildBrFreightPilasters} from "./br-facade-attachments";
import {buildFacadeParts,buildStorefrontFrameParts} from "./br-facades";
import {brFacadeIntersections} from "./br-facade-intersections";
import {buildBrFacadeSkin} from "./br-facade-skin";
import {buildBrEntranceHeaderFinish} from "./br-entrance-header-finish";
import {buildBrFacadeLeds} from "./br-facade-leds";
import {buildBrFacadeSign,getBrFacadeSignText} from "./br-facade-signs";

describe("mounted doorway and freight hardware",()=>{
  it("separates actual facade skins and attachments across every neighbouring building pair",()=>{
    const assemblies=BR_STRUCTURES.map(s=>{
      const text=getBrFacadeSignText(s),sign=text?buildBrFacadeSign(s,text):null;
      const parts:Array<{finish:string;position:Vec3;scale:Vec3}>=[...buildBrFacadeSkin(s),...buildBrDoorwayParts(s),...buildBrFreightPilasters(s),...buildStorefrontFrameParts(s),...buildBrFacadeLeds(s)]
        .map(p=>({...p,position:{...p.position,y:p.position.y+s.position.y}}));
      parts.push(...buildBrEntranceHeaderFinish(s));
      if(sign)parts.push(...sign.parts.map(p=>({...p,face:s.entrance})));
      return {s,parts};
    });
    const issues:string[]=[];
    for(let i=0;i<assemblies.length;i++)for(const b of assemblies.slice(i+1)){
      const a=assemblies[i];
      if(Math.abs(a.s.position.x-b.s.position.x)>(a.s.size.x+b.s.size.x)/2+8||Math.abs(a.s.position.z-b.s.position.z)>(a.s.size.z+b.s.size.z)/2+8)continue;
      for(const p of a.parts)for(const q of b.parts){
        const overlap=(axis:"x"|"y"|"z")=>(p.scale[axis]+q.scale[axis])/2-Math.abs(p.position[axis]-q.position[axis]);
        if(Math.min(overlap("x"),overlap("y"),overlap("z"))>.01)issues.push(`${a.s.id}/${p.finish} : ${b.s.id}/${q.finish}`);
      }
    }
    expect(issues).toEqual([]);
  });
  it("keeps every doorway attachment clear of neighbouring exterior walls",()=>{
    for(const s of BR_STRUCTURES)for(const part of buildBrDoorwayParts(s))for(const other of BR_STRUCTURES){
      if(other.id===s.id)continue;
      const y=part.position.y+s.position.y;
      if(y+part.scale.y/2<=other.position.y||y-part.scale.y/2>=other.position.y+other.size.y)continue;
      const gapX=Math.abs(part.position.x-other.position.x)-(part.scale.x+other.size.x)/2-.325;
      const gapZ=Math.abs(part.position.z-other.position.z)-(part.scale.z+other.size.z)/2-.325;
      expect(Math.max(gapX,gapZ),`${s.id} to ${other.id}`).toBeGreaterThanOrEqual(.2);
    }
  });
  it("preserves the full entrance below head height in every orientation",()=>{
    for(const source of BR_STRUCTURES)for(const entrance of ["north","south","east","west"] as const){
      const s={...source,entrance},along=entrance==="north"||entrance==="south"?"x":"z";
      const parts=buildBrDoorwayParts(s);
      if(!s.enterable){expect(parts).toEqual([]);continue;}
      expect(parts).toHaveLength(6);
      for(const p of parts){
        if(p.position.y-p.scale.y/2<3)expect(Math.abs(p.position[along]-s.position[along])-p.scale[along]/2).toBeGreaterThan(2.4);
        expect(Object.values(p.scale).every(v=>Number.isFinite(v)&&v>0)).toBe(true);
      }
      expect(brFacadeIntersections([...buildFacadeParts(s),...parts,...buildBrFreightPilasters(s)])).toEqual([]);
    }
  });
  it("joins each awning to its jamb brackets outside the window skin",()=>{
    for(const s of BR_STRUCTURES.filter(s=>s.enterable)){
      const parts=buildBrDoorwayParts(s),ns=s.entrance==="north"||s.entrance==="south",normal=ns?"z":"x";
      const sign=s.entrance==="north"||s.entrance==="east"?1:-1;
      const awning=parts.find(p=>p.scale.y===.22)!;
      const near=sign*(awning.position[normal]-s.position[normal])-awning.scale[normal]/2;
      expect(near).toBeCloseTo(s.size[normal]/2+.8);
      for(const arm of parts.filter(p=>p.scale.y===.25)){
        const far=sign*(arm.position[normal]-s.position[normal])+arm.scale[normal]/2;
        expect(far).toBeCloseTo(near);
        expect(arm.position.y+arm.scale.y/2).toBeGreaterThan(awning.position.y-awning.scale.y/2);
        expect(arm.position.y-arm.scale.y/2).toBeLessThan(4.2);
      }
    }
  });
  it("ends freight braces below the real clerestory with a visible wall gap",()=>{
    let checked=0;
    for(const s of BR_STRUCTURES){
      const parts=buildBrFreightPilasters(s);
      if(!parts.length)continue;
      checked++;expect(parts).toHaveLength(2);
      const panes=buildFacadeParts(s).filter(p=>p.face===s.entrance&&(p.finish==="glass"||p.finish==="lit"));
      for(const p of parts)expect(p.position.y+p.scale.y/2).toBeLessThanOrEqual(Math.min(...panes.map(p=>p.position.y-p.scale.y/2))-.149);
    }
    expect(checked).toBeGreaterThan(10);
  });
});
