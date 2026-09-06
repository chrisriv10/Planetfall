import "./style.css";
import { BALANCE, type JoinResult, type MatchEvent, type MatchResult, type RoomView, type WeaponType } from "@planetfall/shared";
import { createGameSocket } from "./network";

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = byId<HTMLCanvasElement>("game-canvas");
const screens = {
  home: byId("home-screen"), lobby: byId("lobby-screen"), hud: byId("hud"), results: byId("results-screen")
};
const nameInput = byId<HTMLInputElement>("player-name");
const codeInput = byId<HTMLInputElement>("room-code");
const createButton = byId<HTMLButtonElement>("create-room");
const soloButton = byId<HTMLButtonElement>("play-solo");
const joinButton = byId<HTMLButtonElement>("join-room");
const addBotButton = byId<HTMLButtonElement>("add-bot");
const readyButton = byId<HTMLButtonElement>("ready-button");
const startButton = byId<HTMLButtonElement>("start-button");
const copyButton = byId<HTMLButtonElement>("copy-code");
const playerList = byId("player-list");
const connectionPill = byId("connection-pill");
const contextPrompt = byId("context-prompt");
const contextCopy = byId("context-copy");
const contextProgress = byId<HTMLElement>("context-progress");
const trajectoryLabel = byId("trajectory");
const countdown = byId("countdown");
const eventFeed = byId("event-feed");
const matchHint = byId("match-hint");
const edgeRegion = byId("edge-indicators");
createButton.disabled = true; soloButton.disabled = true; joinButton.disabled = true;
nameInput.value = nameInput.value || localStorage.getItem("planetfall:name") || "";

const socket = createGameSocket();
const { PlanetfallGame } = await import("./game");
const game = new PlanetfallGame(canvas);

let room: RoomView | null = null;
let playerId = "";
let currentCode = "";
let currentName = "";
let joining = false;
let countdownTimer = 0;
let countdownNumber = -1;
let announcedWinner: string | null | undefined;
let hintTimer = 0;
const indicatorNodes = new Map<string, HTMLElement>();

await game.init();
if (import.meta.env.DEV) Object.defineProperty(window, "__PLANETFALL_DEBUG__", { value: () => game.debugState(), configurable: true });
showScreen("home");
createButton.disabled = false; soloButton.disabled = false; joinButton.disabled = false;
if (socket.connected) setConnection("online", "Online");

socket.on("connect", () => {
  setConnection("online", "Online");
  if (currentCode && playerId) resumeRoom();
});
socket.on("disconnect", () => setConnection("offline", "Reconnecting..."));
socket.io.on("reconnect_attempt", () => setConnection("", "Server waking up..."));
socket.on("server:error", ({ message }) => toast(message));
socket.on("room:state", (nextRoom) => applyRoom(nextRoom));
socket.on("match:snapshot", (snapshot) => {
  game.applySnapshot(snapshot);
  if (room) {
    room.players = snapshot.players; room.planets = snapshot.planets; room.scraps = snapshot.scraps;
    room.phase = snapshot.phase; room.matchEndsAt = snapshot.matchEndsAt;
    updateHud();
  }
});
socket.on("match:countdown", ({ startsAt }) => runCountdown(startsAt));
socket.on("projectile:spawned", (projectile) => game.spawnProjectile(projectile));
socket.on("projectile:exploded", (payload) => game.explode(payload));
socket.on("scrap:collected", (payload) => {
  game.collectScrap(payload);
  if (!payload.stolen) return;
  const collector = room?.players.find((player) => player.id === payload.playerId);
  if (payload.playerId === playerId) toast(`STOLEN SCRAP +${payload.value}`);
  else if (payload.ownerId === playerId) toast(`${collector?.name ?? "An intruder"} stole your scrap`);
});
socket.on("player:launched", (payload) => game.launchPlayer(payload));
socket.on("player:landed", (payload) => {
  game.landPlayer(payload);
  const invader = room?.players.find((player) => player.id === payload.playerId);
  if (payload.intruder && payload.ownerId === playerId) toast(`${invader?.name?.toUpperCase() ?? "INTRUDER"} LANDED`);
  else if (payload.intruder && payload.playerId === playerId) toast("Enemy planet reached");
});
socket.on("player:shoved", (payload) => game.shovePlayer(payload));
socket.on("structure:sabotaged", (payload) => {
  game.sabotageStructure(payload);
  const label = payload.structure === "cannon" ? "Cannon" : "Repair core";
  if (payload.playerId === playerId) toast(`${label} jammed`);
  else if (payload.ownerId === playerId) toast(`${label.toUpperCase()} JAMMED`);
});
socket.on("structure:sabotage-cancelled", ({ playerId: cancelledId }) => game.cancelSabotage(cancelledId));
socket.on("planet:damaged", ({ planetId, hit, integrity }) => { game.damagePlanet(planetId, hit, integrity); updateHud(); });
socket.on("planet:repaired", (payload) => game.repairPlanet(payload));
socket.on("planet:destroyed", ({ planetId }) => game.destroyPlanet(planetId));
socket.on("match:event", (event) => appendMatchEvent(event));
socket.on("match:ended", ({ winnerId, result }) => {
  if (room) room.matchResult = result;
  showResults(winnerId, result);
});

