import { describe, expect, it } from "vitest";
import { BrInputEdgeLatch } from "./br-input-latch";

describe("Battle Royale input edge latch", () => {
  it("delivers a quick jump tap exactly once on the next network send", () => {
    const latch = new BrInputEdgeLatch();
    latch.observe(true);
    latch.observe(false);
    expect(latch.consume(false)).toBe(true);
    expect(latch.consume(false)).toBe(false);
  });

  it("preserves held input and can be reset between matches", () => {
    const latch = new BrInputEdgeLatch();
    expect(latch.consume(true)).toBe(true);
    latch.observe(true);
    latch.reset();
    expect(latch.consume(false)).toBe(false);
  });
});
