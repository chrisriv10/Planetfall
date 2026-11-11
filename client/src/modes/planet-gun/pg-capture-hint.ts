import { mouseButtonIcon } from "../../mouse-button-icon";
import "./pg-capture-hint.css";

export type PgCaptureHintMode = "play" | "spectate" | null;

/** Presentation only: the caller owns capture state and modal/input gating. */
export function createPgCaptureHint(parent: HTMLElement): {
  set(mode: PgCaptureHintMode): void;
  dispose(): void;
} {
  const document = parent.ownerDocument;
  const hint = document.createElement("div");
  hint.className = "pg-capture-hint";
  hint.hidden = true;
  hint.setAttribute("role", "status");
  hint.setAttribute("aria-live", "polite");
  hint.setAttribute("aria-atomic", "true");
  const icon = document.createElement("span");
  icon.className = "pg-capture-hint-icon";
  icon.innerHTML = mouseButtonIcon("LMB");
  const label = document.createElement("span");
  hint.append(icon, label);
  parent.append(hint);

  let current: PgCaptureHintMode = null;
  let disposed = false;
  return {
    set(mode) {
      if (disposed || mode === current) return;
      current = mode;
      hint.hidden = mode === null;
      label.textContent = mode === null ? "" : mode === "spectate" ? "CLICK TO ORBIT" : "CLICK TO LOOK";
    },
    dispose() {
      disposed = true;
      hint.remove();
    },
  };
}
