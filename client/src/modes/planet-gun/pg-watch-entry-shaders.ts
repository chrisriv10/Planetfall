import * as THREE from "three";
import {createAstronautVisual} from "../../astronaut";

type Program = {isReady(): boolean; getUniforms(): unknown};
type Pass = {scene: THREE.Scene; camera: THREE.Camera};
type WeaponSources = {
  receiver: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null;
  cellRing: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null;
};

// Cold captures linked these objects on the first countdown draw. A sign
// represents the shared canvas-textured sign variant; positions are immaterial.
const COUNTDOWN_WORLD = [
  "planet-gun-far-torso", "planet-gun-far-equipment", "planet-gun-far-identity",
  "neighborhood-planet", "orbital-structural-silhouettes", "neighborhood-stars",
  "district-sign:SOLAR / HABITAT 01", "planet-atmospheric-limb"
];
const COUNTDOWN_VIEW = ["stock-cheek-inlay", "astronaut-sleeve"];

/** These variants were first linked by the pilot batch rebuild, relay, and
 * starting weapon at Watch match entry. They use the same objects' geometry
 * and material flags, including the canonical visor's shader hook. */
export function createPgWatchEntryShaders(relay: readonly THREE.Object3D[], weapons: WeaponSources, nameplate?: THREE.Sprite) {
  const worldProbes = new THREE.Group();
  const viewProbes = new THREE.Group();
  const ownedMaterials = new Set<THREE.Material>();
  const ownedGeometry = new Set<THREE.BufferGeometry>();
  const pilot = createAstronautVisual({identityColor: "#ffb45c", suitAccent: "#ffb45c", isBot: false});

  function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, name: string): void {
    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    mesh.setColorAt(0, new THREE.Color(0xffffff));
    mesh.name = name;
    worldProbes.add(mesh);
    ownedMaterials.add(material);
  }

  // Keep the pilot variants alive when the countdown batches are released and
  // replaced with the actual hero batches. No probe is rendered.
  function pilotProbe(geometry: THREE.BufferGeometry, material: THREE.Material, name: string): void {
    ownedGeometry.add(geometry);
    instanced(geometry, material, name);
  }
  pilotProbe(pilot.torso.geometry, pilot.suitMaterial, "watch-entry-pilot-armor");
  pilotProbe(pilot.visor.geometry, pilot.visor.material, "watch-entry-pilot-visor");
  const eyes = pilot.helmet.getObjectByName("astronaut-eyes");
  if (eyes instanceof THREE.InstancedMesh && eyes.material instanceof THREE.MeshBasicMaterial) {
    pilotProbe(eyes.geometry, eyes.material, "watch-entry-pilot-eyes");
  }
  // A canonical rig supplies the real shader materials. Release its unused
  // resources immediately and keep only the geometry referenced by the probes.
  const unusedMaterials = new Set<THREE.Material>();
  const unusedGeometry = new Set<THREE.BufferGeometry>();
  pilot.group.traverse(object => {
    if (object instanceof THREE.InstancedMesh) object.dispose();
    if (!(object instanceof THREE.Mesh)) return;
    if (!ownedGeometry.has(object.geometry)) unusedGeometry.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!ownedMaterials.has(material)) unusedMaterials.add(material);
    }
  });
  for (const material of unusedMaterials) material.dispose();
  for (const geometry of unusedGeometry) geometry.dispose();

  if (weapons.receiver) {
    instanced(weapons.receiver.geometry, weapons.receiver.material.clone(), "watch-entry-weapon-receiver");
  }
  if (weapons.cellRing) {
    const material = weapons.cellRing.material.clone();
    ownedMaterials.add(material);
    const ring = new THREE.Mesh(weapons.cellRing.geometry, material);
    ring.name = "watch-entry-weapon-cell-ring";
    worldProbes.add(ring);
    const viewRing = new THREE.Mesh(weapons.cellRing.geometry, weapons.cellRing.material);
    viewRing.name = "watch-entry-viewmodel-cell-ring";
    viewProbes.add(viewRing);
  }
  // The relay ring has two render passes for its transparent double side.
  for (const object of relay) worldProbes.add(object.clone(false));
  if (nameplate) {
    const material = nameplate.material.clone();
    ownedMaterials.add(material);
    const sprite = new THREE.Sprite(material);
    sprite.name = "watch-entry-friendly-nameplate";
    worldProbes.add(sprite);
  }

  return {
    async prepare(renderer: THREE.WebGLRenderer, world: Pass, view: Pass, signal: AbortSignal): Promise<void> {
      const deadline = performance.now() + 1_250;
      const context = renderer.getContext();
      const check = () => {
        signal.throwIfAborted();
        if (context.isContextLost()) throw new Error("WebGL context lost during shader preparation");
        if (performance.now() >= deadline) throw new Error("Shader preparation exceeded its loading budget");
      };
      const nextFrame = async () => {
        await new Promise<number>(resolve => requestAnimationFrame(resolve));
        check();
      };
      const programs = new Set<Program>();
      const compile = (objects: THREE.Group, pass: Pass) => {
        for (const material of renderer.compile(objects, pass.camera, pass.scene)) {
          // Three r185 compileAsync only waits on currentProgram. A double-sided
          // transparent mesh also needs its other face variant and reflection.
          const properties = renderer.properties.get(material) as {programs?: Map<string, Program>};
          if (!properties.programs?.size) throw new Error("Three did not prepare a Watch entry program");
          for (const program of properties.programs.values()) programs.add(program);
        }
      };
      const compileCountdown = async (pass: Pass, names: readonly string[]) => {
        const probes = new THREE.Group();
        try {
          for (const name of names) {
            const source = pass.scene.getObjectByName(name);
            if (source) probes.add(source.clone(false));
          }
          if (probes.children.length) {
            await nextFrame();
            compile(probes, pass);
          }
        } finally {
          for (const probe of probes.children) if (probe instanceof THREE.InstancedMesh) probe.dispose();
          probes.clear();
        }
      };
      await nextFrame();
      compile(worldProbes, world);
      compile(viewProbes, view);
      await compileCountdown(world, COUNTDOWN_WORLD.slice(0, 3));
      await compileCountdown(world, COUNTDOWN_WORLD.slice(3));
      await compileCountdown(view, COUNTDOWN_VIEW);
      // The readiness queries use KHR_parallel_shader_compile when available.
      // Separate first-use reflection across frames even on synchronous drivers.
      while (programs.size) {
        await nextFrame();
        for (const program of programs) {
          if (!program.isReady()) continue;
          program.getUniforms();
          programs.delete(program);
          break;
        }
      }
    },
    dispose(): void {
      for (const object of worldProbes.children) if (object instanceof THREE.InstancedMesh) object.dispose();
      for (const material of ownedMaterials) material.dispose();
      for (const geometry of ownedGeometry) geometry.dispose();
      worldProbes.clear();
      viewProbes.clear();
    }
  };
}
