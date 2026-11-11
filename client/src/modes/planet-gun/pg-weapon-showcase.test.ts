import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PG_WEAPONS, type PgWeaponId } from "@planetfall/shared";
import { BrWeaponModelLibrary } from "../battle-royale/br-weapon-model-library";
import { PG_PREVIEW_MODELS } from "./pg-kit-preview";
import { createPgWeaponShowcase } from "./pg-weapon-showcase";

const region = {viewportWidth:1280,viewportHeight:720,left:810,top:130,width:380,height:180};
function lens() {
  const camera = new THREE.PerspectiveCamera(67, 1280/720, .05, 200);
  camera.position.set(5,8,-3); camera.lookAt(-7,2,-14); camera.updateMatrixWorld(true);
  return camera;
}
afterEach(() => vi.restoreAllMocks());
describe("canonical weapon inspection", () => {
  it("frames the complete geometry for all ten stock weapons on an offset camera", () => {
    const stage = createPgWeaponShowcase(), camera = lens(), p = new THREE.Vector3();
    for(const id of Object.keys(PG_WEAPONS) as PgWeaponId[]) {
      stage.setSelection(id); stage.update(camera,region,2,"low",false);
      expect(stage.root.children).toHaveLength(1);
      const model = stage.root.children[0];
      expect(model.name).toBe('br-weapon-' + (PG_PREVIEW_MODELS[id] ?? 'orbit-sidearm'));
      expect(model.getObjectByName('pg-' + id + '-power-cell')).toBeDefined();
      stage.root.updateMatrixWorld(true);
      const screen = new THREE.Box2(), screenPoint = new THREE.Vector2();
      model.traverseVisible(part => {
        if(!(part instanceof THREE.Mesh)) return;
        const positions = part.geometry.getAttribute("position");
        for(let i=0;i<positions.count;i++) {
          p.fromBufferAttribute(positions,i).applyMatrix4(part.matrixWorld).project(camera);
          screen.expandByPoint(screenPoint.set((1+p.x)*region.viewportWidth/2,(1-p.y)*region.viewportHeight/2));
        }
      });
      expect(screen.min.x).toBeGreaterThan(region.left); expect(screen.max.x).toBeLessThan(region.left+region.width);
      expect(screen.min.y).toBeGreaterThan(region.top); expect(screen.max.y).toBeLessThan(region.top+region.height);
      expect(screen.max.x-screen.min.x).toBeGreaterThan((screen.max.y-screen.min.y)*1.1);
    }
    stage.dispose();
  });
  it("holds a single selection and static reduced-motion pose without mutating canonical vertices", () => {
    const stage=createPgWeaponShowcase(), camera=lens(); stage.setSelection("pulse");
    const model=stage.root.children[0];
    const mesh = model.children.find(part=>part instanceof THREE.Mesh) as THREE.Mesh;
    const vertices=Array.from(mesh.geometry.getAttribute("position").array);
    const neutral = () => { stage.root.updateMatrixWorld(); return stage.root.matrixWorld.toArray(); };
    stage.update(camera,region,0,"high",true); const fixed=neutral();
    for(let i=0;i<50;i++) {
      stage.setSelection("pulse"); stage.update(camera,region,i,"high",true);
      expect(stage.root.children).toEqual([model]); expect(neutral()).toEqual(fixed);
    }
    stage.update(camera,region,3,"high",false); expect(neutral()).not.toEqual(fixed);
    expect(Array.from(mesh.geometry.getAttribute("position").array)).toEqual(vertices);
    stage.setSelection(null); expect(stage.root.visible).toBe(false); expect(stage.root.children).toHaveLength(0); stage.dispose();
  });
  it("returns borrowed resources through their owner exactly once on switch and teardown", () => {
    const release=vi.spyOn(BrWeaponModelLibrary.prototype,"dispose");
    const stage=createPgWeaponShowcase(), parent = new THREE.Scene(); parent.add(stage.root); stage.setSelection("rail");
    const model=stage.root.children[0];
    expect(model.userData.borrowedWeaponResources).toBe(true);
    const borrowed = model.children.find(part=>part instanceof THREE.Mesh && part.geometry instanceof THREE.CylinderGeometry) as THREE.Mesh;
    const dispose=vi.spyOn(borrowed.geometry,"dispose");
    stage.setSelection("rail"); expect(release).not.toHaveBeenCalled();
    stage.setSelection("orbit"); expect(release).toHaveBeenCalledTimes(1); expect(dispose).toHaveBeenCalledOnce(); expect(model.parent).toBeNull();
    stage.dispose(); stage.dispose(); stage.setSelection("nova");
    expect(release).toHaveBeenCalledTimes(2); expect(dispose).toHaveBeenCalledOnce();
    expect(stage.root.parent).toBeNull(); expect(stage.root.children).toHaveLength(0);
  });
});
