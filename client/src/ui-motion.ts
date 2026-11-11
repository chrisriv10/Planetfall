import "./ui-motion.css";

export function installUiMotion(root: Document | HTMLElement = document): () => void {
  const host = "documentElement" in root ? root.documentElement : root;
  host.setAttribute("data-ui-motion", "");
  return () => host.removeAttribute("data-ui-motion");
}

const noticeCleanups = new WeakMap<HTMLElement, () => void>();

export function dismissUiNotice(notice: HTMLElement): void {
  noticeCleanups.get(notice)?.();
  notice.hidden = true;
  const view = notice.ownerDocument.defaultView;
  if (!notice.isConnected || !view || !notice.closest("[data-ui-motion]") ||
      view.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !view.CSS.supports("interactivity", "inert") ||
      !view.CSS.supports("transition-behavior", "allow-discrete")) {
    notice.remove();
    return;
  }

  function finish() {
    cleanup();
    if (notice.hidden) notice.remove();
  }
  function onTransitionEnd(event: TransitionEvent) {
    if (event.target === notice && event.propertyName === "opacity") finish();
  }
  function cleanup() {
    clearTimeout(fallback);
    notice.removeEventListener("transitionend", onTransitionEnd);
    noticeCleanups.delete(notice);
  }
  // A notice dismissed before its first paint never starts a transition.
  const fallback = setTimeout(finish, 200);
  notice.addEventListener("transitionend", onTransitionEnd);
  noticeCleanups.set(notice, cleanup);
}
