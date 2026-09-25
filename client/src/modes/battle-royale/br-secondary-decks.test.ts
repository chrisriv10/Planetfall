import { describe, expect, it } from "vitest";
import { BR_POIS, BR_SECONDARY_LOCATIONS } from "@planetfall/shared";
import { buildSecondaryDeckParts, secondaryDeckBaseFinish } from "./br-secondary-decks";

const destinationFor = (id: string) => {
  const location = BR_SECONDARY_LOCATIONS.find((entry) => entry.id === id)!;
  return BR_POIS.find((poi) => poi.id === location.connectTo)!.position;
};

describe("BR secondary neighborhood decks", () => {
  it("keeps a road-width cross clear through every neighborhood", () => {
    for (const location of BR_SECONDARY_LOCATIONS) {
      const parts = buildSecondaryDeckParts(location, destinationFor(location.id));
      const broad = parts.filter((part) => part.scale.x > 10 && part.scale.z > 10);
      expect(broad).toHaveLength(4);
      // The nearest edge of every broad quadrant is at least 5.25m from the
      // local center line, leaving more than a 10m visual road corridor.
      expect(broad.every((part) => Math.hypot(part.position.x - location.position.x, part.position.z - location.position.z) > 19)).toBe(true);
    }
  });

  it("uses readable style families without creating excessive pieces", () => {
    const city = BR_SECONDARY_LOCATIONS.find((entry) => entry.id === "central-heights")!;
    const farm = BR_SECONDARY_LOCATIONS.find((entry) => entry.id === "farm-service")!;
    const industrial = BR_SECONDARY_LOCATIONS.find((entry) => entry.id === "east-checkpoint")!;
    const wreck = BR_SECONDARY_LOCATIONS.find((entry) => entry.id === "salvage-row")!;
    const cityParts = buildSecondaryDeckParts(city, destinationFor(city.id));
    const farmParts = buildSecondaryDeckParts(farm, destinationFor(farm.id));
    const industrialParts = buildSecondaryDeckParts(industrial, destinationFor(industrial.id));
    const wreckParts = buildSecondaryDeckParts(wreck, destinationFor(wreck.id));
    expect(cityParts.filter((part) => part.finish === "sidewalk")).toHaveLength(4);
    expect(farmParts.filter((part) => part.finish === "grass")).toHaveLength(4);
    expect(farmParts.filter((part) => part.finish === "soil")).toHaveLength(2);
    expect(industrialParts.filter((part) => part.finish === "road")).toHaveLength(4);
    expect(wreckParts.some((part) => part.finish === "warningRed")).toBe(true);
    expect(Math.max(cityParts.length, farmParts.length, wreckParts.length)).toBeLessThanOrEqual(10);
    expect(secondaryDeckBaseFinish("city")).toBe("sidewalk");
    expect(secondaryDeckBaseFinish("farm")).toBe("grass");
    expect(secondaryDeckBaseFinish("industrial")).toBe("road");
  });

  it("is deterministic and remains flush visual detail", () => {
    for (const location of BR_SECONDARY_LOCATIONS) {
      const first = buildSecondaryDeckParts(location, destinationFor(location.id));
      expect(buildSecondaryDeckParts(location, destinationFor(location.id))).toEqual(first);
      expect(first.every((part) => part.position.y >= .014 && part.position.y <= .024 && part.scale.y <= .014)).toBe(true);
      // The neighborhood finish stays above the island shell while sitting
      // below the road surface, so neither surface z-fights at intersections.
      expect(first.every((part) => part.position.y - part.scale.y / 2 > .006)).toBe(true);
    }
  });
});
