import { describe,expect,it } from "vitest";
import { BR_LANDFORMS,BR_LANDFORM_TREES,BR_ROADS,BR_STRUCTURES,brAuthoredDeckHeight,brFloorHeightAt,brLandformHeightAt,isInsideBrIslandInterior,stepBrMovement,type BrMotionState } from "@planetfall/shared";
import { BrPhysicsWorld } from "./br-physics";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics";
import { placeBrLoot } from "./br-loot-placement";

describe("authored Orbital Isle landforms",()=>{
  it("keeps finite, gentle, upward triangles clear of streets, decks and buildings",()=>{
    for(const h of BR_LANDFORMS){
      expect(brLandformHeightAt(h,h.center)).toBeCloseTo(h.height);
      for(let i=0;i<h.vertices.length;i+=3){
        const p={x:h.vertices[i],y:h.vertices[i+1],z:h.vertices[i+2]};
        expect([p.x,p.y,p.z].every(Number.isFinite)).toBe(true);
        expect(isInsideBrIslandInterior(p,2),h.id).toBe(true);
        expect(brAuthoredDeckHeight(p),h.id).toBe(0);
        for(const s of BR_STRUCTURES)expect(Math.abs(p.x-s.position.x)>s.size.x/2+.5||Math.abs(p.z-s.position.z)>s.size.z/2+.5,`${h.id}/${s.id}`).toBe(true);
        if(p.y>.05)for(const road of BR_ROADS){
          const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,len=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((p.x-road.from.x)*dx+(p.z-road.from.z)*dz)/len));
          expect(Math.hypot(p.x-road.from.x-dx*t,p.z-road.from.z-dz*t),`${h.id}/${road.id}`).toBeGreaterThan(road.width/2+.5);
        }
      }
      for(let i=0;i<h.indices.length;i+=3){
        const [a,b,c]=Array.from(h.indices.slice(i,i+3)).map(n=>({x:h.vertices[n*3],y:h.vertices[n*3+1],z:h.vertices[n*3+2]}));
        const nx=(b.y-a.y)*(c.z-a.z)-(b.z-a.z)*(c.y-a.y),ny=(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z),nz=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
        expect(ny).toBeGreaterThan(0);expect(Math.atan2(Math.hypot(nx,nz),ny)).toBeLessThan(Math.PI/6);
      }
    }
    for(const tree of BR_LANDFORM_TREES)expect(tree.position.y).toBeCloseTo(brFloorHeightAt(tree.position,tree.position.y+.1));
  });

  it("matches prediction, authority, camera rays and loot to the same surface",()=>{
    const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
    try{
      for(const h of BR_LANDFORMS){
        let motion:BrMotionState={position:{x:h.center.x,y:.035,z:h.center.z-h.depth/2-2},velocity:{x:0,y:0,z:0},yaw:Math.PI,grounded:true,crouched:false,deployment:"grounded",downed:false,lastJumpSignal:false,lastCrouchSignal:false,slideEndsAt:0,traversalCooldownUntil:0};
        let predicted={...motion,position:{...motion.position},velocity:{...motion.velocity}};
        for(let frame=0;frame<900&&motion.position.z<h.center.z+h.depth/2+1.8;frame++){
          const input={moveX:0,moveY:1,yaw:Math.PI,jump:false,sprint:false,crouch:false};
          motion=stepBrMovement(motion,input,1/60,1000+frame*1000/60,(p,d,o)=>authority.move("pilot",p,d,o.jumping,o.crouched));
          predicted=stepBrMovement(predicted,input,1/60,1000+frame*1000/60,(p,d,o)=>prediction.move(p,d,o.jumping,o.crouched));
          const feet=motion.position,other=predicted.position;
          expect(motion.grounded,`${h.id} frame ${frame}`).toBe(true);
          expect(Math.hypot(feet.x-other.x,feet.y-other.y,feet.z-other.z)).toBeLessThan(.001);
          expect(feet.y).toBeGreaterThanOrEqual((brLandformHeightAt(h,feet)??0)-.005);
        }
        expect(motion.position.z).toBeGreaterThan(h.center.z+h.depth/2+1.7);
        for(const fraction of [-.31,-.13,0,.17,.36]){
          const p={x:h.center.x+1.1,y:20,z:h.center.z+h.depth*fraction},top=brLandformHeightAt(h,p)!;
          expect(authority.rayDistance(p,{x:0,y:-1,z:0},30)).toBeCloseTo(20-top,3);
          expect(prediction.cameraDistance(p,{x:0,y:-1,z:0},30)).toBeCloseTo(20-top,3);
          const loot=placeBrLoot({...p,y:top+1.3},{...p,y:top+1.3},(o,d,m)=>authority.rayDistance(o,d,m));
          const footprint=Math.max(...[[0,0],[.95,0],[-.95,0],[0,.95],[0,-.95],[.67,.67],[-.67,.67],[.67,-.67],[-.67,-.67]].map(([x,z])=>brLandformHeightAt(h,{x:p.x+x,z:p.z+z})!));
          expect(loot.position.y).toBeCloseTo(footprint+.58,3);
          expect(brFloorHeightAt(p,20)).toBeCloseTo(top,4);
        }
      }
    }finally{authority.dispose();prediction.dispose();}
  });
});
