import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {DEFAULT_COSMETICS,SHOP_CATALOG,type PrSnapshotPlayer} from '@planetfall/shared';
import {createPrWinnerStage} from './pr-winner-stage';

const player={id:'winner',color:'#123456',isBot:false,equippedCosmetics:{...DEFAULT_COSMETICS,suit:'solar-gold',victory:'spin'}} as PrSnapshotPlayer;
describe('canonical winner podium',()=>{
 it('reuses its winner, applies catalog suit and victory pose without creating lights',()=>{
  const stage=createPrWinnerStage();expect(stage.root.visible).toBe(false);stage.setWinner(player);const pilot=stage.root.children[1].children[0];expect(stage.root.visible).toBe(true);
  stage.setWinner({...player});expect(stage.root.children[1].children[0]).toBe(pilot);
  let lights=0,suit=false;stage.root.traverse(n=>{if(n instanceof THREE.Light)lights++;if(n instanceof THREE.Mesh&&!Array.isArray(n.material)&&n.material instanceof THREE.MeshStandardMaterial&&n.material.color.getHexString()===SHOP_CATALOG.find(i=>i.id==='solar-gold')!.color!.slice(1))suit=true;});expect(lights).toBe(0);expect(suit).toBe(true);
  stage.update(1000);const rotation=pilot.rotation.y;stage.update(2000);expect(pilot.rotation.y).not.toBe(rotation);
  stage.update(1000,true);const reduced=pilot.rotation.y;stage.update(2000,true);expect(pilot.rotation.y).toBe(reduced);stage.dispose();
 });
 it('disposes replaced astronauts and all podium resources once',()=>{
  const stage=createPrWinnerStage();stage.setWinner(player);const geometry=(stage.root.children[1].children[0].children.find(n=>n instanceof THREE.Mesh) as THREE.Mesh|undefined)?.geometry;
  // Canonical astronaut nests its meshes; find the first geometry through traversal.
  let first=geometry;stage.root.children[1].traverse(n=>{if(!first&&n instanceof THREE.Mesh)first=n.geometry;});const release=vi.spyOn(first!,'dispose');
  stage.setWinner(null);expect(release).toHaveBeenCalledTimes(1);expect(stage.root.visible).toBe(false);
  const base=stage.root.children[0].children[0] as THREE.Mesh,dispose=vi.spyOn(base.geometry,'dispose');stage.dispose();stage.dispose();expect(dispose).toHaveBeenCalledTimes(1);expect(stage.root.children.length).toBe(0);
 });
});
