import { describe, expect, it } from "vitest";
import { blockClearance, projectedBlock } from "./br-presentation-clearance-test-utils";

describe("presentation obstruction projection",()=>{
  const deck={position:{x:0,y:2,z:0},size:{x:100,y:4,z:100}};
  it("separates supporting floors and overhead structures but preserves buried-art failures",()=>{
    expect(blockClearance({x:0,z:0},4,8,deck)).toBe(Infinity);
    expect(blockClearance({x:0,z:0},-4,-1,deck)).toBe(Infinity);
    expect(blockClearance({x:0,z:0},0,3,deck)).toBe(0);
  });
  it("uses the rotated footprint of a long diagonal grade and its full pitched height",()=>{
    const grade={position:{x:0,y:2,z:0},size:{x:100,y:.4,z:4},rotation:{x:0,y:Math.PI/4,z:.1}};
    const box=projectedBlock(grade);
    expect(box.top).toBeGreaterThan(7);
    expect(box.bottom).toBeLessThan(-3);
    expect(blockClearance({x:0,z:0},0,10,grade)).toBe(0);
    expect(blockClearance({x:25,z:25},0,10,grade)).toBeCloseTo(Math.hypot(25,25)-2,8);
    expect(blockClearance({x:25,z:-25},0,10,grade)).toBe(0);
  });
});
