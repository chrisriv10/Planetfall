import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { SHOP_CATALOG, type ShopItem } from "@planetfall/shared";
import { createShopCosmeticPreview, disposeShopCosmeticPreview, shopCosmeticPreviewPlan } from "./shop-cosmetic-preview";

describe("shop cosmetic card previews", () => {
  it("covers every catalog category with recognizable non-generic artwork", () => {
    for (const item of SHOP_CATALOG) {
      const preview = shopCosmeticPreviewPlan(item);
      expect(preview.kind).toBe(item.category);
      expect(preview.className).toContain(`shop-preview-${item.category}`);
      expect(preview.className).toContain(`shop-preview-${item.id}`);
      expect(preview.markup.length).toBeGreaterThan(100);
      expect(preview.markup).not.toBe("<i></i>");
      if (item.category === "planet") {
        expect(preview.markup).toContain("shop-preview-planet");
        expect(preview.markup).toContain("shop-preview-smile");
      } else if (item.category === "trail") {
        expect(preview.motion).toBe("trail");
        expect(preview.markup).toContain("shop-preview-trail");
        expect(preview.markup).toContain("shop-preview-pilot");
      } else {
        expect(preview.markup).toContain("shop-preview-astronaut");
      }
    }
  });

  it("gives each emote and victory item an item-specific pose class", () => {
    const poses = SHOP_CATALOG.filter(item => item.category === "emote" || item.category === "victory")
      .map(item => shopCosmeticPreviewPlan(item));
    expect(poses.every(preview => preview.className.includes("shop-preview-pose"))).toBe(true);
    expect(new Set(poses.map(preview => preview.className)).size).toBe(poses.length);
    expect(poses.filter(preview => preview.motion === "emote")).toHaveLength(3);
    expect(poses.filter(preview => preview.motion === "victory").length).toBeGreaterThanOrEqual(3);
  });

  it("keeps malformed external ids out of generated CSS class names", () => {
    const item: ShopItem = { id: `bad\" onclick=\"alert(1)`, name: "Bad", category: "suit", price: 0, color: "#fff" };
    const preview = shopCosmeticPreviewPlan(item);
    expect(preview.className).toContain("shop-preview-cosmetic");
    expect(preview.className).not.toContain("onclick");
    expect(preview.markup).not.toContain(item.id);
  });

  it("uses the catalog suit accent on real suit regions while retaining white armor", () => {
    for (const item of SHOP_CATALOG.filter(item => item.category === "suit")) {
      const before = JSON.stringify(item);
      const preview = shopCosmeticPreviewPlan(item);
      expect(preview.color).toBe(item.color);
      expect(preview.markup).toContain("shop-preview-suit-band");
      expect(preview.markup.match(/shop-preview-knee/g)).toHaveLength(2);
      expect(preview.markup).toContain("#edf4ff");
      expect(shopCosmeticPreviewPlan(item)).toEqual(preview);
      expect(JSON.stringify(item)).toBe(before);
    }
    const malicious = { ...SHOP_CATALOG[0], color: 'red; background:url(https://example.invalid)' };
    expect(shopCosmeticPreviewPlan(malicious).color).toBe("#70f5ff");
  });

  it("has item-specific trail/pose styling and respects reduced motion", () => {
    const styles = readFileSync(new URL("./style.css", import.meta.url), "utf8");
    for (const item of SHOP_CATALOG.filter(item => ["trail", "emote", "victory"].includes(item.category))) {
      expect(styles).toContain(`.shop-preview-${item.id}`);
    }
    expect(styles).toMatch(/prefers-reduced-motion:reduce[^}]*shop-cosmetic-preview[^}]*animation:none!important/);
  });

  it("creates self-contained decorative DOM and tears down without render loops or subscriptions", () => {
    const cancel = vi.fn(), remove = vi.fn(), setProperty = vi.fn(), setAttribute = vi.fn();
    const getAnimations = vi.fn().mockReturnValueOnce([{ cancel }]).mockReturnValue([]);
    const element = { dataset: {}, style: { setProperty }, setAttribute, getAnimations, remove, className: "", innerHTML: "" };
    const owner = { createElement: vi.fn().mockReturnValue(element) };
    const preview = createShopCosmeticPreview(SHOP_CATALOG[0], owner as unknown as Document);
    expect(owner.createElement).toHaveBeenCalledWith("div");
    expect(setAttribute).toHaveBeenCalledWith("aria-hidden", "true");
    expect(setProperty).toHaveBeenCalledWith("--item-color", SHOP_CATALOG[0].color);
    expect(element.dataset).toEqual({ previewKind: "suit", previewMotion: "idle" });
    expect(element.innerHTML).not.toMatch(/<canvas|<button|tabindex|onload|onclick/);
    disposeShopCosmeticPreview(preview); disposeShopCosmeticPreview(preview);
    expect(getAnimations).toHaveBeenCalledWith({ subtree: true });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
