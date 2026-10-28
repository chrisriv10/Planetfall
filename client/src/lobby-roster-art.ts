/** Plain presentation input; room state and roster actions remain with the caller. */
export interface LobbyRosterPresentation {
  id: string;
  name: string;
  color: string;
  isBot: boolean;
  ready: boolean;
  localId: string | null;
  hostId: string | null;
  team?: "solar" | "void";
}

/** Compact shared identity row. Callers may append their existing action controls. */
export function createLobbyRosterRow(document: Document, input: LobbyRosterPresentation): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "mode-roster-row";
  row.dataset.playerId = input.id;
  row.dataset.local = String(input.id === input.localId);
  if (input.team) row.dataset.team = input.team;
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", `Pilot ${input.name}`);
  row.style.setProperty("--player-color", input.color);
  row.style.setProperty("--member-color", input.color);

  const swatch = document.createElement("span");
  swatch.className = "mode-roster-swatch";
  swatch.setAttribute("aria-hidden", "true");
  const name = document.createElement("strong");
  name.className = "mode-roster-name";
  name.textContent = input.name;
  const badges = document.createElement("span");
  badges.className = "mode-roster-badges";
  const badge = (kind: string, label: string) => {
    const item = document.createElement("span");
    item.className = "mode-roster-badge";
    item.dataset.kind = kind;
    item.textContent = label;
    badges.append(item);
  };
  if (input.id === input.localId) badge("you", "YOU");
  if (input.id === input.hostId) badge("host", "HOST");
  if (input.isBot) badge("bot", "BOT");
  if (input.team) badge(input.team, input.team.toUpperCase());
  badge(input.ready ? "ready" : "waiting", input.ready ? "READY" : "NOT READY");
  row.append(swatch, name, badges);
  return row;
}