game.onInput = (input) => socket.emit("player:input", input);
game.onFire = (weapon, direction) => socket.emit("cannon:fire", { weapon, direction });
game.onRepair = () => socket.emit("repair:buy");
game.onInteract = (interaction) => socket.emit("player:interact", interaction);
game.onWeaponChange = updateWeapon;
game.onPrompt = (text, aiming, label, kind = "idle", progress = 0) => {
  contextCopy.textContent = text;
  contextPrompt.dataset.kind = kind;
  contextProgress.style.width = `${Math.round(progress * 100)}%`;
  trajectoryLabel.style.opacity = aiming ? "1" : "0";
  if (label) trajectoryLabel.textContent = label;
};
game.onIndicators = (indicators) => {
  const active = new Set(indicators.map((indicator) => indicator.id));
  for (const [id, node] of indicatorNodes) if (!active.has(id)) { node.remove(); indicatorNodes.delete(id); }
  for (const indicator of indicators) {
    let node = indicatorNodes.get(indicator.id);
    if (!node) {
      node = document.createElement("div"); node.className = "edge-indicator"; node.innerHTML = "<i></i><b></b>";
      edgeRegion.append(node); indicatorNodes.set(indicator.id, node);
    }
    node.classList.toggle("danger", Boolean(indicator.danger));
    node.style.left = `${indicator.x}px`; node.style.top = `${indicator.y}px`;
    node.style.setProperty("--indicator-color", indicator.color);
    node.style.setProperty("--indicator-angle", `${indicator.angle}deg`);
    node.querySelector("b")!.textContent = indicator.label;
  }
};
game.onHint = (id, text) => showHint(id, text);

createButton.addEventListener("click", () => joinOrCreate("create"));
soloButton.addEventListener("click", () => joinOrCreate("solo"));
joinButton.addEventListener("click", () => joinOrCreate("join"));
codeInput.addEventListener("input", () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6); });
codeInput.addEventListener("keydown", (event) => { if (event.key === "Enter") joinOrCreate("join"); });
nameInput.addEventListener("keydown", (event) => { if (event.key === "Enter") joinOrCreate(codeInput.value ? "join" : "create"); });
readyButton.addEventListener("click", () => {
  const me = room?.players.find((p) => p.id === playerId);
  if (me) { game.audio.click(); socket.emit("room:ready", { ready: !me.ready }); }
});
startButton.addEventListener("click", () => { game.audio.click(); socket.emit("match:start"); });
addBotButton.addEventListener("click", () => { game.audio.click(); socket.emit("room:bot:add"); });
copyButton.addEventListener("click", async () => {
  if (!room) return;
  try { await navigator.clipboard.writeText(room.code); toast("Room code copied!"); }
  catch { toast(`Room code: ${room.code}`); }
});
byId("weapon-button").addEventListener("click", () => {
  game.weapon = game.weapon === "rocket" ? "asteroid" : "rocket";
  updateWeapon(game.weapon); game.audio.click();
});
byId("rematch-button").addEventListener("click", () => { socket.emit("match:rematch"); game.audio.click(); });
byId("leave-button").addEventListener("click", () => location.reload());

