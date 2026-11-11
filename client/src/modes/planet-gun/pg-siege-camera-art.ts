import * as THREE from "three";

interface Point { x: number; y: number; z: number }
interface CameraSite { id: string; name: string; position: Point; target: Point }
interface CameraStatus { id: string; hp: number; maxHp: number; disabled: boolean }

/** The anchor is the optical face. Local +Z points into the surveillance view. */
export function createPgSiegeCameraArt(cameras: readonly CameraSite[]) {
  const root = new THREE.Group();
  root.name = "pg-siege-camera-art";
  const box = new THREE.BoxGeometry(), barrel = new THREE.CylinderGeometry(1, 1, 1, 16);
  barrel.rotateX(Math.PI / 2);
  const casing = new THREE.MeshStandardMaterial({color: 0xb7c9ca, metalness: .38, roughness: .57});
  const graphite = new THREE.MeshStandardMaterial({color: 0x263945, metalness: .34, roughness: .54});
  const lenses = {
    live: new THREE.MeshBasicMaterial({color: 0x6cebd7}),
    damaged: new THREE.MeshBasicMaterial({color: 0xffb46b}),
    jammed: new THREE.MeshBasicMaterial({color: 0xc99cff}),
    destroyed: new THREE.MeshStandardMaterial({color: 0x202730, roughness: .94}),
  };
  const sites = cameras.slice(0, 2).map(site => {
    const group = new THREE.Group();
    group.name = site.id;
    group.position.copy(site.position);
    group.lookAt(site.target.x, site.target.y, site.target.z);
    group.visible = false;
    root.add(group);
    function part(name: string, shape: THREE.BufferGeometry, material: THREE.Material, size: number[], position: number[]) {
      const mesh = new THREE.Mesh(shape, material);
      mesh.name = name;
      mesh.scale.set(size[0], size[1], size[2]);
      mesh.position.set(position[0], position[1], position[2]);
      group.add(mesh);
      return mesh;
    }
    part("mount-plate", box, graphite, [.35, .45, .06], [0, .1, -.86]);
    part("mount-arm", box, casing, [.11, .1, .32], [0, .1, -.68]);
    const hood = part("weather-hood", box, casing, [.47, .25, .48], [0, .035, -.36]);
    part("lens-collar", barrel, graphite, [.14, .14, .19], [0, 0, -.105]);
    const lens = part("lens", barrel, lenses.live, [.098, .098, .02], [0, 0, -.01]);
    const lamp = part("status-strip", box, lenses.live, [.055, .025, .013], [.176, .087, -.113]);
    return {id: site.id, group, hood, lens, lamp};
  });
  let disposed = false;
  return {
    root,
    update(states: readonly CameraStatus[] | null) {
      if (disposed) return;
      for (const {id, group, hood, lens, lamp} of sites) {
        const state = states?.find(entry => entry.id === id);
        group.visible = !!state;
        if (!state) continue;
        const signal = state.hp <= 0 ? "destroyed" : state.disabled ? "jammed" : state.hp < state.maxHp ? "damaged" : "live";
        lens.material = lamp.material = lenses[signal];
        hood.material = signal === "destroyed" ? graphite : casing;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent(); root.clear();
      box.dispose(); barrel.dispose(); casing.dispose(); graphite.dispose();
      Object.values(lenses).forEach(material => material.dispose());
    },
  };
}
