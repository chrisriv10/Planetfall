import {afterEach,describe,expect,it,vi} from "vitest";
import * as THREE from "three";
import {PgCharacterShowcaseLayer,type PgCharacterShowcase} from "./pg-character-showcase-layer";
afterEach(()=>vi.unstubAllGlobals());
describe("shared-renderer character showcase ownership",()=>{
 it("renders over world depth and restores renderer state even on failure",()=>{
  vi.stubGlobal("innerWidth",1280);vi.stubGlobal("innerHeight",720);
  const root=new THREE.Group(),update=vi.fn(),view={root,update}as unknown as PgCharacterShowcase;
  const stage={getBoundingClientRect:()=>({left:10,top:20,width:500,height:600})}as HTMLElement;
  const layer=new PgCharacterShowcaseLayer(),calls:string[]=[],renderer={autoClear:true,clearDepth:()=>calls.push("depth"),render:()=>{calls.push("draw");expect(renderer.autoClear).toBe(false);}};
  layer.set(view,stage);layer.render(renderer as unknown as THREE.WebGLRenderer,new THREE.PerspectiveCamera(),1,"medium",false);
  expect(calls).toEqual(["depth","draw"]);expect(renderer.autoClear).toBe(true);expect(update).toHaveBeenCalledOnce();
  renderer.render=()=>{throw new Error("draw failed");};expect(()=>layer.render(renderer as unknown as THREE.WebGLRenderer,new THREE.PerspectiveCamera(),2,"low",true)).toThrow("draw failed");expect(renderer.autoClear).toBe(true);
  layer.set(null,null);expect(root.parent).toBeNull();expect(root.visible).toBe(false);expect(layer.active).toBe(false);
 });
 it("never lets a stale renderer owner detach a reparented showcase",()=>{
  const view={root:new THREE.Group()}as PgCharacterShowcase,stage={}as HTMLElement,first=new PgCharacterShowcaseLayer(),second=new PgCharacterShowcaseLayer();
  first.set(view,stage);second.set(view,stage);const parent=view.root.parent;
  first.set(null,null);expect(view.root.parent).toBe(parent);expect(view.root.visible).toBe(true);
  second.set(null,null);expect(view.root.parent).toBeNull();
 });
 it("bakes a studio once for weapons and releases only owned resources",()=>{
  vi.stubGlobal("innerWidth",1280);vi.stubGlobal("innerHeight",720);
  const camera=new THREE.PerspectiveCamera(), target=new THREE.WebGLRenderTarget();
  const bake=vi.fn(()=>target),release=vi.spyOn(target,"dispose");
  const layer=new PgCharacterShowcaseLayer(bake),stage={getBoundingClientRect:()=>({left:0,top:0,width:280,height:180})}as HTMLElement;
  const root=new THREE.Group(),geo=new THREE.BoxGeometry(),skin=new THREE.MeshStandardMaterial({metalness:1});
  root.add(new THREE.Mesh(geo,skin));
  const discardGeo=vi.spyOn(geo,"dispose"),discardSkin=vi.spyOn(skin,"dispose");
  const update=vi.fn(),envs:(THREE.Texture|null)[]=[];
  const renderer={autoClear:true,clearDepth:vi.fn(),render:(scene:THREE.Scene)=>envs.push(scene.environment)}as unknown as THREE.WebGLRenderer;
  const draw=()=>layer.render(renderer,camera,0,"high",true);
  layer.set({root,update},stage);draw();expect(bake).not.toHaveBeenCalled();
  layer.set({root,update,lighting:"weapon"},stage);draw();draw();
  layer.set({root,update},stage);draw();
  layer.set({root,update,lighting:"weapon"},stage);draw();
  expect(bake).toHaveBeenCalledExactlyOnceWith(renderer);expect(envs).toEqual([null,target.texture,target.texture,null,target.texture]);
  expect(skin.envMap).toBe(null);expect(release).not.toHaveBeenCalled();
  const other=new THREE.Scene();other.add(root);draw();expect(envs.length).toBe(5);
  layer.dispose();layer.dispose();layer.set({root,update},stage);draw();
  expect(release).toHaveBeenCalledOnce();expect(root.parent).toBe(other);expect(root.visible).toBe(true);
  expect(discardGeo).not.toHaveBeenCalled();expect(discardSkin).not.toHaveBeenCalled();geo.dispose();skin.dispose();
 });
});
