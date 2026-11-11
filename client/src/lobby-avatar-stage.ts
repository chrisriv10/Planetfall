import {applyAstronautSuitFinish} from "./astronaut-suit-finish";
import * as THREE from 'three';
import { SHOP_CATALOG, type EmoteType } from '@planetfall/shared';
import { createAstronautVisual, type AstronautVisual } from './astronaut';
import { applyCosmeticEmotePose } from './cosmetic-pose';

export type LobbyAvatarMember = {
  id: string; name: string; color: string; ready: boolean; isBot: boolean;
  equippedCosmetics: { suit: string };
};
type Entry = { member: LobbyAvatarMember; holder: THREE.Group; astronaut: AstronautVisual; ring: THREE.MeshBasicMaterial; emote?: { type: EmoteType; start: number } };

/** A bounded, camera-relative foreground tableau. Caller owns visibility and scene attachment. */
export function createLobbyAvatarStage() {
  const root = new THREE.Group(); root.name = 'lobby-avatar-stage';
  const composition = new THREE.Group(); composition.rotation.x = .09; root.add(composition);
  const entries = new Map<string, Entry>();
  const platformGeometry = new THREE.CylinderGeometry(1.02, 1.1, .14, 24);
  const ringGeometry = new THREE.TorusGeometry(.91, .018, 4, 32);
  const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x263556, roughness: .65, metalness: .35 });
  const bounds = new THREE.Box3(), center = new THREE.Vector3(), size = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3(), cameraRotation = new THREE.Quaternion();
  const offset = new THREE.Vector3();
  let disposed = false, visibleCount = -1;

  function release(entry: Entry) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    entry.astronaut.group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    entry.ring.dispose(); entry.holder.removeFromParent();
  }

  function setMembers(members: readonly LobbyAvatarMember[], localId: string) {
    if (disposed) return;
    const local = members.find(member => member.id === localId);
    // Local plus two human companions; never construct the full room roster.
    const selected = local ? [local] : [];
    for (const member of members) {
      if (!local || selected.length >= 3) break;
      if (!member.isBot && member.id !== localId && !selected.some(item => item.id === member.id)) selected.push(member);
    }
    for (const [id, entry] of entries) if (!selected.some(member => member.id === id)) { release(entry); entries.delete(id); }
    const ordered: Entry[] = [];
    for (const member of selected) {
      let entry = entries.get(member.id);
      const suit = SHOP_CATALOG.find(item => item.id === member.equippedCosmetics.suit && item.category === 'suit')?.color ?? member.color;
      if (!entry) {
        const astronaut = createAstronautVisual({ identityColor: member.color, suitAccent: suit, isBot: member.isBot });
        astronaut.group.position.y = .36; // Canonical soles at -.29 meet the deck at +.07.
        const holder = new THREE.Group(); holder.name = `lobby-avatar:${member.id}`;
        const platform = new THREE.Mesh(platformGeometry, platformMaterial);
        const ring = new THREE.MeshBasicMaterial({ color: 0x70f5ff });
        const indicator = new THREE.Mesh(ringGeometry, ring); indicator.rotation.x = Math.PI / 2; indicator.position.y = .078;
        holder.add(platform, indicator, astronaut.group); composition.add(holder);
        entry = { member: { ...member, equippedCosmetics: { ...member.equippedCosmetics } }, holder, astronaut, ring };
        entries.set(member.id, entry);
      }
      if (entry.member.color !== member.color) {
        const previous = new THREE.Color(entry.member.color);
        entry.astronaut.group.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (material instanceof THREE.MeshStandardMaterial && material.emissiveIntensity === .75) {
              material.color.set(member.color); material.emissive.set(member.color);
            } else if (material instanceof THREE.MeshBasicMaterial && material.color.equals(previous)) material.color.set(member.color);
          }
        });
      }
      entry.astronaut.suitMaterial.color.set(suit);applyAstronautSuitFinish(entry.astronaut,SHOP_CATALOG.find(item=>item.id===member.equippedCosmetics.suit)?.suitStyle??null);
      entry.ring.color.set(member.ready ? 0x70f5be : 0x7283a6);
      entry.member = { ...member, equippedCosmetics: { ...member.equippedCosmetics } };
      ordered.push(entry);
    }
    entries.clear(); for (const entry of ordered) entries.set(entry.member.id, entry);
    visibleCount = -1;
  }

  function playEmote(id: string, emote: EmoteType, startedAtSeconds: number) {
    if (disposed || !Number.isFinite(startedAtSeconds)) return;
    const entry = entries.get(id);
    if (entry) entry.emote = { type: emote, start: startedAtSeconds };
  }

  function update(camera: THREE.PerspectiveCamera, viewport: { width: number; height: number; panelLeft: number; panelTop: number; footerTop?: number }, timeSeconds: number, quality: 'low' | 'medium' | 'high', reducedMotion: boolean) {
    if (disposed || entries.size === 0) return;
    const narrow = viewport.width <= 900;
    const count = Math.min(entries.size, narrow || quality === 'low' ? 1 : quality === 'medium' ? 2 : 3);
    let index = 0;
    for (const entry of entries.values()) {
      entry.holder.visible = index < count;
      entry.holder.position.set(index === 0 ? 0 : index === 1 ? -1.85 : 1.85, 0, index === 0 ? .2 : -.25);
      entry.holder.scale.setScalar(index === 0 ? 1 : .82);
      for (const detail of entry.astronaut.lodDetails) detail.visible = quality === 'high' && index === 0;
      entry.astronaut.leftArm.rotation.set(0, 0, .17);
      entry.astronaut.rightArm.rotation.set(0, 0, -.17);
      entry.astronaut.torso.rotation.set(0, 0, 0);
      entry.astronaut.torso.position.set(0, .72, 0);
      // Feet and lower body stay fixed; only the head and arms breathe.
      entry.astronaut.helmet.rotation.z = reducedMotion ? 0 : Math.sin(timeSeconds * .8 + index) * .012;
      entry.astronaut.leftArm.rotation.z = .17 + (reducedMotion ? 0 : Math.sin(timeSeconds + index) * .012);
      entry.astronaut.rightArm.rotation.z = -.17 - (reducedMotion ? 0 : Math.sin(timeSeconds + index) * .012);
      if (entry.emote) {
        const age = timeSeconds - entry.emote.start;
        const duration = entry.emote.type === 'celebrate' || entry.emote.type === 'panic' ? 1.7 : 1.35;
        if (age >= duration) entry.emote = undefined;
        else if (age >= 0 && !reducedMotion) applyCosmeticEmotePose(entry.astronaut, entry.emote.type, age * 1000);
      }
      index++;
    }
    if (visibleCount !== count) {
      // Conservative fixed envelope includes antenna, deck, tilt and idle motion.
      bounds.min.set(count === 1 ? -1.15 : -2.8, -.2, -1.35);
      bounds.max.set(count === 3 ? 2.8 : 1.15, 2.55, 1.35);
      bounds.getCenter(center); bounds.getSize(size); composition.position.copy(center).negate();
      visibleCount = count;
    }
    const width = Math.max(1, viewport.width), height = Math.max(1, viewport.height);
    // A short landscape viewport still uses a sidebar. Read its actual position
    // independently of the width-based avatar quality budget.
    const stacked = narrow && viewport.panelTop > height * .15;
    // On stacked layouts the upper-left belongs to the lobby heading and copy.
    const availableLeft = stacked ? width * .5 : 0;
    const availableWidth = stacked ? width * .48 : Math.max(1, Math.min(width, viewport.panelLeft));
    const footerLimit = Math.max(1, Math.min(height, viewport.footerTop ?? height));
    const availableHeight = stacked ? Math.max(1, Math.min(footerLimit, viewport.panelTop)) : footerLimit;
    const safeWidth = Math.max(1, availableWidth - (stacked ? 24 : 64)), safeHeight = Math.max(1, availableHeight - (stacked ? 32 : 100));
    const distance = Math.max(6, camera.near * 4);
    const focal = height * camera.projectionMatrix.elements[5] / 2;
    // Include perspective depth expansion and reserve margins for the off-axis placement.
    const scale = .88 * Math.min(safeWidth * distance / (focal * size.x + safeWidth * size.z / 2), safeHeight * distance / (focal * size.y + safeHeight * size.z / 2));
    camera.getWorldPosition(cameraPosition); camera.getWorldQuaternion(cameraRotation);
    offset.set(((availableLeft * 2 + availableWidth) / width - 1) * distance / camera.projectionMatrix.elements[0], (1 - availableHeight / height) * distance / camera.projectionMatrix.elements[5], -distance);
    root.position.copy(offset.applyQuaternion(cameraRotation)).add(cameraPosition);
    root.quaternion.copy(cameraRotation); root.scale.setScalar(scale);
  }

  function dispose() {
    if (disposed) return; disposed = true;
    entries.forEach(release); entries.clear();
    platformGeometry.dispose(); ringGeometry.dispose(); platformMaterial.dispose();
    root.removeFromParent(); root.clear();
  }
  return { root, setMembers, playEmote, update, dispose };
}