function joinOrCreate(kind: "create" | "join" | "solo"): void {
  if (joining) return;
  const name = nameInput.value.trim();
  const code = codeInput.value.trim().toUpperCase();
  if (!name) return toast("Choose a pilot name first.");
  if (kind === "join" && code.length !== 6) return toast("Enter the six-character room code.");
  game.audio.unlock(); game.audio.click();
  localStorage.setItem("planetfall:name", name);
  currentName = name;
  joining = true;
  createButton.disabled = true; soloButton.disabled = true; joinButton.disabled = true;
  const done = (result: JoinResult) => {
    joining = false; createButton.disabled = false; soloButton.disabled = false; joinButton.disabled = false;
    if (!result.ok) return toast(result.error);
    playerId = result.playerId; currentCode = result.room.code;
    sessionStorage.setItem(`planetfall:${currentCode}`, result.sessionToken);
    game.setLocalId(playerId);
    applyRoom(result.room);
  };
  if (kind === "solo") socket.emit("room:solo", { name }, done);
  else if (kind === "create") socket.emit("room:create", { name }, done);
  else socket.emit("room:join", { code, name, sessionToken: sessionStorage.getItem(`planetfall:${code}`) ?? undefined }, done);
}

function resumeRoom(): void {
  const sessionToken = sessionStorage.getItem(`planetfall:${currentCode}`) ?? undefined;
  socket.emit("room:join", { code: currentCode, name: currentName, sessionToken }, (result) => {
    if (!result.ok) {
      toast("Room closed.");
      currentCode = ""; playerId = ""; room = null; showScreen("home"); game.setMode("home");
      return;
    }
    playerId = result.playerId; game.setLocalId(playerId); applyRoom(result.room);
  });
}

function applyRoom(nextRoom: RoomView): void {
  const previousPhase = room?.phase;
  room = nextRoom;
  game.setRoom(nextRoom);
  if (nextRoom.phase === "lobby") {
    announcedWinner = undefined;
    if (previousPhase !== "lobby") { game.resetVisualEffects(); eventFeed.replaceChildren(); }
    showScreen("lobby"); game.setMode("lobby"); renderLobby();
  } else if (nextRoom.phase === "countdown" || nextRoom.phase === "playing" || nextRoom.phase === "overtime") {
    showScreen("hud"); game.setMode("match"); updateHud();
    if (nextRoom.phase === "countdown" && nextRoom.countdownEndsAt && previousPhase !== "countdown") runCountdown(nextRoom.countdownEndsAt);
    if (nextRoom.phase === "overtime" && previousPhase !== "overtime") toast("OVERTIME! Repairs off. Damage doubled.");
  } else if (nextRoom.phase === "results") showResults(nextRoom.winnerId, nextRoom.matchResult);
}

function renderLobby(): void {
  if (!room) return;
  byId("lobby-code").textContent = room.code;
  playerList.replaceChildren(...room.players.map((player) => {
    const row = document.createElement("div"); row.className = "player-row";
    row.style.setProperty("--player-color", player.color);
    const botBadge = player.isBot ? `<span class="bot-badge">BOT</span>` : "";
    const status = player.isBot ? "CPU PILOT" : player.id === room!.hostId ? "HOST" : player.connected ? "ONLINE" : "RECONNECTING";
    const remove = player.isBot && room!.hostId === playerId ? `<button class="remove-bot" aria-label="Remove ${escapeHtml(player.name)}">×</button>` : "";
    row.innerHTML = `<i class="player-orb" style="background:${player.color};color:${player.color}"></i><div class="player-meta"><b>${escapeHtml(player.name)}${botBadge}</b><br><small>${status}</small></div><span class="ready-badge ${player.ready ? "" : "waiting"}">${player.ready ? "READY" : "WAIT"}</span>${remove}`;
    row.querySelector<HTMLButtonElement>(".remove-bot")?.addEventListener("click", () => socket.emit("room:bot:remove", { botId: player.id }));
    return row;
  }));
  const me = room.players.find((p) => p.id === playerId);
  readyButton.textContent = me?.ready ? "Ready ✓" : "Ready";
  startButton.hidden = room.hostId !== playerId;
  addBotButton.hidden = room.hostId !== playerId || room.players.length >= BALANCE.maxPlayers;
  const waitingForReconnect = room.players.some((player) => !player.connected);
  startButton.toggleAttribute("disabled", waitingForReconnect || room.players.filter((p) => p.connected).length < BALANCE.minPlayers || !room.players.filter((p) => p.connected).every((p) => p.ready));
  byId("lobby-hint").textContent = waitingForReconnect ? "Waiting for player to reconnect" : room.players.length < 2 ? "Waiting for players" : room.hostId === playerId ? "Start when everyone is ready" : "Waiting for host";
}

