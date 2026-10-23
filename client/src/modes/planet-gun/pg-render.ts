import * as THREE from "three";

/** Separate lighting sets: viewmodel fill must never illuminate the arena.
 * Preserve shared-renderer flags and count both passes (including shadows). */
export function renderPgFrame(renderer:THREE.WebGLRenderer,world:THREE.Scene,camera:THREE.PerspectiveCamera,viewmodel:THREE.Scene,viewCamera:THREE.PerspectiveCamera,showViewmodel:boolean):void {
 const clear=renderer.autoClear,reset=renderer.info.autoReset;
 renderer.info.autoReset=false;renderer.info.reset();
 try {
  renderer.autoClear=true;renderer.render(world,camera);
  if(showViewmodel){viewCamera.fov=camera.fov;viewCamera.aspect=camera.aspect;viewCamera.updateProjectionMatrix();renderer.autoClear=false;renderer.clearDepth();renderer.render(viewmodel,viewCamera);}
 } finally {renderer.autoClear=clear;renderer.info.autoReset=reset;}
}
