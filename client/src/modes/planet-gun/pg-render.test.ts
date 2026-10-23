import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {renderPgFrame} from "./pg-render";

describe("PlanetGun isolated first-person render pass",()=>{
 it("clears only depth before the independently lit viewmodel and counts both passes",()=>{
  const world=new THREE.Scene(),view=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,16/9),viewCamera=new THREE.PerspectiveCamera();
  const order:string[]=[],renderer={autoClear:false,info:{autoReset:true,reset:vi.fn(()=>order.push("reset"))},clearDepth:vi.fn(()=>order.push("depth")),render:vi.fn((scene:THREE.Scene)=>{expect(renderer.info.autoReset).toBe(false);order.push(scene===world?"world":"view");expect(renderer.autoClear).toBe(scene===world);})};
  renderPgFrame(renderer as unknown as THREE.WebGLRenderer,world,camera,view,viewCamera,true);
  expect(order).toEqual(["reset","world","depth","view"]);expect(viewCamera.fov).toBe(34);expect(viewCamera.aspect).toBe(16/9);expect(renderer.autoClear).toBe(false);expect(renderer.info.autoReset).toBe(true);
 });
 it("skips hidden/dead/review viewmodels and restores renderer ownership even if rendering fails",()=>{
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),render=vi.fn(),clearDepth=vi.fn(),renderer={autoClear:true,info:{autoReset:false,reset:vi.fn()},render,clearDepth};
  renderPgFrame(renderer as unknown as THREE.WebGLRenderer,scene,camera,new THREE.Scene(),camera,false);
  expect(render).toHaveBeenCalledTimes(1);expect(clearDepth).not.toHaveBeenCalled();
  render.mockImplementation(()=>{throw new Error("context lost");});
  expect(()=>renderPgFrame(renderer as unknown as THREE.WebGLRenderer,scene,camera,new THREE.Scene(),camera,true)).toThrow("context lost");
  expect(renderer.autoClear).toBe(true);expect(renderer.info.autoReset).toBe(false);
 });
});