function updateHud(): void {
  if (!room) return;
  const me = room.players.find((p) => p.id === playerId);
  const planet = me ? room.planets.find((p) => p.id === me.planetId) : undefined;
  const integrity = Math.round(planet?.integrity ?? 0);
  byId("health-value").textContent = String(integrity);
  const meter = byId<HTMLElement>("health-meter");
  meter.closest(".health-block")?.classList.toggle("danger", integrity <= 25);
  meter.style.width = `${integrity}%`;
  meter.style.background = integrity <= 25 ? "linear-gradient(90deg,#ff415d,#ff9b4d)" : integrity <= 50 ? "linear-gradient(90deg,#ff9b4d,#ffdc4f)" : "linear-gradient(90deg,#43e899,#70f5ff)";
  byId("scrap-value").textContent = String(me?.scrap ?? 0);
  const aliveList = byId("alive-list");
  aliveList.replaceChildren(...room.players.map((player) => {
    const chip = document.createElement("div"); chip.className = `alive-chip ${player.alive ? "" : "dead"}`;
    chip.style.color = player.color;
    chip.innerHTML = `<span>${escapeHtml(player.name)}</span>${player.isBot ? '<b class="bot-badge">BOT</b>' : ""}<i></i>`;
    return chip;
  }));
  const remaining = room.phase === "countdown" ? BALANCE.matchMs : Math.max(0, (room.matchEndsAt ?? Date.now()) - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  byId("timer").textContent = room.phase === "overtime" ? `OT ${minutes}:${seconds.toString().padStart(2, "0")}` : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  updateWeapon(game.weapon);
}

function updateWeapon(weapon: WeaponType): void {
  const config = BALANCE.weapons[weapon];
  byId("weapon-name").textContent = weapon === "rocket" ? "BASIC ROCKET" : "HEAVY ASTEROID";
  byId("weapon-cost").textContent = `${config.cost} scrap`;
  trajectoryLabel.textContent = `${weapon === "rocket" ? "ROCKET" : "ASTEROID"} · ${config.cost} SCRAP`;
  const icon = byId("weapon-button").querySelector("i")!;
  icon.setAttribute("style", weapon === "rocket" ? "" : "width:26px;height:26px;border-radius:40% 55% 45% 50%;background:#b67cff;box-shadow:0 0 12px #b67cff");
}

function runCountdown(startsAt: number): void {
  clearInterval(countdownTimer);
  countdownNumber = -1;
  showScreen("hud"); game.setMode("match");
  const tick = () => {
    const remaining = startsAt - Date.now();
    const value = remaining <= 0 ? 0 : Math.max(1, Math.ceil(remaining / 1000));
    countdown.textContent = value === 0 ? "GO!" : String(value);
    if (value !== countdownNumber) { countdownNumber = value; game.audio.countdown(value); }
    if (remaining <= -650) { countdown.textContent = ""; clearInterval(countdownTimer); }
  };
  tick(); countdownTimer = window.setInterval(tick, 80);
}

function showResults(winnerId: string | null, result: MatchResult | null = room?.matchResult ?? null): void {
  if (!room) return;
  room.winnerId = winnerId; room.phase = "results";
  showScreen("results"); game.setMode("results");
  const winner = room.players.find((p) => p.id === winnerId);
  const isMe = winnerId === playerId;
  if (announcedWinner !== winnerId) { game.audio.result(isMe); announcedWinner = winnerId; }
  byId("results-title").textContent = winner ? isMe ? "You win!" : `${winner.name} wins` : "Draw";
  byId("winner-copy").innerHTML = winner
    ? `${winner.isBot ? '<span class="bot-badge">BOT</span> ' : ""}${isMe ? "Your planet survived." : `${escapeHtml(winner.name)} held on.`}`
    : "No planets left.";
  const standings = byId("results-standings");
  const awards = byId("results-awards");
  const finalResult = result;
  const finalStats = finalResult?.stats ?? [];
  standings.replaceChildren(...(finalResult?.placements ?? []).map((placement) => {
    const player = room!.players.find((entry) => entry.id === placement.playerId);
    const stats = finalStats.find((entry) => entry.playerId === placement.playerId);
    const row = document.createElement("div"); row.className = "standing";
    row.style.setProperty("--player-color", player?.color ?? "#70f5ff");
    row.innerHTML = `<b>#${placement.place}</b><div><div class="standing-name">${escapeHtml(player?.name ?? "Pilot")}${player?.isBot ? ' <span class="bot-badge">BOT</span>' : ""}</div><div class="standing-stats">${Math.round(stats?.damageDealt ?? 0)} dmg · ${stats?.stolenScrap ?? 0} stolen · ${stats?.successfulShoves ?? 0} shoves</div></div><span class="standing-integrity">${Math.round(placement.integrity)}%</span>`;
    return row;
  }));
  awards.replaceChildren(...(finalResult?.awards ?? []).map((award) => {
    const player = room!.players.find((entry) => entry.id === award.playerId);
    const card = document.createElement("div"); card.className = "award";
    card.innerHTML = `<strong>${escapeHtml(award.title)}</strong><span style="color:${player?.color ?? "#fff"}">${escapeHtml(player?.name ?? "Pilot")}</span><small>${escapeHtml(award.subtitle)}</small>`;
    return card;
  }));
  const humans = room.players.filter((p) => p.connected && !p.isBot);
  byId("rematch-count").textContent = `${room.rematchVotes.filter((id) => humans.some((player) => player.id === id)).length} / ${humans.length} votes`;
}

function showScreen(name: keyof typeof screens): void {
  for (const [key, screen] of Object.entries(screens)) screen.classList.toggle("active", key === name);
}

function setConnection(state: "online" | "offline" | "", text: string): void {
  connectionPill.className = `connection-pill ${state}`; connectionPill.querySelector("span")!.textContent = text;
}

function toast(message: string): void {
  const element = document.createElement("div"); element.className = "toast"; element.textContent = message;
  byId("toast-region").append(element);
  setTimeout(() => element.remove(), 3200);
}

function appendMatchEvent(event: MatchEvent): void {
  if (!room) return;
  const player = (id?: string) => room!.players.find((entry) => entry.id === id);
  const actor = player(event.actorId); const target = player(event.targetId);
  const actorName = actor?.name ?? "A pilot"; const targetName = target?.name ?? "a rival";
  const message = event.type === "launch" ? `${actorName} launched to ${targetName}`
    : event.type === "stolen" ? `${actorName} stole ${targetName}'s scrap`
      : event.type === "shove" ? `${actorName} shoved ${targetName}`
        : event.type === "sabotage" ? `${actorName} jammed ${targetName}'s ${event.structure === "cannon" ? "cannon" : "repair"}`
          : event.type === "damage" ? `${actorName} hit ${targetName} for ${Math.round(event.amount ?? 0)}%`
            : `${actorName} destroyed ${targetName}`;
  const row = document.createElement("div"); row.className = "feed-event"; row.textContent = message;
  row.style.setProperty("--event-color", actor?.color ?? "#70f5ff");
  eventFeed.prepend(row);
  while (eventFeed.children.length > 4) eventFeed.lastElementChild?.remove();
  setTimeout(() => row.classList.add("leaving"), 4100);
  setTimeout(() => row.remove(), 4600);
}

function showHint(id: string, text: string): void {
  const key = `planetfall:hint:${id}:v1`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, "seen");
  clearTimeout(hintTimer);
  matchHint.textContent = text;
  matchHint.classList.add("visible");
  hintTimer = window.setTimeout(() => matchHint.classList.remove("visible"), 3600);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}

setInterval(() => { if (room && (room.phase === "playing" || room.phase === "overtime")) updateHud(); }, 250);
