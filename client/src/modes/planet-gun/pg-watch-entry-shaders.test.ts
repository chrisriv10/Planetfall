import * as THREE from "three";
import {afterEach, describe, expect, it, vi} from "vitest";
import {createPgWatchEntryShaders} from "./pg-watch-entry-shaders";

afterEach(() => vi.unstubAllGlobals());

describe("PlanetWatch entry shader preparation", () => {
  it("compiles the two actual lighting passes and primes both relay faces on separate frames", async () => {
    let frame = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      setTimeout(() => callback(++frame), 0));
    const geometry = new THREE.BoxGeometry();
    const relayMaterial = new THREE.MeshBasicMaterial({transparent: true, side: THREE.DoubleSide});
    const cellMaterial = new THREE.MeshBasicMaterial({transparent: true});
    const relayParent = new THREE.Group();
    const relay = new THREE.Mesh(geometry, relayMaterial);
    const cellRing = new THREE.Mesh(geometry, cellMaterial);
    const farPilot = new THREE.InstancedMesh(geometry, relayMaterial, 1);
    farPilot.name = "planet-gun-far-torso";
    const unrelated = new THREE.Mesh(geometry, cellMaterial);
    unrelated.name = "unrelated";
    relayParent.visible = false;
    relayParent.add(relay);
    const world = {scene: new THREE.Scene(), camera: new THREE.Camera()};
    const view = {scene: new THREE.Scene(), camera: new THREE.Camera()};
    world.scene.add(farPilot, unrelated);
    const reflected: number[] = [];
    let backQueries = 0;
    const front = {isReady: () => true, getUniforms: () => reflected.push(frame)};
    const back = {isReady: () => ++backQueries > 2, getUniforms: () => reflected.push(frame)};
    const compile = vi.fn((probes: THREE.Group, _camera: THREE.Camera, scene: THREE.Scene) => {
      expect(probes.parent).toBeNull();
      expect(probes.children).toContainEqual(expect.objectContaining({
        material: scene === world.scene ? relayMaterial : cellMaterial
      }));
      expect(probes.children).not.toContainEqual(expect.objectContaining({name: unrelated.name}));
      return scene === world.scene ? new Set([relayMaterial]) : new Set([cellMaterial]);
    });
    const renderer = {
      getContext: () => ({isContextLost: () => false}),
      compile,
      properties: {get: (material: THREE.Material) => ({
        programs: new Map(material === relayMaterial ? [["front", front], ["back", back]] : [["front", front]])
      })}
    } as unknown as THREE.WebGLRenderer;
    const disposeBorrowed = vi.spyOn(relayMaterial, "dispose");
    const shaders = createPgWatchEntryShaders([relay], {receiver: null, cellRing});
    try {
      await shaders.prepare(renderer, world, view, new AbortController().signal);
      expect(compile.mock.calls.map(([, camera, scene]) => [camera, scene]))
        .toEqual([[world.camera, world.scene], [view.camera, view.scene], [world.camera, world.scene]]);
      expect(reflected).toHaveLength(2);
      expect(reflected[1]).toBeGreaterThan(reflected[0]);
      expect(relay.parent).toBe(relayParent);
      expect(relayParent.visible).toBe(false);
      expect(farPilot.parent).toBe(world.scene);
    } finally {
      shaders.dispose();
    }
    expect(disposeBorrowed).not.toHaveBeenCalled();
    farPilot.dispose();
    geometry.dispose();
    relayMaterial.dispose();
    cellMaterial.dispose();
  });

  it("cancels before touching the renderer when match entry is abandoned", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      queueMicrotask(() => callback(performance.now()));
      return 1;
    });
    const abort = new AbortController();
    const compile = vi.fn();
    const renderer = {getContext: () => ({isContextLost: () => false}), compile} as unknown as THREE.WebGLRenderer;
    const shaders = createPgWatchEntryShaders([], {receiver: null, cellRing: null});
    const pass = {scene: new THREE.Scene(), camera: new THREE.Camera()};
    const preparation = shaders.prepare(renderer, pass, pass, abort.signal);
    abort.abort();
    shaders.dispose();
    await expect(preparation).rejects.toMatchObject({name: "AbortError"});
    expect(compile).not.toHaveBeenCalled();
  });

  it("bounds the wait when a driver never reports completion", async () => {
    let frameTime = 0;
    vi.stubGlobal("performance", {now: () => frameTime});
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      queueMicrotask(() => callback(frameTime += 100));
      return 1;
    });
    const material = new THREE.MeshBasicMaterial();
    const getUniforms = vi.fn();
    const renderer = {
      getContext: () => ({isContextLost: () => false}),
      compile: () => new Set([material]),
      properties: {get: () => ({programs: new Map([["pending", {isReady: () => false, getUniforms}]])})}
    } as unknown as THREE.WebGLRenderer;
    const shaders = createPgWatchEntryShaders([], {receiver: null, cellRing: null});
    const pass = {scene: new THREE.Scene(), camera: new THREE.Camera()};
    try {
      await expect(shaders.prepare(renderer, pass, pass, new AbortController().signal))
        .rejects.toThrow("exceeded its loading budget");
      expect(getUniforms).not.toHaveBeenCalled();
    } finally {
      shaders.dispose();
      material.dispose();
    }
  });
});
