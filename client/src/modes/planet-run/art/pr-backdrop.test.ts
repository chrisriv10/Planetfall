import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {PR_ROUNDS} from "@planetfall/shared";
import {PrWorldRenderer} from "../pr-world";

describe("PlanetRun background integration",()=>{
 it("keeps each layered district visual-only and scales detail through the existing quality path",()=>{
  for(const round of PR_ROUNDS){
   const world=new PrWorldRenderer(round),district=world.root.getObjectByName(`pr-backdrop:${round.id}`)!;
   expect(district).toBeDefined();expect(district.userData.cameraCollision).toBe(false);
   const count=()=>{let n=0;district.traverseVisible(o=>{if(o instanceof THREE.Mesh)n++;});return n;};
   world.setQuality("low");const low=count();world.setQuality("medium");const medium=count();world.setQuality("high");const high=count();
   expect(low).toBeGreaterThan(0);expect(medium).toBeGreaterThan(low);expect(high).toBeGreaterThanOrEqual(medium);
   district.traverse(o=>{expect(o.name).not.toMatch(/^authoritative-|^shatterdeck-cells$/);if(o instanceof THREE.Mesh)expect(o.userData.cameraCollision).toBe(false);});
   world.update(45000,42,new Map());world.dispose();expect(district.children).toHaveLength(0);
  }
 });
});
