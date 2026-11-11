import * as THREE from 'three';
import { createHomePreviewFramer, type HomePreviewRegion } from '../../home-preview-framing';
import { PgWorldRenderer } from './pg-world';
import { PG_HOME_COMPOSITION, pgHomeAmbientTime } from './pg-home-composition';

/** Canonical Nova Block miniature; distant first-person horizon context is excluded. */
export class PgHomePreview {
  readonly root = new THREE.Group();
  private readonly world = new PgWorldRenderer();
  private readonly framer = createHomePreviewFramer();
  private readonly bounds = new THREE.Box3();
  private readonly reduced = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  private disposed = false;
  constructor() {
    this.root.name = 'planet-gun-home-preview';
    this.world.setQuality('low'); this.root.add(this.world.root);
    this.world.root.rotation.set(PG_HOME_COMPOSITION.pitch, PG_HOME_COMPOSITION.yaw, 0);
    // This named root owns only the distant planet, gantries, freighters,
    // habitation wheel and stars. They frame first-person sightlines, not the arena.
    const context = this.world.root.getObjectByName('orbital-neighborhood');
    if (context) { context.visible = false; context.removeFromParent(); }
    this.world.root.updateMatrixWorld(true);
    // Includes actual instanced architecture and the underside foundation.
    // Hidden local detail is conservatively included; measured once, never per frame.
    this.bounds.setFromObject(this.world.root);
    if (context) this.world.root.add(context);
  }
  update(timeSeconds: number, camera: THREE.PerspectiveCamera, region: HomePreviewRegion): void {
    if (this.disposed) return;
    this.framer.fit(this.root, this.bounds, camera, region, PG_HOME_COMPOSITION.distance);
    this.world.update(pgHomeAmbientTime(timeSeconds, this.reduced?.matches ?? false));
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.world.dispose(); this.root.clear(); this.root.removeFromParent();
  }
}
