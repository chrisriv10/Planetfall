import {afterEach,describe,expect,it,vi} from "vitest";
import type * as THREE from "three";
import {createPgKitPreview} from "./pg-kit-preview";

const renders=vi.hoisted(()=>({instances:[]as any[]}));
vi.mock("three",async importOriginal=>{
 const actual=await importOriginal<typeof THREE>();
 return {...actual,WebGLRenderer:class{
  domElement=Object.assign(new EventTarget(),{style:{cssText:"",cursor:""},className:"",tabIndex:-1,setAttribute:vi.fn(),focus:vi.fn(),setPointerCapture:vi.fn(),remove:vi.fn(),toDataURL:vi.fn(()=>"data:image/png;test")});
  setPixelRatio=vi.fn();setClearColor=vi.fn();setSize=vi.fn();dispose=vi.fn();forceContextLoss=vi.fn();render=vi.fn();
  constructor(){renders.instances.push(this);}
 }};
});
afterEach(()=>{vi.unstubAllGlobals();renders.instances.length=0;});
describe("live preview lifecycle",()=>{
 it("uses one renderer, restores live modules after thumbnails, and stops animation for reduced motion",()=>{
  const motion=Object.assign(new EventTarget(),{matches:true});
  vi.stubGlobal("window",{devicePixelRatio:1,matchMedia:()=>motion});
  const request=vi.fn(()=>7),cancel=vi.fn();
  vi.stubGlobal("requestAnimationFrame",request);vi.stubGlobal("cancelAnimationFrame",cancel);
  vi.stubGlobal("ResizeObserver",class{observe(){}disconnect(){}});
  const host={clientWidth:600,clientHeight:300,appendChild:vi.fn()}as unknown as HTMLElement;
  const preview=createPgKitPreview(host);preview.setWeapon("pulse",["reflex-array"]);preview.setVisible(true);
  expect(request).not.toHaveBeenCalled();expect(renders.instances).toHaveLength(1);
  const renderer=renders.instances[0],canvas=renderer.domElement;
  expect(canvas.tabIndex).toBe(0);
  const renderedScene=()=>renderer.render.mock.calls.at(-1)[0]as THREE.Scene;
  const yaw=renderedScene().children[0].rotation.y;
  const event=Object.assign(new Event("keydown",{cancelable:true}),{key:"ArrowRight"});canvas.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);expect(renderedScene().children[0].rotation.y).toBeCloseTo(yaw+.12);
  expect(preview.thumbnail("pulse",["precision-lens"])).toContain("data:image/png");
  expect(renderedScene().getObjectByName("pg-module-reflex-array")!.visible).toBe(true);
  expect(renderedScene().getObjectByName("pg-module-precision-lens")!.visible).toBe(false);
  const count=renderer.render.mock.calls.length;preview.thumbnail("pulse",["precision-lens"]);expect(renderer.render).toHaveBeenCalledTimes(count);
  motion.matches=false;motion.dispatchEvent(new Event("change"));expect(request).toHaveBeenCalledTimes(1);
  motion.matches=true;motion.dispatchEvent(new Event("change"));expect(cancel).toHaveBeenCalledWith(7);
  preview.setVisible(false);const hiddenCount=renderer.render.mock.calls.length;motion.dispatchEvent(new Event("change"));expect(renderer.render).toHaveBeenCalledTimes(hiddenCount);
  preview.dispose();preview.dispose();expect(renderer.dispose).toHaveBeenCalledTimes(1);expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
  const disposedCount=renderer.render.mock.calls.length;canvas.dispatchEvent(event);motion.dispatchEvent(new Event("change"));expect(renderer.render).toHaveBeenCalledTimes(disposedCount);
 });
});
