import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createLobbyAvatarStage, type LobbyAvatarMember } from './lobby-avatar-stage';

function members(count = 40): LobbyAvatarMember[] {
  return Array.from({ length: count }, (_, i) => ({ id: `${i}`, name: `Pilot ${i}`, color: '#70f5ff', ready: i === 0, isBot: i > 5, equippedCosmetics: { suit: 'solar-gold' } }));
}
function camera(width: number, height: number) {
  const result = new THREE.PerspectiveCamera(55, width / height, .1, 200);
  result.position.set(20, 14, -12); result.lookAt(0, 0, 0); result.updateMatrixWorld(true);
  return result;
}

describe('lobby avatar stage', () => {
  it('bounds construction, copies input and preserves stable rigs on room updates', () => {
    const stage = createLobbyAvatarStage(), input = members();
    stage.setMembers(input, '0');
    const holders = [...stage.root.children[0].children];
    expect(holders).toHaveLength(3);
    stage.setMembers(input.map(member => ({ ...member, ready: true })), '0');
    expect(stage.root.children[0].children).toEqual(holders);
    const suits: THREE.MeshStandardMaterial[] = [];
    stage.root.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && object.material.color.getHexString() === 'ffd84d') suits.push(object.material);
    });
    expect(suits.length).toBeGreaterThan(0);
    input[0].equippedCosmetics.suit = 'ice-blue';
    expect(suits[0].color.getHexString()).toBe('ffd84d');
    stage.dispose();
  });

  it.each([[1920, 1080], [1366, 768], [864, 540], [390, 844], [3440, 1440]])('keeps visible geometry inside the available UI rectangle at %sx%s', (width, height) => {
    const stage = createLobbyAvatarStage(); stage.setMembers(members(), '0');
    const view = { width, height, panelLeft: width - 520, panelTop: height * .36 };
    const lens = camera(width, height);
    stage.update(lens, view, 10, 'high', false); stage.root.updateMatrixWorld(true);
    const point = new THREE.Vector3();
    const limitX = width <= 900 ? width : view.panelLeft;
    const limitY = width <= 900 ? view.panelTop : height;
    stage.root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.getAttribute('position');
      // Instanced eyes sit well inside the helmet; base mesh positions still bound their tiny geometry.
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(lens);
        const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2;
        expect(x).toBeGreaterThan(8); expect(x).toBeLessThan(limitX - 8);
        expect(y).toBeGreaterThan(8); expect(y).toBeLessThan(limitY - 8);
        expect(point.z).toBeGreaterThan(-1); expect(point.z).toBeLessThan(1);
      }
    });
    stage.dispose();
  });

  it('uses one avatar on low quality and freezes idle for reduced motion', () => {
    const stage = createLobbyAvatarStage(); stage.setMembers(members(), '0');
    const view = { width: 1920, height: 1080, panelLeft: 1400, panelTop: 0 }, lens = camera(1920, 1080);
    stage.update(lens, view, 1, 'low', true);
    expect(stage.root.children[0].children.filter(child => child.visible)).toHaveLength(1);
    const transforms: number[] = [];
    stage.root.traverse(object => transforms.push(...object.position.toArray(), ...object.quaternion.toArray()));
    stage.update(lens, view, 40, 'low', true);
    const next: number[] = [];
    stage.root.traverse(object => next.push(...object.position.toArray(), ...object.quaternion.toArray()));
    expect(next).toEqual(transforms); stage.dispose();
  });

  it.each([
    { width: 1366, height: 768, panelLeft: 846, panelTop: 12, footerTop: 600, minX: 8, maxX: 838, maxY: 584, minBodyHeight: 160 },
    { width: 864, height: 540, panelLeft: 420, panelTop: 12, minX: 8, maxX: 412, maxY: 532, minBodyHeight: 160 },
    { width: 390, height: 844, panelLeft: 12, panelTop: 304, minX: 195, maxX: 382, maxY: 296, minBodyHeight: 100 },
  ])('reserves the correct avatar rectangle for $width x $height', view => {
    const stage = createLobbyAvatarStage(); stage.setMembers(members(), '0');
    const lens = camera(view.width, view.height);
    stage.update(lens, view, 0, 'high', true); stage.root.updateMatrixWorld(true);
    expect(stage.root.children[0].children.filter(child => child.visible)).toHaveLength(view.width <= 900 ? 1 : 3);
    let minY = Infinity, maxY = -Infinity;
    const point = new THREE.Vector3();
    stage.root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(lens);
        const x = (point.x + 1) * view.width / 2, y = (1 - point.y) * view.height / 2;
        expect(x).toBeGreaterThan(view.minX); expect(x).toBeLessThan(view.maxX);
        expect(y).toBeGreaterThan(8); expect(y).toBeLessThan(view.maxY);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    });
    expect(maxY - minY).toBeGreaterThan(view.minBodyHeight);
    stage.dispose();
  });

  it('disposes every owned geometry and material exactly once, including shared resources', () => {
    const stage = createLobbyAvatarStage(); stage.setMembers(members(), '0');
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    stage.root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
    });
    const counts = new Map<object, number>();
    for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) ?? 0) + 1));
    stage.setMembers([], '0'); stage.dispose(); stage.dispose();
    expect(counts.size).toBe(resources.size);
    expect([...counts.values()].every(count => count === 1)).toBe(true);
    expect(stage.root.children).toHaveLength(0);
  });

  it.each(['wave', 'celebrate', 'panic'] as const)('expires %s poses without drift or moving feet', emote => {
    const stage = createLobbyAvatarStage(); stage.setMembers(members(1), '0');
    const view = { width: 1920, height: 1080, panelLeft: 1400, panelTop: 0 }, lens = camera(1920, 1080);
    const astronaut = stage.root.children[0].children[0].children[2];
    const upper = astronaut.children[0], torso = upper.children[0], rightArm = upper.children[7];
    const feetBefore = astronaut.children.slice(1).map(leg => leg.toJSON());
    stage.playEmote('0', emote, 10);
    stage.update(lens, view, 10.12, 'high', false);
    expect(rightArm.rotation.x).not.toBe(0);
    const firstY = torso.position.y, firstRotation = rightArm.rotation.toArray();
    for (let i = 0; i < 50; i++) stage.update(lens, view, 10.12, 'high', false);
    expect(torso.position.y).toBe(firstY);
    expect(rightArm.rotation.toArray()).toEqual(firstRotation);
    // Celebrate/panic retain the existing longer duration.
    stage.update(lens, view, 11.4, 'high', false);
    expect(rightArm.rotation.x === 0).toBe(emote === 'wave');
    stage.update(lens, view, 12, 'high', false);
    expect(rightArm.rotation.x).toBe(0); expect(torso.position.y).toBe(.72);
    expect(torso.rotation.z).toBe(0);
    expect(astronaut.children.slice(1).map(leg => leg.toJSON())).toEqual(feetBefore);
    stage.dispose();
  });

  it('disables emote movement with reduced motion and safely ignores absent identities', () => {
    const stage = createLobbyAvatarStage(); stage.setMembers(members(1), '0');
    const view = { width: 1920, height: 1080, panelLeft: 1400, panelTop: 0 }, lens = camera(1920, 1080);
    stage.update(lens, view, 0, 'high', true);
    const snapshot = () => {
      const values: number[] = [];
      stage.root.traverse(object => values.push(...object.position.toArray(), ...object.quaternion.toArray()));
      return values;
    };
    const idle = snapshot();
    stage.playEmote('absent', 'panic', 0);
    stage.playEmote('0', 'celebrate', 0);
    stage.update(lens, view, .4, 'high', true); expect(snapshot()).toEqual(idle);
    stage.update(lens, view, 2, 'high', true); expect(snapshot()).toEqual(idle);
    stage.dispose();
  });
});
