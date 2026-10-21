import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { PR_BALANCE, PR_ROUNDS, prObstacleTransform, prPlatformCenter } from "@planetfall/shared";
import { PrWorldRenderer } from "./pr-world";

describe("PlanetRun visible authoritative surfaces",()=>{
  it("keeps machinery trim flush with hit volumes and open-gate paint tied to shared state",()=>{
    for(const round of PR_ROUNDS){
      const view=new PrWorldRenderer(round);
      for(const o of round.obstacles){
        if(o.kind!=="door"&&o.kind!=="rotator")continue;
        const body=view.root.getObjectByName(o.id)!;
        const shell=body.getObjectByName("authoritative-hazard")!;
        expect(shell.scale.toArray()).toEqual([o.half.x*2,o.half.y*2,o.half.z*2]);
        body.position.set(0,0,0);body.rotation.set(0,0,0);body.updateMatrixWorld(true);
        const bounds=new THREE.Box3().setFromObject(body);
        for(const axis of ["x","y","z"] as const){
          expect(bounds.min[axis]).toBeGreaterThanOrEqual(-o.half[axis]-.01);
          expect(bounds.max[axis]).toBeLessThanOrEqual(o.half[axis]+.01);
        }
        body.position.copy(o.center);
        if(o.kind==="door"){
          const mark=view.root.getObjectByName(`${o.id}-open-passage`)!;
          let sawOpen=false,sawClosed=false;
          for(let ms=0;ms<10000;ms+=100){
            view.update(ms,173,new Map());
            const active=prObstacleTransform(o,ms,173).active;
            expect(body.visible).toBe(active);expect(mark.visible).toBe(!active);
            sawOpen ||= !active;sawClosed ||= active;
          }
          expect(sawOpen&&sawClosed).toBe(true);
          const paintBounds=new THREE.Box3().setFromObject(mark);
          expect(paintBounds.max.y-paintBounds.min.y).toBeLessThan(.02);
        }
      }
      view.dispose();
    }
  });
  it("keeps six facility signatures and finite bounded sky geometry within a modest draw budget",()=>{
    const signatures=new Set<string>();
    for(const round of PR_ROUNDS){
      const view=new PrWorldRenderer(round);
      const facility=view.root.getObjectByName(`signature-${round.id}`)!;
      expect(facility).toBeDefined();signatures.add(facility.name);
      expect(view.root.getObjectByName("distant-band-planet")).toBeDefined();
      let draws=0;
      view.root.traverse(o=>{
        if(o instanceof THREE.Mesh||o instanceof THREE.Points){
          draws++;
          for(const value of o.geometry.getAttribute("position").array)expect(Number.isFinite(value)).toBe(true);
        }
      });
      expect(draws).toBeLessThan(200);
      view.dispose();
    }
    expect(signatures.size).toBe(6);
  });
  it("matches every shared platform extent and moving hazard transform",()=>{
    for(const round of PR_ROUNDS){
      const view=new PrWorldRenderer(round);
      view.update(3412,173,new Map());
      for(const p of round.platforms){
        const group=view.root.getObjectByName(p.id)!;
        expect(group.position.toArray()).toEqual(Object.values(prPlatformCenter(p,3412)));
        const mesh=group.getObjectByName("authoritative-platform")!;
        expect(mesh.scale.toArray()).toEqual([p.half.x*2,p.half.y*2,p.half.z*2]);
      }
      for(const o of round.obstacles){
        const body=view.root.getObjectByName(o.id)!;
        const state=prObstacleTransform(o,3412,173);
        expect(body.visible).toBe(o.kind==="boost"||state.active||o.kind==="meteor"&&state.warning);
        expect(body.rotation.y).toBe(o.kind==="rotator"?-state.yaw:0);
        if(o.kind==="rotator") {
          body.updateMatrixWorld(true);
          const end=new THREE.Vector3(o.half.x,0,0).applyMatrix4(body.matrixWorld);
          expect(end.x-o.center.x).toBeCloseTo(Math.cos(state.yaw)*o.half.x);
          expect(end.z-o.center.z).toBeCloseTo(Math.sin(state.yaw)*o.half.x);
        }
      }
      view.dispose();expect(view.root.children).toHaveLength(0);
    }
  });
  it("uses pointy hexes with exact support tops and removes expired cells",()=>{
    const round=PR_ROUNDS.find(r=>r.id==="shatterdeck")!;
    const view=new PrWorldRenderer(round), mesh=view.root.getObjectByName("shatterdeck-cells") as THREE.InstancedMesh;
    mesh.geometry.computeBoundingBox();
    const box=mesh.geometry.boundingBox!;
    expect(box.max.x).toBeCloseTo(Math.sqrt(3)*PR_BALANCE.tileRadius/2);
    expect(box.max.z).toBeCloseTo(PR_BALANCE.tileRadius);
    const m=new THREE.Matrix4();mesh.getMatrixAt(0,m);
    expect(m.elements[13]+box.max.y).toBeCloseTo(round.tiles[0].center.y);
    const triggered=new Map([[round.tiles[0].id,0]]);
    view.update(PR_BALANCE.tileBreakMs,0,triggered);mesh.getMatrixAt(0,m);
    expect(m.elements[0]).toBe(0);expect(m.elements[5]).toBe(0);expect(m.elements[10]).toBe(0);
    mesh.getMatrixAt(1,m);expect(m.elements[0]).toBe(1);
    view.dispose();
  });
});
