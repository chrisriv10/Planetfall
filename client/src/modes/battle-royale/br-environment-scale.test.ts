import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {createAstronautVisual} from "../../astronaut";
import {
  BR_ASTRONAUT_REFERENCE_HEIGHT,
  BR_ENVIRONMENT_SCALE,
  isWithinBrPresentationScale,
} from "./br-environment-scale";

describe("BR environment presentation scale", () => {
  it("keeps human-scale furniture proportional to the canonical astronaut", () => {
    const astronaut=createAstronautVisual({identityColor:"#70f5ff",suitAccent:"#243747",isBot:false});
    const bounds=new THREE.Box3().setFromObject(astronaut.group);
    expect(BR_ASTRONAUT_REFERENCE_HEIGHT).toBeCloseTo(bounds.max.y-bounds.min.y,3);
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    astronaut.group.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}});
    for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
    expect(BR_ENVIRONMENT_SCALE.benchSeatTop.max / BR_ASTRONAUT_REFERENCE_HEIGHT).toBeLessThan(.3);
    expect(BR_ENVIRONMENT_SCALE.cafeTableTop.max / BR_ASTRONAUT_REFERENCE_HEIGHT).toBeLessThan(.55);
    expect(BR_ENVIRONMENT_SCALE.entranceClearHeight.min).toBeGreaterThan(BR_ASTRONAUT_REFERENCE_HEIGHT);
  });

  it("accepts deliberate stylisation but rejects the observed overscale seats", () => {
    expect(isWithinBrPresentationScale(.52, BR_ENVIRONMENT_SCALE.benchSeatTop)).toBe(true);
    expect(isWithinBrPresentationScale(.68, BR_ENVIRONMENT_SCALE.benchSeatTop)).toBe(false);
    expect(isWithinBrPresentationScale(.50, BR_ENVIRONMENT_SCALE.cafeSeatTop)).toBe(true);
    expect(isWithinBrPresentationScale(.59, BR_ENVIRONMENT_SCALE.cafeSeatTop)).toBe(false);
    expect(isWithinBrPresentationScale(Number.NaN, BR_ENVIRONMENT_SCALE.benchSeatTop)).toBe(false);
  });

  it("bounds readable trees, lights, entrances and one-seat transports", () => {
    expect(isWithinBrPresentationScale(4.7, BR_ENVIRONMENT_SCALE.ornamentalTreeHeight)).toBe(false);
    expect(isWithinBrPresentationScale(8, BR_ENVIRONMENT_SCALE.ornamentalTreeHeight)).toBe(true);
    expect(isWithinBrPresentationScale(3.2, BR_ENVIRONMENT_SCALE.streetLightHeight)).toBe(true);
    expect(isWithinBrPresentationScale(3.2, BR_ENVIRONMENT_SCALE.entranceClearHeight)).toBe(true);
    expect(isWithinBrPresentationScale(2.2, BR_ENVIRONMENT_SCALE.oneSeatTransportWidth)).toBe(true);
    expect(isWithinBrPresentationScale(4.4, BR_ENVIRONMENT_SCALE.oneSeatTransportLength)).toBe(true);
    expect(isWithinBrPresentationScale(1.8, BR_ENVIRONMENT_SCALE.oneSeatTransportHeight)).toBe(true);
  });
});

