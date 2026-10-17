import {describe,it,expect} from "vitest";
import type {BrVehicleState} from "@planetfall/shared";
import {BrPhysicsWorld} from "./br-physics.js";
import {BrPredictionPhysics} from "../../../../client/src/modes/battle-royale/br-physics.js";

const vehicle=(yaw=0):BrVehicleState=>({id:"collision-skimmer",spawnId:"test",kind:"hover-skimmer",position:{x:0,y:.44,z:-80},velocity:{x:0,y:0,z:0},yaw,driverId:null});
describe("solid skimmer hulls",()=>{
  it.each((["hover-skimmer","relay-rover","ion-shuttle"] as const).flatMap(kind=>[0,Math.PI/4,Math.PI/2].map(yaw=>({kind,yaw}))))("blocks every approach with matching authority and prediction: $kind yaw $yaw",({kind,yaw})=>{
    const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics(),v={...vehicle(yaw),kind};
    authority.setVehicles([v]);prediction.setVehicles([v]);
    try{
      const angle=Math.PI-yaw,c=Math.cos(angle),s=Math.sin(angle);
      for(const [lx,lz]of [[5,0],[-5,0],[0,5],[0,-5]]){
        let a={x:lx*c+lz*s,y:.035,z:-80-lx*s+lz*c},b={...a};
        const desired={x:-(lx*c+lz*s)*.03,y:-.08,z:-(-lx*s+lz*c)*.03};
        for(let tick=0;tick<90;tick++){
          const ar=authority.move("pilot",a,desired,false),br=prediction.move(b,desired,false);
          a={x:a.x+ar.movement.x,y:a.y+ar.movement.y,z:a.z+ar.movement.z};b={x:b.x+br.movement.x,y:b.y+br.movement.y,z:b.z+br.movement.z};
          expect(a.x).toBeCloseTo(b.x,5);expect(a.y).toBeCloseTo(b.y,5);expect(a.z).toBeCloseTo(b.z,5);
        }
        expect(Math.hypot(a.x,a.z+80)).toBeGreaterThan(1.2);
        expect(a.y).toBeLessThan(.15);
      }
    }finally{authority.dispose();prediction.dispose();}
  });
  it("moves and removes query hulls without leaving invisible parked blockers",()=>{
    const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
    try{
      const v=vehicle();authority.setVehicles([v]);prediction.setVehicles([v]);
      expect(authority.rayDistance({x:5,y:1.2,z:-80},{x:-1,y:0,z:0},10)).toBeLessThan(5);
      const moved={...v,position:{x:12,y:.44,z:-80}};authority.setVehicles([moved]);prediction.setVehicles([moved]);
      expect(authority.rayDistance({x:5,y:1.2,z:-80},{x:-1,y:0,z:0},8)).toBe(8);
      authority.setVehicles([]);prediction.setVehicles([]);
      const a=authority.move("pilot",{x:1.6,y:.035,z:-80},{x:-.4,y:-.08,z:0},false);
      const b=prediction.move({x:1.6,y:.035,z:-80},{x:-.4,y:-.08,z:0},false);
      expect(a.movement.x).toBeCloseTo(-.4);expect(b.movement.x).toBeCloseTo(-.4);
    }finally{authority.dispose();prediction.dispose();}
  });
  it("blocks crouched passage and supports a pilot landing on the vehicle",()=>{
    const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics(),v=vehicle();authority.setVehicles([v]);prediction.setVehicles([v]);
    try{
      let a={x:4,y:.035,z:-80},b={...a};
      for(let tick=0;tick<70;tick++){
        const ar=authority.move("crouched",a,{x:-.12,y:-.08,z:0},false,true),br=prediction.move(b,{x:-.12,y:-.08,z:0},false,true);
        a={x:a.x+ar.movement.x,y:a.y+ar.movement.y,z:a.z+ar.movement.z};b={x:b.x+br.movement.x,y:b.y+br.movement.y,z:b.z+br.movement.z};
      }
      expect(a.x).toBeGreaterThan(1);expect(a.x).toBeCloseTo(b.x,5);
      a={x:0,y:4,z:-79.34};b={...a};
      for(let tick=0;tick<40;tick++){
        const ar=authority.move("landing",a,{x:0,y:-.15,z:0},false),br=prediction.move(b,{x:0,y:-.15,z:0},false);
        a={...a,y:a.y+ar.movement.y};b={...b,y:b.y+br.movement.y};
      }
      expect(a.y).toBeGreaterThan(2);expect(a.y).toBeCloseTo(b.y,5);
    }finally{authority.dispose();prediction.dispose();}
  });
});
