import "./pg-siege-feed-ui.css";

export interface PgSiegeFeedView {
  name: string;
  /** Zero-based position within the team's camera list. */
  index: number;
  count: number;
  team: string;
  signal: "live" | "jammed" | "destroyed";
  disabledUntil?: number;
}

export function createPgSiegeFeedUi(doc: Document) {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = "") => {
    const node = doc.createElement(tag);
    node.className = `pg-siege-feed-${cls}`;
    node.textContent = text;
    return node;
  };
  const root = el("section", "ui");
  root.hidden = true;
  root.setAttribute("aria-label", "Security camera feed");
  const mask = el("div", "mask"), message = el("strong", "loss"), explanation = el("span", "cause");
  mask.append(message, explanation);
  const header = el("header", "header"), team = el("small", "team"), name = el("strong", "name"), signal = el("span", "signal");
  header.append(team, name, signal);
  const bar = el("div", "controls"), counter = el("span", "counter");
  const prev = el("button", "prev", "‹ Prev"), next = el("button", "next", "Next ›"), exit = el("button", "exit", "Exit feed");
  for (const button of [prev, next, exit]) button.type = "button";
  prev.setAttribute("aria-label", "Previous camera"); next.setAttribute("aria-label", "Next camera");
  signal.setAttribute("role", "status");
  bar.append(prev, counter, next, exit);
  root.append(mask, header, bar);
  let disposed = false;
  function label(node: HTMLElement, value: string) { if (node.textContent !== value) node.textContent = value; }
  const api = {
    root,
    onCycle: null as ((direction: -1 | 1) => void) | null,
    onExit: null as (() => void) | null,
    render(view: PgSiegeFeedView | null) {
      if (disposed) return;
      root.hidden = !view;
      if (!view) return;
      root.dataset.signal = view.signal;
      label(team, `PLANETSIEGE   /   ${view.team.toUpperCase()}`);
      label(name, view.name);
      label(signal, view.signal === "live" ? "Live signal" : view.signal === "jammed" ? "Signal jammed" : "Camera destroyed");
      label(counter, `CAM ${String(view.index + 1).padStart(2,"0")} / ${String(view.count).padStart(2,"0")}`);
      mask.hidden = view.signal === "live";
      if (!mask.hidden) {
        label(message, "Signal lost");
        label(explanation, view.signal === "jammed" ? "Interference detected" : "Camera destroyed");
      }
      prev.disabled = next.disabled = view.count <= 1;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      prev.onclick = next.onclick = exit.onclick = null;
      api.onCycle = api.onExit = null;
      root.remove(); root.replaceChildren();
    },
  };
  prev.onclick = () => { if (!root.hidden && !prev.disabled) api.onCycle?.(-1); };
  next.onclick = () => { if (!root.hidden && !next.disabled) api.onCycle?.(1); };
  exit.onclick = () => { if (!root.hidden) api.onExit?.(); };
  return api;
}
