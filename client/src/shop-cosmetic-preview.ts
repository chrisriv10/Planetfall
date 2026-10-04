import type { ShopItem } from "@planetfall/shared";

export interface ShopCosmeticPreviewPlan {
  className: string;
  markup: string;
  kind: ShopItem["category"];
  motion: "idle" | "trail" | "emote" | "victory";
  /** Validated CSS color; preview does not depend on an ancestor card style. */
  color: string;
}

const astronautMarkup = `
  <span class="shop-preview-astronaut" aria-hidden="true">
    <i class="shop-preview-pack"></i><i class="shop-preview-helmet"><i class="shop-preview-visor"></i><i class="shop-preview-suit-band" style="left:1px;right:1px;bottom:2px;height:4px;border-radius:2px;background:var(--item-color)"></i></i>
    <i class="shop-preview-body"><i class="shop-preview-chest"></i></i>
    <i class="shop-preview-arm left" style="background:linear-gradient(var(--item-color) 0 23%,#283256 24% 58%,var(--item-color) 59% 72%,#edf4ff 73%)"></i><i class="shop-preview-arm right" style="background:linear-gradient(var(--item-color) 0 23%,#283256 24% 58%,var(--item-color) 59% 72%,#edf4ff 73%)"></i>
    <i class="shop-preview-leg left"><i class="shop-preview-knee" style="left:2px;top:2px;width:7px;height:5px;border-radius:2px;background:var(--item-color)"></i></i><i class="shop-preview-leg right"><i class="shop-preview-knee" style="left:2px;top:2px;width:7px;height:5px;border-radius:2px;background:var(--item-color)"></i></i>
  </span>`;

const trailMarkup = `
  <span class="shop-preview-trail" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
  <span class="shop-preview-pilot" aria-hidden="true"><i></i></span>`;

const planetMarkup = `
  <span class="shop-preview-planet" aria-hidden="true">
    <i class="shop-preview-eye left"></i><i class="shop-preview-eye right"></i><i class="shop-preview-smile"></i>
  </span>`;

const safeId = (id: string) => /^[a-z0-9-]+$/i.test(id) ? id.toLowerCase() : "cosmetic";
const previewColor = (item: Readonly<ShopItem>) => /^#[a-f\d]{6}$/i.test(item.color ?? "")
  ? item.color! : item.category === "emote" ? "#ff8bd9" : "#70f5ff";

/** Pure presentation plan for a shop card. The caller owns card behavior and
 * purchase state; this helper only supplies deterministic decorative markup. */
export function shopCosmeticPreviewPlan(item: Readonly<ShopItem>): ShopCosmeticPreviewPlan {
  const id = safeId(item.id);
  const color = previewColor(item);
  const base = `shop-cosmetic-preview shop-preview-${item.category} shop-preview-${id}`;
  if (item.category === "planet") return { className: base, markup: planetMarkup, kind: item.category, motion: "idle", color };
  if (item.category === "trail") return { className: base, markup: trailMarkup, kind: item.category, motion: "trail", color };
  if (item.category === "emote" || item.category === "victory") return {
    className: `${base} shop-preview-pose`, markup: astronautMarkup, kind: item.category, motion: item.category, color
  };
  return { className: base, markup: astronautMarkup, kind: item.category, motion: "idle", color };
}

/** Browser integration convenience; gameplay and shop request handling remain
 * in main.ts. The preview is decorative because the card already names it. */
export function createShopCosmeticPreview(item: Readonly<ShopItem>, owner: Document = document): HTMLElement {
  const plan = shopCosmeticPreviewPlan(item);
  const preview = owner.createElement("div");
  preview.className = plan.className;
  preview.dataset.previewKind = plan.kind;
  preview.dataset.previewMotion = plan.motion;
  preview.style.setProperty("--item-color", plan.color);
  preview.setAttribute("aria-hidden", "true");
  preview.innerHTML = plan.markup;
  return preview;
}

/** Optional explicit teardown for a retained preview. Normal replaceChildren
 * teardown already releases these DOM-only previews: no RAF, listeners, GPU
 * resources, or detached-element registry is created by this helper. */
export function disposeShopCosmeticPreview(preview: HTMLElement): void {
  for (const animation of preview.getAnimations?.({ subtree: true }) ?? []) animation.cancel();
  preview.remove();
}
