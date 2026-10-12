import * as THREE from "three";
import { SHOP_CATALOG, type ShopItem } from "@planetfall/shared";
import { createAstronautVisual } from "./astronaut";
import { createVerityPlanetVisual, updateVerityPlanetVisual } from "./planet-cosmetics";
import { createCosmeticFlightTrail, updateCosmeticFlightTrail } from "./cosmetic-flight-trail";
import { applyCosmeticEmotePose, applyCosmeticVictoryPose } from "./cosmetic-pose";

export interface ShopCosmeticPreviewPlan {
  className: string; markup: string; kind: ShopItem["category"];
  motion: "idle" | "trail" | "emote" | "victory"; color: string;
}
const safeId = (id: string) => /^[a-z0-9-]+$/i.test(id) ? id.toLowerCase() : "cosmetic";
const previewColor = (item: Readonly<ShopItem>) => /^#[a-f\d]{6}$/i.test(item.color ?? "") ? item.color! : "#70f5ff";
const items = new WeakMap<HTMLElement, Readonly<ShopItem>>();

export function shopCosmeticPreviewPlan(item: Readonly<ShopItem>): ShopCosmeticPreviewPlan {
  return {
    className: `shop-cosmetic-preview cosmetic-kind-${item.category} cosmetic-item-${safeId(item.id)}`,
    markup: '<canvas class="cosmetic-preview-image" aria-hidden="true"></canvas>',
    kind: item.category, motion: item.category === "trail" || item.category === "emote" || item.category === "victory" ? item.category : "idle",
    color: previewColor(item)
  };
}

/** DOM construction is GPU-free. Mount the containing Shop/Pass grid after
 * insertion with mountShopCosmeticPreviews; both surfaces use the same API. */
export function createShopCosmeticPreview(item: Readonly<ShopItem>, owner: Document = document): HTMLElement {
  const plan = shopCosmeticPreviewPlan(item), element = owner.createElement("div");
  element.className = plan.className; element.innerHTML = plan.markup;
  element.dataset.previewKind = plan.kind; element.dataset.previewMotion = plan.motion;
  element.dataset.cosmeticId = item.id;
  element.style.setProperty("--item-color", plan.color); element.setAttribute("aria-hidden", "true");
  items.set(element, item);
  return element;
}

