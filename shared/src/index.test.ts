import { describe, expect, it } from "vitest";
import { BALANCE, ballisticPosition, cannonPosition, damageStage, distance, dot, launchPadPosition, launchVelocity, normalize, projectOnPlane, repairPosition, sanitizeName, sub } from "./index.js";

describe("shared gameplay math", () => {
  it("projects movement onto a spherical tangent", () => {
    const normal = normalize({ x: 1, y: 2, z: -1 });
    const tangent = projectOnPlane({ x: 4, y: -3, z: 2 }, normal);
    expect(Math.abs(dot(tangent, normal))).toBeLessThan(1e-10);
  });

  it("advances event-synchronized projectiles deterministically", () => {
    expect(ballisticPosition({ x: 1, y: 2, z: 3 }, { x: 10, y: -2, z: 4 }, 0.5)).toEqual({ x: 6, y: 1, z: 5 });
  });

  it("uses the specified destruction thresholds", () => {
    expect([100, 75, 50, 25, 0].map(damageStage)).toEqual([0, 1, 2, 3, 3]);
  });

  it("sanitizes player-facing names", () => {
    expect(sanitizeName("  Nova<script>  ")).toBe("Novascript");
    expect(sanitizeName("x".repeat(30))).toHaveLength(18);
  });

  it("places launch pads deterministically away from existing infrastructure", () => {
    for (let index = 0; index < BALANCE.maxPlayers; index++) {
      const angle = index / BALANCE.maxPlayers * Math.PI * 2;
      const planet = { position: { x: Math.cos(angle) * BALANCE.arenaRadius, y: 0, z: Math.sin(angle) * BALANCE.arenaRadius } };
      const pad = launchPadPosition(planet);
      expect(launchPadPosition(planet)).toEqual(pad);
      expect(distance(pad, cannonPosition(planet))).toBeGreaterThan(4);
      expect(distance(pad, repairPosition(planet))).toBeGreaterThan(3);
    }
  });

  it("creates a fixed-speed launch that clears the source surface", () => {
    const source = { position: { x: 30, y: 0, z: 0 } };
    const target = { position: { x: -30, y: 0, z: 0 } };
    const pad = launchPadPosition(source);
    const velocity = launchVelocity(pad, source, target);
    expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeCloseTo(BALANCE.launch.speed);
    expect(dot(normalize(sub(pad, source.position)), normalize(velocity))).toBeGreaterThan(0.3);
  });
});
