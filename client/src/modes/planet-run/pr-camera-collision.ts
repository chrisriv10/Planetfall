import type {Object3D} from "three";

/** Raycaster also intersects hidden meshes. Hazard collision proxies remain
 * hidden under authored art, so shared active state owns camera obstruction. */
export function prCameraSurfaceBlocks(object:Object3D):boolean{
 if(object.name==="authoritative-hazard")return object.parent?.userData.prHazardActive===true;
 return object.name==="authoritative-platform"||object.name==="shatterdeck-cells";
}