/** CPU-testable canonical scene. No renderer/context is constructed here. */
export function createCosmeticPreviewScene(item: Readonly<ShopItem>) {
  const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
  scene.add(new THREE.HemisphereLight(0xdaf6ff, 0x344265, 2.3));
  const key = new THREE.DirectionalLight(0xffffff, 3.1); key.position.set(-3, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x78ceff, 2); rim.position.set(4, 2, -3); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 40);
  const planet = item.category === "planet" ? createVerityPlanetVisual(1) : null;
  const astronaut = planet ? null : createAstronautVisual({ identityColor: "#70f5ff", suitAccent: item.category === "suit" ? previewColor(item) : "#70f5ff", isBot: false });
  if (planet) root.add(planet.group);
  if (astronaut) root.add(astronaut.group);
  const trail = item.category === "trail" ? createCosmeticFlightTrail(previewColor(item),item.id) : null;
  const points = Array.from({ length: 12 }, () => new THREE.Vector3());
  if (trail) root.add(trail);
  let disposed = false;
  const update = (now: number, aspect = 1, reducedMotion = false) => {
    const seconds = (reducedMotion ? 850 : now) / 1000;
    root.rotation.set(0, 0, 0); root.position.set(0, 0, 0);
    if (astronaut) {
      astronaut.group.rotation.set(0, -.28, 0); astronaut.group.position.set(0, 0, 0); astronaut.group.scale.setScalar(1);
      astronaut.torso.rotation.set(0, 0, 0); astronaut.torso.position.y = .72;
      for (const [index, limb] of [astronaut.leftArm, astronaut.rightArm, astronaut.leftLeg, astronaut.rightLeg].entries()) limb.rotation.set(0, 0, index < 2 ? (index ? -.17 : .17) : 0);
      if (item.emote) applyCosmeticEmotePose(astronaut, item.emote, seconds * 1000);
      if (item.category === "victory") astronaut.group.rotation.y += applyCosmeticVictoryPose(astronaut, item.id, seconds);
      if (trail) {
        astronaut.group.scale.setScalar(.58); astronaut.group.position.set(1.15, .18, 0); astronaut.group.rotation.set(0, 0, -.95);
        for (let i = 0; i < points.length; i++) points[i].set(.92 - i * .28, .34 + Math.sin(seconds * 3 - i * .32) * .17, -.12);
        updateCosmeticFlightTrail(trail, points);
      }
    }
    // Fixed camera envelope prevents animated limbs changing the framing.
    // Fit the full canonical model width as well as height on narrow Pass tiers.
    const height = planet ? 3.9 : trail ? 2.25 : 3.3;
    const width = planet ? 3.9 : trail ? 5.6 : 2.7;
    const distance = Math.max(height, width / Math.max(.25, aspect)) / (2 * Math.tan(THREE.MathUtils.degToRad(16)));
    camera.aspect = aspect; camera.position.set(0, planet ? .2 : .9, distance);
    camera.lookAt(0, planet ? 0 : .8, 0); camera.updateProjectionMatrix();
    if (planet) {
      updateVerityPlanetVisual(planet, camera);
      // Rotate the canonical spherical ink with its shell rather than keeping
      // a flat face permanently aimed at the card camera.
      planet.group.rotateY(Math.sin(seconds * .18) * .55);
    }
  };
  const dispose = () => {
    if (disposed) return; disposed = true;
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    root.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); scene.clear();
  };
  update(850);
  return { scene, camera, root, astronaut, planet, trail, update, dispose };
}

type PreviewScene = ReturnType<typeof createCosmeticPreviewScene>;
type Entry = { element: HTMLElement; canvas: HTMLCanvasElement; item: Readonly<ShopItem>; visible: boolean; dirty: boolean; visual?: PreviewScene };
const services = new WeakMap<Document, PreviewService>();
const mounts = new WeakMap<HTMLElement, () => void>();
const MAX_ACTIVE_PREVIEWS = 24;

/** One offscreen WebGL context copies into lightweight 2D card canvases.
 * Hidden cards release their scene; no per-card RAF/context or GPU cache. */
