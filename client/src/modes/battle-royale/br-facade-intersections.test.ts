import { describe, expect, it } from "vitest";
import { BR_STRUCTURES } from "@planetfall/shared";
import { buildStorefrontFrameParts, type FacadePart } from "./br-facades";
import { buildBrFacadeSkin } from "./br-facade-skin";
import { buildBrDoorwayParts, buildBrFreightPilasters } from "./br-facade-attachments";
import { buildBrFacadeLeds } from "./br-facade-leds";
import { brFacadeIntersections } from "./br-facade-intersections";

const pane:FacadePart={face:"north",finish:"glass",position:{x:0,y:3,z:5},scale:{x:3,y:3,z:.06}};
describe("unintended decorative intersections",()=>{
  it("detects broad trim through a window and preserves intentional backing and thin mullions",()=>{
    const cut:FacadePart={...pane,finish:"panel",scale:{x:.35,y:5,z:.5}};
    expect(brFacadeIntersections([pane,cut])).toHaveLength(1);
    expect(brFacadeIntersections([pane,{...cut,position:{...cut.position,z:4.7},scale:{...cut.scale,z:.1}}])).toEqual([]);
    expect(brFacadeIntersections([pane,{...cut,scale:{...cut.scale,x:.09}}])).toEqual([]);
    for(const face of ["south","east","west"] as const){
      const orient=(p:FacadePart):FacadePart=>({...p,face,
        position:{x:face==="east"?p.position.z:face==="west"?-p.position.z:p.position.x,y:p.position.y,z:face==="south"?-p.position.z:p.position.x},
        scale:{x:face==="east"||face==="west"?p.scale.z:p.scale.x,y:p.scale.y,z:face==="east"||face==="west"?p.scale.x:p.scale.z}});
      expect(brFacadeIntersections([orient(pane),orient(cut)])).toHaveLength(1);
    }
  });
  it("audits the whole island's facade and LED boxes",()=>{
    const issues=BR_STRUCTURES.flatMap(s=>brFacadeIntersections([...buildBrFacadeSkin(s),...buildBrDoorwayParts(s),...buildBrFreightPilasters(s),...buildStorefrontFrameParts(s),...buildBrFacadeLeds(s)]).map(issue=>({structure:s.id,...issue})));
    expect(issues).toEqual([]);
  });
});
