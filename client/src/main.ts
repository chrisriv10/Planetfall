import "./style.css";
import { BALANCE, type JoinResult, type RoomView, type WeaponType } from "@planetfall/shared";
import { PlanetfallGame } from "./game";
import { createGameSocket } from "./network";

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = byId<HTMLCanvasElement>("game-canvas");
const game = new PlanetfallGame(canvas);
const socket = createGameSocket();

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
const trajectoryLabel = byId("trajectory");
const countdown = byId("countdown");

let room: RoomView | null = null;
let playerId = "";
let currentCode = "";
let currentName = "";
let joining = false;
let countdownTimer = 0;
let countdownNumber = -1;
let announcedWinner: string | null | undefined;

nameInput.value = localStorage.getItem("planetfall:name") ?? "";

await game.init();
showScreen("home");

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
socket.on("scrap:collected", (payload) => game.collectScrap(payload));
socket.on("planet:damaged", ({ planetId, hit, integrity }) => { game.damagePlanet(planetId, hit, integrity); updateHud(); });
socket.on("planet:repaired", (payload) => game.repairPlanet(payload));
socket.on("planet:destroyed", ({ planetId }) => game.destroyPlanet(planetId));
socket.on("match:ended", ({ winnerId }) => showResults(winnerId));

game.onInput = (input) => socket.emit("player:input", input);
game.onFire = (weapon, direction) => socket.emit("cannon:fire", { weapon, direction });
game.onRepair = () => socket.emit("repair:buy");
game.onWeaponChange = updateWeapon;
game.onPrompt = (text, aiming) => {
  contextPrompt.textContent = text;
  trajectoryLabel.style.opacity = aiming ? "1" : "0";
};

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
    if (previousPhase !== "lobby") game.resetVisualEffects();
    showScreen("lobby"); game.setMode("lobby"); renderLobby();
  } else if (nextRoom.phase === "countdown" || nextRoom.phase === "playing" || nextRoom.phase === "overtime") {
    showScreen("hud"); game.setMode("match"); updateHud();
    if (nextRoom.phase === "countdown" && nextRoom.countdownEndsAt && previousPhase !== "countdown") runCountdown(nextRoom.countdownEndsAt);
    if (nextRoom.phase === "overtime" && previousPhase !== "overtime") toast("OVERTIME! Repairs off. Damage doubled.");
  } else if (nextRoom.phase === "results") showResults(nextRoom.winnerId);
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
  startButton.toggleAttribute("disabled", room.players.filter((p) => p.connected).length < BALANCE.minPlayers || !room.players.filter((p) => p.connected).every((p) => p.ready));
  byId("lobby-hint").textContent = room.players.length < 2 ? "Waiting for players" : room.hostId === playerId ? "Start when everyone is ready" : "Waiting for host";
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

function showResults(winnerId: string | null): void {
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}

setInterval(() => { if (room && (room.phase === "playing" || room.phase === "overtime")) updateHud(); }, 250);