class PreviewService {
  private entries = new Map<HTMLElement, Entry>();
  private renderer?: THREE.WebGLRenderer;
  private frame = 0;
  private lastTime = 0;
  private failed = false;
  private readonly observer: IntersectionObserver;
  private readonly resize: ResizeObserver;
  private readonly motion: MediaQueryList;
  constructor(private owner: Document) {
    this.motion = owner.defaultView!.matchMedia("(prefers-reduced-motion: reduce)");
    this.observer = new IntersectionObserver(changes => {
      for (const change of changes) {
        const entry = this.entries.get(change.target as HTMLElement); if (!entry) continue;
        entry.visible = change.isIntersecting; entry.dirty = true;
        if (!entry.visible) { entry.visual?.dispose(); entry.visual = undefined; }
      }
      this.wake();
    });
    this.resize = new ResizeObserver(() => this.invalidate());
    this.motion.addEventListener("change", this.invalidate);
    owner.addEventListener("visibilitychange", this.invalidate);
  }
  private invalidate = () => { for (const entry of this.entries.values()) entry.dirty = true; this.wake(); };
  private wake = () => { if (!this.frame && !this.owner.hidden && !this.failed) this.frame = requestAnimationFrame(this.tick); };
  add(element: HTMLElement, item: Readonly<ShopItem>) {
    if (this.entries.has(element)) return;
    const canvas = element.querySelector<HTMLCanvasElement>("canvas"); if (!canvas) return;
    this.entries.set(element, { element, canvas, item, visible: false, dirty: true });
    this.observer.observe(element); this.resize.observe(element);
  }
  remove(element: HTMLElement) {
    const entry = this.entries.get(element); if (!entry) return;
    entry.visual?.dispose(); this.entries.delete(element);
    this.observer.unobserve(element); this.resize.unobserve(element);
    if (!this.entries.size) this.dispose();
  }
  private tick = (now: number) => {
    this.frame = 0;
    if (this.owner.hidden) return;
    if (now - this.lastTime < 1000 / 30) { this.wake(); return; }
    this.lastTime = now;
    let active = 0, animate = false;
    for (const entry of this.entries.values()) {
      if (!entry.element.isConnected) { this.remove(entry.element); continue; }
      if (!entry.visible || active >= MAX_ACTIVE_PREVIEWS) continue;
      active++;
      if (this.motion.matches && !entry.dirty) continue;
      const rect = entry.element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      try {
        if (!this.renderer) {
          this.renderer = new THREE.WebGLRenderer({ canvas: this.owner.createElement("canvas"), alpha: true, antialias: true, preserveDrawingBuffer: true });
          this.renderer.setPixelRatio(1); this.renderer.setClearColor(0, 0);
          this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        }
        const width = Math.min(512, Math.ceil(rect.width * Math.min(2, devicePixelRatio || 1)));
        const height = Math.min(384, Math.ceil(rect.height * Math.min(2, devicePixelRatio || 1)));
        entry.visual ??= createCosmeticPreviewScene(entry.item);
        entry.visual.update(now, rect.width / rect.height, this.motion.matches);
        this.renderer.setSize(width, height, false); this.renderer.render(entry.visual.scene, entry.visual.camera);
        if (entry.canvas.width !== width || entry.canvas.height !== height) { entry.canvas.width = width; entry.canvas.height = height; }
        const context = entry.canvas.getContext("2d");
        context?.clearRect(0, 0, width, height); context?.drawImage(this.renderer.domElement, 0, 0, width, height);
        entry.dirty = false; animate = !this.motion.matches;
      } catch {
        // Failed GPU initialization must not create an unbounded retry loop.
        this.failed = true; entry.element.dataset.previewUnavailable = "true"; break;
      }
    }
    if (animate) this.wake();
  };
  private dispose() {
    cancelAnimationFrame(this.frame); this.frame = 0;
    this.observer.disconnect(); this.resize.disconnect();
    this.motion.removeEventListener("change", this.invalidate); this.owner.removeEventListener("visibilitychange", this.invalidate);
    this.renderer?.dispose(); this.renderer?.forceContextLoss(); this.renderer = undefined;
    services.delete(this.owner);
  }
}

/** Call once after each grid rebuild. Call returned cleanup before replacing
 * children/closing the surface. Repeated mounts of a root replace its old one. */
export function mountShopCosmeticPreviews(root: HTMLElement): () => void {
  mounts.get(root)?.();
  const elements = [...root.querySelectorAll<HTMLElement>(".shop-cosmetic-preview")];
  let service = services.get(root.ownerDocument);
  if (!service && elements.length) { service = new PreviewService(root.ownerDocument); services.set(root.ownerDocument, service); }
  for (const element of elements) {
    const item = items.get(element) ?? SHOP_CATALOG.find(candidate => candidate.id === element.dataset.cosmeticId);
    if (item) service?.add(element, item);
  }
  let disposed = false;
  const cleanup = () => { if (disposed) return; disposed = true; for (const element of elements) service?.remove(element); mounts.delete(root); };
  mounts.set(root, cleanup); return cleanup;
}

export function disposeShopCosmeticPreview(preview: HTMLElement): void {
  services.get(preview.ownerDocument)?.remove(preview); preview.remove();
}
