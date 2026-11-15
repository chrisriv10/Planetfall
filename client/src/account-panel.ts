import "./account-panel.css";

export interface AccountPanelView {
  state: "guest" | "signed-in" | "conflict" | "busy" | "unavailable";
  account?: {name: string; avatar?: string};
  profile?: {sessionLevel: number; fallbucks: number; crowns: number};
  cosmeticName?: string;
  feedback?: string;
}

type AccountAction = "google" | "guest" | "account" | "signout" | "switch" | "retry" | "close";

function safeAvatar(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** Presentation only: the owning controller manages focus, visibility and authentication. */
export function createAccountPanel(onAction: (action: AccountAction) => void) {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = "") => {
    const node = document.createElement(tag); node.className = cls; node.textContent = text; return node;
  };
  const root = el("section", "overlay account-overlay");
  root.id = "account-overlay"; root.hidden = true;
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "account-heading");
  const panel = el("div", "account-panel"), header = el("div", "account-header");
  const titleBlock = el("div", "account-title-block");
  const eyebrow = el("p", "account-eyebrow", "PLANETFALL · PILOT PROFILE");
  const heading = el("h2", "account-heading", "Account"); heading.id = "account-heading";
  titleBlock.append(eyebrow, heading);
  const buttons = new Map<AccountAction, HTMLButtonElement>();
  const button = (action: AccountAction, label: string, primary = false) => {
    const node = el("button", `button ${primary ? "button-primary" : "button-secondary"} account-action`, label);
    node.type = "button"; node.dataset.accountAction = action; node.dataset.bindingIgnore = "true";
    node.onclick = () => { if (!node.disabled && !node.hidden) onAction(action); };
    buttons.set(action, node); return node;
  };
  const close = button("close", "Close"); close.className = "button button-quiet account-close";
  close.setAttribute("aria-label", "Close account panel"); header.append(titleBlock, close);
  const identity = el("div", "account-identity"), portrait = el("div", "account-portrait");
  const initials = el("span", "account-initials", "GP"), avatar = el("img", "account-avatar");
  avatar.alt = ""; avatar.width = 64; avatar.height = 64; avatar.referrerPolicy = "no-referrer";
  avatar.hidden = true;
  avatar.onerror = () => { avatar.hidden = true; initials.hidden = false; };
  portrait.setAttribute("aria-hidden", "true"); portrait.append(initials, avatar);
  const identityText = el("div", "account-identity-text");
  const name = el("h3", "account-name"), provider = el("p", "account-provider");
  identityText.append(name, provider); identity.append(portrait, identityText);
  const description = el("p", "account-description");
  const summary = el("dl", "account-summary");
  const stats = ["Level", "Fallbucks", "Crowns"].map(label => {
    const item = el("div", "account-stat"), term = el("dt", "", label), value = el("dd", "", "—");
    item.append(term, value); summary.append(item); return value;
  });
  const cosmetic = el("p", "account-cosmetic"), cosmeticLabel = el("span", "", "Equipped cosmetic");
  const cosmeticValue = el("strong", ""); cosmetic.append(cosmeticLabel, cosmeticValue);
  const feedback = el("p", "account-feedback");
  feedback.setAttribute("role", "status"); feedback.setAttribute("aria-live", "polite");
  feedback.setAttribute("aria-atomic", "true");
  const actions = el("div", "account-actions");
  actions.append(button("google", "Sign in with Google", true), button("account", "Continue with account progress", true),
    button("retry", "Try again", true), button("guest", "Continue as Guest"),
    button("switch", "Switch Account"), button("signout", "Sign Out"));
  const note = el("p", "account-note");
  panel.append(header, identity, description, summary, cosmetic, feedback, actions, note); root.append(panel);
  const number = new Intl.NumberFormat(undefined, {maximumFractionDigits: 0});
  function render(view: AccountPanelView) {
    const signedIn = view.state === "signed-in", conflict = view.state === "conflict", busy = view.state === "busy";
    root.dataset.state = view.state; panel.setAttribute("aria-busy", String(busy));
    name.textContent = (signedIn || conflict) ? view.account?.name || "Pilot" : "GUEST PILOT";
    provider.textContent = signedIn ? "Google · Signed in" : conflict ? "Google · Account progress found" : "Guest profile";
    identity.hidden = busy || view.state === "unavailable";
    initials.textContent = signedIn || conflict ? (view.account?.name?.trim().slice(0, 2).toUpperCase() || "P") : "GP";
    const avatarUrl = signedIn || conflict ? safeAvatar(view.account?.avatar) : null;
    if (avatarUrl) {
      if (avatar.getAttribute("src") !== avatarUrl) { avatar.src = avatarUrl; avatar.hidden = false; initials.hidden = true; }
    } else { avatar.removeAttribute("src"); avatar.hidden = true; initials.hidden = false; }
    description.textContent = signedIn ? "Your account keeps your progression together across devices and every game family."
      : conflict ? "This account already has progress. Choose which profile to play with. Your profiles will not be merged or overwritten."
      : busy ? "Connecting your pilot profile…"
      : view.state === "unavailable" ? "Account sign-in is temporarily unavailable. You can keep playing as a guest."
      : "Sign in to keep your progress across devices. You can always play as a guest.";
    summary.hidden = !view.profile || busy || conflict || view.state === "unavailable";
    const values = view.profile ? [view.profile.sessionLevel, view.profile.fallbucks, view.profile.crowns] : [];
    stats.forEach((node, index) => { const value = values[index]; node.textContent = Number.isFinite(value) ? number.format(Math.max(0, value!)) : "—"; });
    cosmetic.hidden = !view.cosmeticName || summary.hidden;
    cosmeticValue.textContent = cosmetic.hidden ? "" : view.cosmeticName!;
    feedback.textContent = view.feedback || ""; feedback.hidden = !view.feedback;
    for (const [action, node] of buttons) {
      node.hidden = action !== "close" && !(signedIn ? action === "switch" || action === "signout"
        : conflict ? action === "account" || action === "guest"
        : view.state === "guest" ? action === "google" || action === "guest"
        : view.state === "unavailable" ? action === "retry" || action === "guest" : action === "guest");
      node.disabled = busy && action !== "close";
    }
    buttons.get("guest")!.textContent = conflict ? "Keep playing as guest" : "Continue as Guest";
    note.textContent = signedIn ? "Sign out before someone else uses this device."
      : conflict ? "Keeping your guest profile leaves the existing account progress unchanged."
      : busy ? "Please wait while your account is checked."
      : "Guest access is remembered in this browser. Clearing browser storage can remove access to guest progress.";
  }
  render({state: "guest"});
  return {root, render};
}
