import { describe, expect, it } from "vitest";
import { AutoQualityController } from "./auto-quality";

const capable = { maxTextureSize: 16384, maxSamples: 4, deviceMemory: 8, devicePixelRatio: 1.5 };
function frames(controller: AutoQualityController, durationMs: number, frameMs: number, active = true): void {
  for (let elapsed = 0; elapsed < durationMs; elapsed += frameMs) controller.sample(frameMs, active);
}

describe("automatic graphics quality", () => {
  it("starts conservatively from lightweight capabilities", () => {
    expect(new AutoQualityController(capable).quality).toBe("medium");
    expect(new AutoQualityController({ ...capable, deviceMemory: 4 }).quality).toBe("low");
    expect(new AutoQualityController({ ...capable, maxTextureSize: 2048 }).quality).toBe("low");
    expect(new AutoQualityController({ ...capable, maxSamples: 1 }).quality).toBe("low");
    expect(new AutoQualityController({ maxTextureSize: 8192, maxSamples: 4 }).quality).toBe("medium");
  });

  it("requires measured headroom to promote and does not promote ordinary 60fps", () => {
    const normal = new AutoQualityController(capable);
    frames(normal, 20_000, 1000 / 60);
    expect(normal.quality).toBe("medium");
    const fast = new AutoQualityController(capable);
    frames(fast, 9_000, 10);
    expect(fast.quality).toBe("medium");
    frames(fast, 1_100, 10);
    expect(fast.quality).toBe("high");
    const denseDisplay = new AutoQualityController({ ...capable, devicePixelRatio: 3 });
    frames(denseDisplay, 12_000, 10);
    expect(denseDisplay.quality).toBe("medium");
  });

  it("requires sustained pressure and ignores a short combat spike", () => {
    const controller = new AutoQualityController(capable);
    frames(controller, 2_100, 16);
    frames(controller, 2_000, 40);
    frames(controller, 6_500, 16);
    expect(controller.quality).toBe("medium");
    frames(controller, 7_000, 40);
    expect(controller.quality).toBe("medium");
    frames(controller, 2_000, 40);
    expect(controller.quality).toBe("low");
  });

  it("excludes pauses, background, loading, and large stalls from a contiguous window", () => {
    const controller = new AutoQualityController(capable);
    frames(controller, 8_000, 40);
    controller.sample(40, false);
    frames(controller, 60_000, 40, false);
    controller.sample(5_000);
    controller.sample(Number.NaN);
    frames(controller, 9_000, 40);
    expect(controller.quality).toBe("medium");
    frames(controller, 1_100, 40);
    expect(controller.quality).toBe("low");
  });

  it("holds a long cooldown and never promotes again after a downstep", () => {
    const controller = new AutoQualityController(capable);
    frames(controller, 10_100, 10);
    expect(controller.quality).toBe("high");
    frames(controller, 35_000, 40);
    expect(controller.quality).toBe("high");
    frames(controller, 3_500, 40);
    expect(controller.quality).toBe("medium");
    frames(controller, 60_000, 10);
    expect(controller.quality).toBe("medium");
    frames(controller, 20_000, 40);
    expect(controller.quality).toBe("low");
  });

  it("keeps manual overrides exact and restarts sampling only when Auto is chosen", () => {
    const controller = new AutoQualityController(capable, "high");
    frames(controller, 90_000, 50);
    expect(controller.quality).toBe("high");
    expect(controller.setSelection("low")).toBe("low");
    frames(controller, 90_000, 10);
    expect(controller.quality).toBe("low");
    expect(controller.setSelection("auto")).toBe("medium");
    frames(controller, 10_100, 40);
    expect(controller.quality).toBe("low");
    expect(controller.setSelection("auto")).toBe("low");
  });

  it("steps down under sustained very low frame rates instead of resetting forever",()=>{
    const controller=new AutoQualityController(capable);
    frames(controller,9_000,200);
    expect(controller.quality).toBe("medium");
    frames(controller,1_200,200);
    expect(controller.quality).toBe("low");
  });

  it("recognizes sustained foreground GPU wait across one-second intervals", () => {
    const controller = new AutoQualityController(capable);
    controller.sample(1_500);
    controller.sample(1_500);
    expect(controller.quality).toBe("medium");
    // Preserve eight completed buckets even when a slow frame spans a bucket.
    for (let index = 0; index < 20; index++) controller.sample(index % 2 ? 800 : 1_500);
    expect(controller.quality).toBe("low");
  });

  it("discards provisional pressure after a pause, healthy frames or suspension", () => {
    const controller = new AutoQualityController(capable);
    controller.sample(1_500);
    controller.sample(1_500);
    controller.sample(16, false);
    controller.sample(1_500);
    frames(controller, 128, 16);
    controller.sample(1_500);
    controller.sample(5_000);
    frames(controller, 9_000, 40);
    expect(controller.quality).toBe("medium");
    frames(controller, 1_200, 40);
    expect(controller.quality).toBe("low");
  });

  it("recognizes GPU pressure interleaved with fast compositor callbacks", () => {
    const controller = new AutoQualityController(capable);
    for (let index = 0; index < 16; index++) {
      for (const frameMs of [750, 16, 1_400, 16]) controller.sample(frameMs);
    }
    expect(controller.quality).toBe("low");
  });
});
