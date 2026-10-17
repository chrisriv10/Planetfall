import { describe, expect, it } from "vitest";
import { mouseButtonIcon } from "./mouse-button-icon";
describe("mouse binding icons", () => {
  it("names each highlighted button accessibly and escapes all other bindings", () => {
    expect(mouseButtonIcon("LMB")).toContain('aria-label="Left mouse button"');
    expect(mouseButtonIcon("RMB")).toContain('aria-label="Right mouse button"');
    expect(mouseButtonIcon("LMB")).not.toBe(mouseButtonIcon("RMB"));
    expect(mouseButtonIcon('<img src="x">&')).toBe('&lt;img src=&quot;x&quot;&gt;&amp;');
    expect(mouseButtonIcon("Space")).toBe("Space");
  });
});
