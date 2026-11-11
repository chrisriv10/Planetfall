import "./pg-world-interaction-prompt.css";

export interface PgWorldInteractionView {
  key: string;
  title: string;
  detail: string;
  available: boolean;
}

/** The HUD owner selects the current interaction and supplies its authoritative status. */
export function createPgWorldInteractionPrompt(doc: Document) {
  const root = doc.createElement("div"), key = doc.createElement("kbd");
  const copy = doc.createElement("div"), title = doc.createElement("strong"), detail = doc.createElement("span");
  root.className = "pg-world-interaction-prompt";
  root.hidden = true;
  key.className = "pg-interaction-key";
  copy.className = "pg-interaction-copy";
  detail.className = "pg-interaction-detail";
  detail.setAttribute("role", "status");
  detail.setAttribute("aria-live", "polite");
  detail.setAttribute("aria-atomic", "true");
  copy.append(title, detail);
  root.append(key, copy);
  let disposed = false;
  return {
    root,
    render(view: PgWorldInteractionView | null) {
      if (disposed) return;
      if (!view) {
        if (!root.hidden) root.hidden = true;
        return;
      }
      if (key.textContent !== view.key) key.textContent = view.key;
      if (title.textContent !== view.title) title.textContent = view.title;
      if (detail.textContent !== view.detail) detail.textContent = view.detail;
      const available = String(view.available);
      if (root.dataset.available !== available) root.dataset.available = available;
      if (root.hidden) root.hidden = false;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.hidden = true;
      root.remove();
      root.replaceChildren();
    },
  };
}
