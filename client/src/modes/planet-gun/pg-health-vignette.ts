import "./pg-health-vignette.css";

/** Scalar presentation only; the caller supplies the authoritative health ratio. */
export function pgHealthVignetteStyle(healthFraction: number | null) {
  const damage = healthFraction === null || !Number.isFinite(healthFraction)
    ? 0 : 1 - Math.min(1, Math.max(0, healthFraction));
  return { opacity: .76 * damage ** .85, extentVmin: 7 + 17 * damage };
}

export function createPgHealthVignette(parent: HTMLElement): {
  set(healthFraction: number | null): void;
  dispose(): void;
} {
  const border = parent.ownerDocument.createElement("div");
  border.className = "pg-health-vignette";
  border.setAttribute("aria-hidden", "true");
  border.hidden = true;
  parent.append(border);
  let current: number | null = null;
  let disposed = false;
  return {
    set(healthFraction) {
      if (disposed || healthFraction === current) return;
      current = healthFraction;
      const { opacity, extentVmin } = pgHealthVignetteStyle(healthFraction);
      border.hidden = opacity === 0;
      border.style.opacity = String(opacity);
      border.style.setProperty("--pg-health-edge", `${extentVmin}vmin`);
    },
    dispose() {
      disposed = true;
      border.remove();
    },
  };
}
