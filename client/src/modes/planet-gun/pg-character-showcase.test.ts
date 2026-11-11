import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PG_HEROES, PG_OPERATORS } from '@planetfall/shared';
import { createPgCharacterShowcase } from './pg-character-showcase';

const region = { viewportWidth: 1366, viewportHeight: 768, left: 680, top: 80, width: 550, height: 570 };
function camera() {
  const camera = new THREE.PerspectiveCamera(76, 1366 / 768, .05, 500);
  camera.position.set(-12, 4, 25); camera.lookAt(-40, 14, 5); camera.updateMatrixWorld(true); return camera;
}
const selection = { characterId: 'cairn', primary: 'photon' as const, color: '#70f5ff', suit: 'solar-gold' };

describe('canonical character showcase', () => {
  it('frames every canonical hero and operator with identity intact at low quality', () => {
    const showcase = createPgCharacterShowcase(), lens = camera();
    const point = new THREE.Vector3(), box = new THREE.Box3();
    for (const character of [...Object.values(PG_HEROES), ...Object.values(PG_OPERATORS)]) {
      showcase.setSelection({ ...selection, characterId: character.id, primary: character.primaryChoices[0] });
      showcase.update(lens, region, 3, 'low', false); showcase.root.updateMatrixWorld(true);
      let identity = 0;
      showcase.root.traverseVisible(object => {
        if (object.name === `pg-identity-${character.id}`) identity++;
        if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox(); box.copy(object.geometry.boundingBox!);
        for(let i=0;i<8;i++){
          point.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).applyMatrix4(object.matrixWorld).project(lens);
          const x=(point.x+1)*region.viewportWidth/2,y=(1-point.y)*region.viewportHeight/2;
          expect(x).toBeGreaterThan(region.left+8); expect(x).toBeLessThan(region.left+region.width-8);
          expect(y).toBeGreaterThan(region.top+8); expect(y).toBeLessThan(region.top+region.height-8);
          expect(Number.isFinite(point.z)).toBe(true);
        }
      });
      expect(identity).toBeGreaterThan(0);
      expect(showcase.root.getObjectByName('astronaut-eyes')).toBeDefined();
    }
    showcase.dispose();
  });

  it('caches the rig, decoration and weapons across unchanged selection and restores prior identity', () => {
    const showcase = createPgCharacterShowcase();showcase.setSelection(selection);
    const rig = showcase.root.getObjectByName('pg-showcase-astronaut'), art = showcase.root.getObjectByName('pg-identity-cairn');
    const weapon = showcase.root.getObjectByName('br-weapon-photon-shotgun');
    const eye = showcase.root.getObjectByName('astronaut-eyes');
    for(let i=0;i<30;i++)showcase.setSelection({...selection,color:'#ffd84d'});
    expect(showcase.root.getObjectByName('pg-identity-cairn')).toBe(art);expect(showcase.root.getObjectByName('br-weapon-photon-shotgun')).toBe(weapon);
    showcase.setSelection({...selection,characterId:'lumen'});
    expect(showcase.root.getObjectByName('pg-identity-cairn')).toBeUndefined();expect(showcase.root.getObjectByName('pg-identity-lumen')).toBeDefined();
    expect(showcase.root.getObjectByName('pg-showcase-astronaut')).toBe(rig);expect(showcase.root.getObjectByName('astronaut-eyes')).toBe(eye);
    showcase.setSelection(selection);expect(showcase.root.getObjectByName('pg-identity-lumen')).toBeUndefined();showcase.dispose();
  });

  it('keeps reduced motion static and feet fixed during idle', () => {
    const showcase=createPgCharacterShowcase(),lens=camera();showcase.setSelection(selection);
    const transforms=()=>{const list:number[]=[];showcase.root.traverse(object=>list.push(...object.position.toArray(),...object.quaternion.toArray()));return list;};
    showcase.update(lens,region,0,'high',true);const first=transforms();
    showcase.update(lens,region,100,'high',true);expect(transforms()).toEqual(first);
    const rig=showcase.root.getObjectByName('pg-showcase-astronaut')!;
    const legs=rig.children.filter(child=>child instanceof THREE.Group&&child.name!=='planet-gun-pilot-posture');
    const feet=legs.map(leg=>leg.position.clone());
    showcase.update(lens,region,3,'high',false);expect(legs.map(leg=>leg.position)).toEqual(feet);showcase.dispose();
  });

  it('measures hidden selectors and holds the canonical weapon below the face', () => {
    const showcase=createPgCharacterShowcase();showcase.root.visible=false;
    showcase.setSelection(selection);showcase.root.updateMatrixWorld(true);
    const weapon=showcase.root.getObjectByName('planet-gun-held-weapon')!;
    expect(new THREE.Box3().setFromObject(weapon).max.y).toBeLessThan(1.45);
    expect(showcase.root.visible).toBe(false);
    showcase.root.visible=true;showcase.update(camera(),region,0,'high',true);
    expect(showcase.root.scale.x).toBeGreaterThan(1);
    showcase.dispose();
  });

  it('does not dispose borrowed weapon resources while another showcase uses them', () => {
    const first=createPgCharacterShowcase(),second=createPgCharacterShowcase();first.setSelection(selection);second.setSelection(selection);
    const weapon=second.root.getObjectByName('br-weapon-photon-shotgun')!;
    const resources=new Set<THREE.BufferGeometry|THREE.Material>();
    weapon.traverse(object=>{if(object instanceof THREE.Mesh){resources.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])resources.add(material);}});
    const disposed=new Map<object,number>();for(const resource of resources)resource.addEventListener('dispose',()=>disposed.set(resource,(disposed.get(resource)??0)+1));
    first.dispose();first.dispose();expect(disposed.size).toBe(0);
    second.dispose();second.dispose();expect(disposed.size).toBe(resources.size);expect([...disposed.values()].every(value=>value===1)).toBe(true);
  });

  it('disposes original base resources exactly once after restoring character materials',()=>{
    const showcase=createPgCharacterShowcase(),resources=new Set<THREE.BufferGeometry|THREE.Material>();
    showcase.root.traverse(object=>{if(object instanceof THREE.Mesh){resources.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])resources.add(material);}});
    const disposed=new Map<object,number>();for(const resource of resources)resource.addEventListener('dispose',()=>disposed.set(resource,(disposed.get(resource)??0)+1));
    showcase.setSelection(selection);showcase.setSelection({...selection,characterId:'shroud',primary:'pulse'});showcase.dispose();showcase.dispose();
    expect(disposed.size).toBe(resources.size);expect([...disposed.values()].every(value=>value===1)).toBe(true);
  });
});
