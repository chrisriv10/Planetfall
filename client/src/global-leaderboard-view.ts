import type {LeaderboardData,LeaderboardEntry} from "@planetfall/shared";
import "./global-leaderboard-view.css";

export interface GlobalLeaderboardViewCallbacks {
  onRetry(): void;
  onSubmit(name: string): void;
  onRemove(): void;
  onClose(): void;
  onEdit?(name: string): void;
}

export function createGlobalLeaderboardView(callbacks: GlobalLeaderboardViewCallbacks) {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = "") => {
    const node = document.createElement(tag); node.className = cls; node.textContent = text; return node;
  };
  const root = el("section", "overlay global-leaderboard-overlay");
  root.id = "global-leaderboard-overlay"; root.hidden = true;
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "global-leaderboard-heading");
  const panel = el("div", "global-leaderboard-panel");
  const header = el("header", "global-leaderboard-header");
  const heading = el("h2", "global-leaderboard-heading", "Global Leaderboard"); heading.id = "global-leaderboard-heading";
  const button = (label: string, action: string, primary = false) => {
    const node = el("button", `button button-${primary ? "primary" : "secondary"}`, label);
    node.type = "button"; node.dataset.leaderboardAction = action; node.dataset.bindingIgnore = "true"; return node;
  };
  const closeButton = button("Close", "close"); closeButton.setAttribute("aria-label", "Close global leaderboard");
  closeButton.onclick = () => callbacks.onClose(); header.append(heading, closeButton);
  const intro = el("p", "global-leaderboard-intro", "Top 10 public pilots · ranked by lifetime earned XP");
  const status = el("p", "global-leaderboard-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
  const retry = button("Try again", "retry"); retry.hidden = true; retry.onclick = () => callbacks.onRetry();
  const table = el("table", "global-leaderboard-table");
  const caption = el("caption", "global-leaderboard-sr", "Public pilot rankings by lifetime earned XP");
  const thead = el("thead", ""), labels = el("tr", "");
  for (const label of ["Rank", "Pilot", "Lifetime XP"]) { const cell = el("th", "", label); cell.scope = "col"; labels.append(cell); }
  thead.append(labels); const body = el("tbody", ""); table.append(caption, thead, body);
  const personal = el("div", "global-leaderboard-personal"); personal.hidden = true;
  const form = el("form", "global-leaderboard-sharing");
  const shareHeading = el("h3", "", "Your public pilot name");
  const disclosure = el("p", "global-leaderboard-disclosure", "Choose to publish your pilot name and lifetime earned XP on the global leaderboard. Use a game name, not personal information. You can remove your listing anytime.");
  disclosure.id = "global-leaderboard-disclosure";
  const label = el("label", "global-leaderboard-name-label", "Public pilot name"); label.htmlFor = "global-leaderboard-name";
  const input = el("input", "global-leaderboard-name"); input.id = "global-leaderboard-name";
  input.name = "publicName"; input.type = "text"; input.autocomplete = "off"; input.required = true; input.maxLength=18;
  input.setAttribute("aria-describedby", disclosure.id); input.dataset.bindingIgnore = "true";
  const actions = el("div", "global-leaderboard-sharing-actions");
  const submit = button("Publish name & XP", "submit", true); submit.type = "submit";
  const remove = button("Remove my listing", "remove"); remove.hidden = true;
  const privacy = el("p", "global-leaderboard-privacy", "Your profile is not publicly listed.");
  const saveStatus = el("p", "global-leaderboard-save-status"); saveStatus.setAttribute("role", "status");
  actions.append(submit, remove); form.append(shareHeading, disclosure, label, input, actions, privacy, saveStatus);
  panel.append(header, intro, status, retry, table, personal, form); root.append(panel);
  let returnFocus: HTMLElement | null = null, edited = false, busy = false, loaded = false;
  let publishedName: string | null = null;
  const number = new Intl.NumberFormat(undefined, {maximumFractionDigits: 0});
  const refreshControls = () => {
    input.disabled = busy || !loaded; submit.disabled = busy || !loaded || !input.value.trim(); remove.disabled = busy || !loaded;
    submit.textContent = publishedName ? "Update public name" : "Publish name & XP";
    remove.hidden = !publishedName;
  };
  input.oninput = () => { edited = true; refreshControls(); callbacks.onEdit?.(input.value); };
  form.onsubmit = event => { event.preventDefault(); if (!submit.disabled) callbacks.onSubmit(input.value.trim()); };
  remove.onclick = () => { if (!remove.disabled && !remove.hidden) callbacks.onRemove(); };
  root.onkeydown = event => {
    if (root.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); callbacks.onClose(); }
    if (event.key !== "Tab") return;
    const focusable = [closeButton, retry, input, submit, remove].filter(node => !node.hidden && !node.disabled);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  const row = (entry: LeaderboardEntry) => {
    const tr = el("tr", entry.isYou ? "global-leaderboard-row is-you" : "global-leaderboard-row");
    tr.dataset.rank = String(entry.rank);
    const rank = el("td", "global-leaderboard-rank", `#${number.format(entry.rank)}`);
    const name = el("td", "global-leaderboard-pilot"); name.append(el("span", "global-leaderboard-pilot-name", entry.name));
    if (entry.isYou) name.append(el("span", "global-leaderboard-you", "YOU"));
    tr.append(rank, name, el("td", "global-leaderboard-xp", number.format(entry.xp))); return tr;
  };
  function loading() {
    root.dataset.state = "loading"; status.textContent = "Loading global rankings…"; status.hidden = false;
    if(document.activeElement===retry)closeButton.focus();
    table.hidden = true; personal.hidden = true; retry.hidden = true; panel.setAttribute("aria-busy", "true");
    loaded = false; refreshControls();
  }
  function render(data: LeaderboardData) {
    root.dataset.state = "ready"; panel.setAttribute("aria-busy", "false"); loaded = true;
    body.replaceChildren(...data.entries.slice(0, 10).map(row)); table.hidden = !data.entries.length;
    status.textContent = data.entries.length ? "" : "No public pilots yet. Be the first to join the leaderboard.";
    status.hidden = Boolean(data.entries.length);
    if(document.activeElement===retry)closeButton.focus();
    retry.hidden = true;
    const current = data.currentPlayer;
    personal.replaceChildren(); personal.hidden = !current;
    if (current) {
      personal.append(el("span", "", "YOUR GLOBAL POSITION"), el("strong", "", `#${number.format(current.rank)}`),
        el("span", "", `${number.format(current.xp)} lifetime XP`));
    }
    // Background refreshes must not replace an unfinished edit.
    if (!edited || data.publicName !== publishedName) { input.value = data.publicName ?? input.value; edited = false; }
    publishedName = data.publicName;
    privacy.textContent = publishedName ? "Your pilot name and lifetime XP are public. Removing your listing keeps your earned progress."
      : "Your profile is not publicly listed. Publishing is optional.";
    saveStatus.textContent = ""; refreshControls();
  }
  function error(message: string) {
    root.dataset.state = "error"; panel.setAttribute("aria-busy", "false"); status.hidden = false;
    status.textContent = message || "Global rankings are unavailable. Please try again."; retry.hidden = false;
    table.hidden = true; personal.hidden = true; loaded=false; refreshControls();
  }
  function saveError(message:string){saveStatus.textContent=message;}
  function saving(value: boolean) {
    if(value&&[input,submit,remove].some(node=>node===document.activeElement))closeButton.focus();
    busy = value; form.setAttribute("aria-busy", String(value)); saveStatus.textContent = value ? "Saving your public listing…" : "";
    refreshControls();
  }
  function open(defaultName: string,invoker?:HTMLElement) {
    if (!root.hidden) return;
    returnFocus = invoker??(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    edited = false; input.value = defaultName; root.hidden = false; closeButton.focus();
  }
  function close() {
    if (root.hidden) return;
    root.hidden = true; if (returnFocus?.isConnected) returnFocus.focus(); returnFocus = null;
  }
  loading();
  return {root, open, close, loading, render, error, saving, saveError};
}
