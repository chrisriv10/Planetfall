import type { GraphicsQuality } from "./settings";

export type GraphicsSelection = GraphicsQuality | "auto";

/** Capture these once when the renderer is created; no UA or GPU-name heuristics. */
export interface AutoQualityCapabilities {
  maxTextureSize: number;
  maxSamples: number;
  deviceMemory?: number;
  devicePixelRatio?: number;
}

const WARMUP_MS = 2_000;
const WINDOW_BUCKETS = 8;
const BUCKET_MS = 1_000;
const COOLDOWN_MS = 30_000;
// Very slow rendering is still performance evidence. Exclude long suspension
// gaps, but allow sustained 150–500ms frames to lower the preset.
const STALL_MS = 1_000;

/**
 * Fixed-memory, frame-time-only policy. Call sample after rendering with the RAF
 * delta in milliseconds. active must exclude hidden, paused and loading scenes.
 * Auto resolves locally; persist the user's selection, never this resolved tier.
 */
export class AutoQualityController {
  private selection: GraphicsSelection;
  private resolved: GraphicsQuality;
  private readonly initial: GraphicsQuality;
  private readonly allowHigh: boolean;
  private warmupMs = WARMUP_MS;
  private cooldownMs = 0;
  private bucketMs = 0;
  private bucketFrames = 0;
  private windowMs = 0;
  private windowFrames = 0;
  private completedBuckets = 0;
  private slowBuckets = 0;
  private benchmarkPending = true;

  constructor(capabilities: AutoQualityCapabilities, selection: GraphicsSelection = "auto") {
    const memory = capabilities.deviceMemory;
    const constrained = capabilities.maxTextureSize < 4096 || capabilities.maxSamples < 2
      || (memory !== undefined && Number.isFinite(memory) && memory <= 4);
    this.initial = constrained ? "low" : "medium";
    this.allowHigh = !constrained && capabilities.maxTextureSize >= 8192 && capabilities.maxSamples >= 4
      && (memory === undefined || memory >= 8)
      && (capabilities.devicePixelRatio ?? 1) <= 2.5;
    this.selection = selection;
    this.resolved = selection === "auto" ? this.initial : selection;
  }

  get quality(): GraphicsQuality { return this.resolved; }

  setSelection(selection: GraphicsSelection): GraphicsQuality {
    if (selection === this.selection) return this.resolved;
    this.selection = selection;
    this.resolved = selection === "auto" ? this.initial : selection;
    this.benchmarkPending = true;
    this.cooldownMs = 0;
    this.resetSampling();
    return this.resolved;
  }

  sample(frameMs: number, active = true): GraphicsQuality | null {
    if (this.selection !== "auto") return null;
    if (!active || !Number.isFinite(frameMs) || frameMs <= 0 || frameMs >= STALL_MS) {
      this.resetSampling();
      return null;
    }
    if (this.warmupMs > 0) {
      this.warmupMs -= frameMs;
      return null;
    }
    if (this.cooldownMs > 0) {
      this.cooldownMs -= frameMs;
      return null;
    }

    this.bucketMs += frameMs;
    this.bucketFrames++;
    this.windowMs += frameMs;
    this.windowFrames++;
    if (this.bucketMs < BUCKET_MS) return null;

    // Require six slow one-second buckets, so a short spike cannot lower quality.
    const threshold = this.resolved === "high" ? 23 : 29;
    if (this.bucketMs / this.bucketFrames > threshold) this.slowBuckets++;
    this.completedBuckets++;
    this.bucketMs = 0;
    this.bucketFrames = 0;
    if (this.completedBuckets < WINDOW_BUCKETS) return null;

    const averageMs = this.windowMs / this.windowFrames;
    let next = this.resolved;
    if (this.slowBuckets >= 6 && averageMs > threshold) {
      if (this.resolved === "high") next = "medium";
      else if (this.resolved === "medium") next = "low";
    } else if (this.benchmarkPending && this.allowHigh && this.resolved === "medium" && averageMs < 13) {
      // One initial promotion requires measured headroom; later recovery does not
      // oscillate between tiers as the player moves between simple/busy scenes.
      next = "high";
    }
    this.benchmarkPending = false;
    this.clearWindow();
    if (next === this.resolved) return null;
    this.resolved = next;
    this.cooldownMs = COOLDOWN_MS;
    return next;
  }

  private resetSampling(): void {
    this.warmupMs = WARMUP_MS;
    this.clearWindow();
  }

  private clearWindow(): void {
    this.bucketMs = 0;
    this.bucketFrames = 0;
    this.windowMs = 0;
    this.windowFrames = 0;
    this.completedBuckets = 0;
    this.slowBuckets = 0;
  }
}
