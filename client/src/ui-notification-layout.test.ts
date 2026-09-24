/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "postcss";

// Stylesheet contracts only: these catch stacking/accessibility regressions,
// not browser geometry. Actual 720p/desktop screenshots remain integration QA.
const stylesheet = parse(readFileSync(new URL("./style.css", import.meta.url), "utf8"));
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
function declarations(selector: string, media?: string): Record<string, string> {
  const values: Record<string, string> = {};
  stylesheet.walkRules(rule => {
    if (!rule.selectors.includes(selector)) return;
    const parent = rule.parent;
    const query = parent?.type === "atrule" ? parent.params : undefined;
    if (query !== media) return;
    rule.walkDecls(declaration => { values[declaration.prop] = declaration.value; });
  });
  return values;
}
function openingTag(id: string): string {
  return html.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0] ?? "";
}

describe("notification presentation contracts", () => {
  it("keeps the BR feed below the minimap instead of painting over its lower half", () => {
    const minimap = declarations(".br-minimap"), feed = declarations(".br-kill-feed");
    expect(parseFloat(feed.top)).toBeGreaterThan(parseFloat(minimap.top) + parseFloat(minimap.width));
    const narrowFeed = declarations(".br-kill-feed", "(max-width: 760px)");
    expect(parseFloat(narrowFeed.top)).toBeGreaterThan(parseFloat(minimap.top) + parseFloat(minimap.width));
    expect(declarations(".feed-event")["overflow-wrap"]).toBe("anywhere");
    expect(declarations(".br-feed-row")["overflow-wrap"]).toBe("anywhere");
  });

  it("places POI arrivals below dialogs and preserves controller modal priority", () => {
    const layers = declarations(":root");
    expect(Number(layers["--notice-layer"])).toBeLessThan(Number(layers["--modal-layer"]));
    expect(Number(layers["--modal-layer"])).toBeLessThan(Number(layers["--toast-layer"]));
    expect(declarations(".br-poi-arrival")["z-index"]).toBe("var(--notice-layer)");
    expect(Number(declarations("#ui")["z-index"])).toBeGreaterThan(Number(layers["--notice-layer"]));
    const priorities = [20, ...["settings", "pass", "shop", "br-map"].map(id => Number(declarations(`#${id}-overlay`)["z-index"]))];
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });

  it("gives both modes centered results and a visible interaction progress strip", () => {
    for (const selector of ["#results-screen", "#br-results-screen"]) {
      expect(declarations(selector)).toMatchObject({ "align-items": "center", "justify-content": "center" });
    }
    expect(declarations("#br-context-progress")).toEqual(declarations("#context-progress"));
    expect(declarations("#br-context-progress").height).toBe("3px");
    expect(declarations(".context-prompt:has(> span:empty)").visibility).toBe("hidden");
  });

  it("keeps reduced-motion POI text visible until its existing lifecycle removes it", () => {
    expect(declarations(".br-poi-arrival", "(prefers-reduced-motion: reduce)"))
      .toMatchObject({ animation: "none", opacity: "1" });
  });

  it("labels focus-trapped dialogs and polite event logs", () => {
    for (const id of ["br-map", "settings", "pause", "shop", "pass"]) {
      const tag = openingTag(`${id}-overlay`);
      expect(tag).toContain('role="dialog"');
      expect(tag).toContain('aria-modal="true"');
      expect(tag).toContain(`aria-labelledby="${id}-title"`);
      expect(openingTag(`${id}-title`)).not.toBe("");
    }
    for (const id of ["event-feed", "br-kill-feed"]) {
      expect(openingTag(id)).toContain('role="log"');
      expect(openingTag(id)).toContain('aria-live="polite"');
      expect(openingTag(id)).toContain('aria-relevant="additions"');
    }
    expect(openingTag("br-map-button")).toContain('aria-label="Open tactical map"');
  });
});
