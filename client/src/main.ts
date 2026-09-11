import "./style.css";
import { BALANCE, BR_MAP, BR_POIS, BR_ROADS, BR_SECONDARY_LOCATIONS, BR_WEAPONS, CHAOS_COPY, PLANET_PASS_REWARDS, SESSION_PROGRESSION, SHOP_CATALOG, WEAPON_COPY, WEAPON_ORDER, isBrWeapon, type BotDifficulty, type BrCrateState, type BrJoinResult, type BrLootState, type BrMatchResult, type BrRoomView, type BrTeamMode, type ChaosModifier, type CosmeticCategory, type GameFamily, type GameMode, type JoinResult, type MatchCalloutType, type MatchEvent, type MatchResult, type RoomView, type WeaponType } from "@planetfall/shared";
import { createGameSocket } from "./network";
import { inputLabel, type InputMethod } from "./input";
import { SETTINGS_STORAGE_KEY, parseStoredSettings, type UserSettings } from "./settings";

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = byId<HTMLCanvasElement>("game-canvas");
const screens = {
  home: byId("home-screen"), lobby: byId("lobby-screen"), hud: byId("hud"), results: byId("results-screen"),
  brLobby: byId("br-lobby-screen"), brHud: byId("br-hud"), brResults: byId("br-results-screen")
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
const modeClassicButton = byId<HTMLButtonElement>("mode-classic");
const modeChaosButton = byId<HTMLButtonElement>("mode-chaos");
const modifierChip = byId("modifier-chip");
const modifierReveal = byId("modifier-reveal");
const settingsOpenButton = byId<HTMLButtonElement>("settings-open");
const settingsOverlay = byId<HTMLElement>("settings-overlay");
const settingsCloseButton = byId<HTMLButtonElement>("settings-close");
const pauseOverlay = byId<HTMLElement>("pause-overlay");
const pauseButton = byId<HTMLButtonElement>("pause-button");
const resumeButton = byId<HTMLButtonElement>("resume-button");
const pauseSettingsButton = byId<HTMLButtonElement>("pause-settings");
const pauseLeaveButton = byId<HTMLButtonElement>("pause-leave");
const controlHelp = byId("control-help");
const pauseControls = byId("pause-controls");
const homeControls = byId("home-controls");
const mouseSensitivity = byId<HTMLInputElement>("mouse-sensitivity");
const controllerSensitivity = byId<HTMLInputElement>("controller-sensitivity");
const invertY = byId<HTMLInputElement>("invert-y");
const musicVolume = byId<HTMLInputElement>("music-volume");
const sfxVolume = byId<HTMLInputElement>("sfx-volume");
const cameraShake = byId<HTMLSelectElement>("camera-shake");
const graphicsQuality = byId<HTMLSelectElement>("graphics-quality");
const botDifficultyButtons: Record<BotDifficulty, HTMLButtonElement> = {
  easy: byId("bot-easy"), normal: byId("bot-normal"), hard: byId("bot-hard")
};
const shopOverlay = byId<HTMLElement>("shop-overlay");
const shopGrid = byId("shop-grid");
const shopCategories = byId("shop-categories");
const shopNote = byId<HTMLElement>("shop-note");
const shopHomeButton = byId<HTMLButtonElement>("shop-home");
const passOverlay = byId<HTMLElement>("pass-overlay");
const leaderboard = byId<HTMLElement>("match-leaderboard");
const leaderboardList = byId("leaderboard-list");
const majorCallout = byId("major-callout");
const warpTransition = byId("warp-transition");
const emoteWheel = byId<HTMLElement>("emote-wheel");
const familyPlanetfallButton = byId<HTMLButtonElement>("family-planetfall");
const familyBrButton = byId<HTMLButtonElement>("family-br");
const brReadyButton = byId<HTMLButtonElement>("br-ready-button");
const brStartButton = byId<HTMLButtonElement>("br-start-button");
const brPlayerTarget = byId<HTMLSelectElement>("br-player-target");
const brFillBots = byId<HTMLInputElement>("br-fill-bots");
const brTeamList = byId("br-team-list");
const brMapOverlay = byId<HTMLElement>("br-map-overlay");
let shopCategory: CosmeticCategory = "suit";
createButton.disabled = true; soloButton.disabled = true; joinButton.disabled = true; settingsOpenButton.disabled = true; shopHomeButton.disabled = true;
nameInput.value = nameInput.value || localStorage.getItem("planetfall:name") || "";

const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let settings = parseStoredSettings(localStorage.getItem(SETTINGS_STORAGE_KEY), prefersReducedMotion);

const socket = createGameSocket();
const { PlanetfallGame } = await import("./game");
const game = new PlanetfallGame(canvas);
game.setSettings(settings);

type BrGame = import("./modes/battle-royale/br-game").BattleRoyaleGame;
let brGame: BrGame | null = null;
let brGamePromise: Promise<BrGame> | null = null;
let brRoom: BrRoomView | null = null;
let selectedFamily: GameFamily = "planetfall";
let currentFamily: GameFamily = "planetfall";
let pendingBrLoot: BrLootState[] = [];
let pendingBrCrates: BrCrateState[] = [];

let room: RoomView | null = null;
let playerId = "";
let currentCode = "";
let currentName = "";
let joining = false;
let countdownTimer = 0;
let countdownNumber = -1;
let announcedWinner: string | null | undefined;
let hintTimer = 0;
let controlsTimer = 0;
let currentScreen: keyof typeof screens = "home";
let settingsReturn: "pause" | "screen" = "screen";
const indicatorNodes = new Map<string, HTMLElement>();
const leaderboardNodes = new Map<string, HTMLElement>();
let leaderboardExpanded = false;
let lastMinuteCue = 0;
let brInventoryMarkup = "";
let brTeammateMarkup = "";
let lastBrMapRenderAt = 0;
const brMiniTeammates = new Map<string, HTMLElement>();

await game.init();
addEventListener("pointerdown", () => game.audio.unlock(), { once: true, capture: true });
addEventListener("keydown", () => game.audio.unlock(), { once: true, capture: true });
if (import.meta.env.DEV) Object.defineProperty(window, "__PLANETFALL_DEBUG__", { value: () => game.debugState(), configurable: true });
showScreen("home");
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
  const accepted = game.applySnapshot(snapshot);
  if (accepted && room) {
    room.players = snapshot.players; room.planets = snapshot.planets; room.scraps = snapshot.scraps;
    room.phase = snapshot.phase; room.matchEndsAt = snapshot.matchEndsAt;
    updateHud();
  }
});
socket.on("match:countdown", ({ startsAt, modifier }) => {
  if (currentFamily !== "planetfall") return;
  runCountdown(startsAt);
  if (modifier) revealModifier(modifier);
});
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
socket.on("player:bumped", (payload) => game.bumpPlayer(payload));
socket.on("player:emote", (payload) => game.playEmote(payload));
socket.on("player:tethered", (payload) => game.playerTethered(payload));
socket.on("social:high-five", (payload) => game.playHighFive(payload));
socket.on("structure:sabotaged", (payload) => {
  game.sabotageStructure(payload);
  const label = payload.structure === "cannon" ? "Cannon" : "Repair core";
  if (payload.playerId === playerId) toast(`${label} jammed`);
  else if (payload.ownerId === playerId) toast(`${label.toUpperCase()} JAMMED`);
});
socket.on("structure:sabotage-cancelled", ({ playerId: cancelledId }) => game.cancelSabotage(cancelledId));
socket.on("planet:damaged", ({ planetId, hit, integrity }) => { game.damagePlanet(planetId, hit, integrity); updateHud(); });
socket.on("planet:repaired", (payload) => game.repairPlanet(payload));
socket.on("utility:purchased", (payload) => {
  game.utilityPurchased(payload);
  if (payload.playerId === playerId) toast(payload.utility === "shield" ? "SHIELD ACTIVE" : payload.utility === "overcharge" ? "CANNON OVERCHARGED" : "LAUNCH BOOST READY");
});
socket.on("planet:destroyed", ({ planetId }) => game.destroyPlanet(planetId));
socket.on("match:event", (event) => appendMatchEvent(event));
socket.on("match:stat", (stats) => {
  if (!room) return;
  const index = room.matchStats.findIndex((entry) => entry.playerId === stats.playerId);
  if (index >= 0) room.matchStats[index] = stats;
  else room.matchStats.push(stats);
  renderLeaderboard();
});
socket.on("match:callout", ({ type }) => showMajorCallout(type));
socket.on("match:ended", ({ winnerId, result }) => {
  if (room) {
    room.matchResult = result;
    room.winStreak = result.winStreak;
    for (const crown of result.crowns) {
      const player = room.players.find((entry) => entry.id === crown.playerId);
      if (player) player.crowns = crown.crowns;
    }
    for (const reward of result.fallbucks) {
      const player = room.players.find((entry) => entry.id === reward.playerId);
      if (player) player.fallbucks = reward.balance;
    }
    for (const progress of result.progression) {
      const player = room.players.find((entry) => entry.id === progress.playerId);
      if (!player) continue;
      player.sessionLevel = progress.level;
      player.sessionXp = progress.xp;
      player.sessionTotalXp = progress.totalXp;
      player.unlockedPassRewards = [...new Set([...player.unlockedPassRewards, ...progress.rewards.map((reward) => reward.id)])];
      for (const reward of progress.rewards) {
        if (reward.cosmeticId && !player.ownedCosmetics.includes(reward.cosmeticId)) player.ownedCosmetics.push(reward.cosmeticId);
        if (reward.badge) player.lobbyBadge = reward.badge;
      }
    }
  }
  showResults(winnerId, result);
});

socket.on("br:error", ({ message }) => toast(message));
socket.on("br:room:state", (nextRoom) => { void applyBrRoom(nextRoom); });
socket.on("br:match:snapshot", (snapshot) => { if(currentFamily==="battle-royale")brGame?.applySnapshot(snapshot); });
socket.on("br:match:countdown", () => { if(currentFamily==="battle-royale")toast("BATTLE ROYALE · ORBITAL ISLE"); });
socket.on("br:loot:spawned", (loot) => { if (brGame) brGame.spawnLoot(loot); else pendingBrLoot.push(...loot); });
socket.on("br:loot:removed", ({ ids }) => brGame?.removeLoot(ids));
socket.on("br:crate:spawned", (crates) => { if (brGame) brGame.spawnCrates(crates); else pendingBrCrates.push(...crates); });
socket.on("br:crate:opened", ({ crateId, drops }) => brGame?.openCrate(crateId, drops));
socket.on("br:weapon:fired", (payload) => brGame?.weaponFired(payload));
socket.on("br:player:damaged", (payload) => brGame?.damaged(payload));
socket.on("br:player:downed", ({ playerId: targetId }) => appendBrFeed(`${brName(targetId)} was knocked`, "#ffd84d"));
socket.on("br:player:revived", ({ playerId: targetId, reviverId }) => appendBrFeed(`${brName(reviverId)} revived ${brName(targetId)}`, "#63ef8b"));
socket.on("br:player:eliminated", ({ playerId: targetId, attackerId, weaponId }) => { brGame?.eliminated(targetId); appendBrFeed(`${attackerId ? brName(attackerId) : "THE VOID"} eliminated ${brName(targetId)}${weaponId ? ` with ${BR_WEAPONS[weaponId].name}` : ""}`, "#ff6b8a"); });
socket.on("br:kill-feed", () => undefined);
socket.on("br:ping", ({ playerId: sourceId, position }) => { const source = brRoom?.players.find((player) => player.id === sourceId); brGame?.showPing(source?.name ?? "Pilot", position, source?.color ?? "#70f5ff"); showBrPing(brName(sourceId), position); });
socket.on("br:emote", ({ playerId: sourceId, emote, startedAt }) => brGame?.playEmote(sourceId, emote, startedAt));
socket.on("br:match:ended", (result) => showBrResults(result));

game.onInput = (input) => socket.emit("player:input", input);
game.onFire = (weapon, direction) => socket.emit("cannon:fire", { weapon, direction });
game.onRepair = () => socket.emit("repair:buy");
game.onInteract = (interaction) => socket.emit("player:interact", interaction);
game.onWeaponChange = updateWeapon;
game.onEmote = (emote, direction) => socket.emit("player:emote", { emote, direction });
game.onEmoteMenu = (open, selected) => {
  emoteWheel.hidden = !open;
  byId("emote-name").textContent = selected.toUpperCase();
  emoteWheel.querySelector("kbd")!.textContent = inputLabel("emote", game.getInputMethod());
};
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
game.onInputMethod = (method) => renderInputUi(method);
game.onMenuNavigate = (action) => navigateUi(action);
game.onPauseRequest = () => togglePause();
game.onLeaderboard = (expanded) => {
  leaderboardExpanded = expanded;
  leaderboard.classList.toggle("expanded", expanded);
};

settingsOpenButton.addEventListener("click", () => openSettings("screen"));
settingsCloseButton.addEventListener("click", closeSettings);
pauseButton.addEventListener("click", () => togglePause(true));
resumeButton.addEventListener("click", closePause);
pauseSettingsButton.addEventListener("click", () => openSettings("pause"));
pauseLeaveButton.addEventListener("click", () => location.reload());
for (const control of [mouseSensitivity, controllerSensitivity, invertY, musicVolume, sfxVolume, cameraShake, graphicsQuality]) {
  control.addEventListener("input", updateSettingsFromUi);
  control.addEventListener("change", updateSettingsFromUi);
}
hydrateSettings();
renderInputUi(game.getInputMethod());

familyPlanetfallButton.addEventListener("click", () => selectFamily("planetfall"));
familyBrButton.addEventListener("click", () => selectFamily("battle-royale"));

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
startButton.addEventListener("click", () => {
  game.audio.click();
  warpTransition.classList.add("active");
  window.setTimeout(() => warpTransition.classList.remove("active"), 1050);
  window.setTimeout(() => socket.emit("match:start"), 380);
});
addBotButton.addEventListener("click", () => { game.audio.click(); socket.emit("room:bot:add"); });
modeClassicButton.addEventListener("click", () => setGameMode("classic"));
modeChaosButton.addEventListener("click", () => setGameMode("chaos"));
for (const [difficulty, button] of Object.entries(botDifficultyButtons) as [BotDifficulty, HTMLButtonElement][]) {
  button.addEventListener("click", () => {
    if (room?.hostId === playerId && room.phase === "lobby") socket.emit("room:bot:difficulty", { difficulty });
  });
}
byId("shop-lobby").addEventListener("click", openShop);
byId("shop-results").addEventListener("click", openShop);
shopHomeButton.addEventListener("click", openShop);
byId("shop-close").addEventListener("click", closeShop);
byId("pass-lobby").addEventListener("click", openPass);
byId("pass-results").addEventListener("click", openPass);
byId("pass-close").addEventListener("click", closePass);
byId("settings-lobby").addEventListener("click", () => openSettings("screen"));
addEventListener("keydown", (event) => {
  if (event.key !== "Tab" || currentScreen !== "hud" || isEditableTarget(event.target)) return;
  event.preventDefault(); leaderboardExpanded = true; leaderboard.classList.add("expanded");
});
addEventListener("keyup", (event) => {
  if (event.key !== "Tab") return;
  leaderboardExpanded = false; leaderboard.classList.remove("expanded");
});
copyButton.addEventListener("click", async () => {
  if (!room) return;
  try { await navigator.clipboard.writeText(room.code); toast("Room code copied!"); }
  catch { toast(`Room code: ${room.code}`); }
});
byId("weapon-button").addEventListener("click", () => {
  game.weapon = WEAPON_ORDER[(WEAPON_ORDER.indexOf(game.weapon) + 1) % WEAPON_ORDER.length];
  updateWeapon(game.weapon); game.audio.click();
});
byId("rematch-button").addEventListener("click", () => { socket.emit("match:rematch"); game.audio.click(); });
byId("leave-button").addEventListener("click", () => location.reload());
brReadyButton.addEventListener("click", () => {
  const me = brRoom?.players.find((player) => player.id === playerId); if (me) socket.emit("br:room:ready", { ready: !me.ready });
});
brStartButton.addEventListener("click", () => socket.emit("br:match:start"));
for (const button of byId("br-team-mode").querySelectorAll<HTMLButtonElement>("button[data-team]")) button.addEventListener("click", () => configureBr({ teamMode: button.dataset.team as BrTeamMode }));
brPlayerTarget.addEventListener("change", () => configureBr({ targetPlayers: Number(brPlayerTarget.value) as 10 | 20 | 40 }));
brFillBots.addEventListener("change", () => configureBr({ fillBots: brFillBots.checked }));
for (const button of byId("br-bot-difficulty").querySelectorAll<HTMLButtonElement>("button[data-difficulty]")) button.addEventListener("click", () => configureBr({ botDifficulty: button.dataset.difficulty as BotDifficulty }));
byId("br-copy-code").addEventListener("click", () => copyRoomCode(brRoom?.code));
byId("br-shop-lobby").addEventListener("click", openShop);
byId("br-pass-lobby").addEventListener("click", openPass);
byId("br-settings-lobby").addEventListener("click", () => openSettings("screen"));
byId("br-map-button").addEventListener("click", () => toggleBrMap(true));
byId("br-map-close").addEventListener("click", () => toggleBrMap(false));
byId("br-return-lobby").addEventListener("click", () => socket.emit("br:match:return"));
byId("br-shop-results").addEventListener("click", openShop);
byId("br-leave").addEventListener("click", () => location.reload());
familyPlanetfallButton.disabled = false; familyBrButton.disabled = false;
createButton.disabled = false; soloButton.disabled = false; joinButton.disabled = false; settingsOpenButton.disabled = false; shopHomeButton.disabled = false;

function selectFamily(family: GameFamily): void {
  selectedFamily = family;
  familyPlanetfallButton.classList.toggle("selected", family === "planetfall"); familyBrButton.classList.toggle("selected", family === "battle-royale");
  byId("home-intro").textContent = family === "planetfall" ? "Last planet standing wins." : "Drop onto Orbital Isle. Loot up. Be the last crew standing.";
  soloButton.innerHTML = family === "planetfall" ? '<span class="button-icon">▶</span> Play Solo' : '<span class="button-icon">▼</span> BR Solo + Bots';
  createButton.textContent = family === "planetfall" ? "Create Room" : "Create BR Room";
  renderInputUi(game.getInputMethod());
}

async function copyRoomCode(code?: string): Promise<void> {
  if (!code) return;
  try { await navigator.clipboard.writeText(code); toast("Room code copied!"); } catch { toast(`Room code: ${code}`); }
}

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
  if (selectedFamily === "battle-royale") {
    const doneBr = (result: BrJoinResult) => {
      joining = false; createButton.disabled = false; soloButton.disabled = false; joinButton.disabled = false;
      if (!result.ok) return toast(result.error);
      currentFamily = "battle-royale"; playerId = result.playerId; currentCode = result.room.code; brRoom = result.room;
      sessionStorage.setItem(`planetfall:br:${currentCode}`, result.sessionToken);
      void applyBrRoom(result.room);
      if (kind === "solo") {
        socket.emit("br:room:configure", { teamMode: "solo", targetPlayers: 10, fillBots: true, botDifficulty: "normal" });
        socket.emit("br:room:ready", { ready: true });
        socket.emit("br:match:start");
      }
    };
    if (kind === "join") socket.emit("br:room:join", { code, name, sessionToken: sessionStorage.getItem(`planetfall:br:${code}`) ?? undefined }, doneBr);
    else socket.emit("br:room:create", { name }, doneBr);
    return;
  }
  const done = (result: JoinResult) => {
    joining = false; createButton.disabled = false; soloButton.disabled = false; joinButton.disabled = false;
    if (!result.ok) return toast(result.error);
    currentFamily = "planetfall"; playerId = result.playerId; currentCode = result.room.code;
    sessionStorage.setItem(`planetfall:${currentCode}`, result.sessionToken);
    game.setLocalId(playerId);
    applyRoom(result.room);
  };
  if (kind === "solo") socket.emit("room:solo", { name }, done);
  else if (kind === "create") socket.emit("room:create", { name }, done);
  else socket.emit("room:join", { code, name, sessionToken: sessionStorage.getItem(`planetfall:${code}`) ?? undefined }, done);
}

function resumeRoom(): void {
  if (currentFamily === "battle-royale") {
    const sessionToken = sessionStorage.getItem(`planetfall:br:${currentCode}`) ?? undefined;
    socket.emit("br:room:join", { code: currentCode, name: currentName, sessionToken }, (result) => {
      if (!result.ok) {
        toast("Room closed.");
        currentCode = ""; playerId = ""; brRoom = null; currentFamily = "planetfall";
        brGame?.deactivate(); brGame?.reset(); showBrMap(false);
        showScreen("home"); game.setActive(true); game.setMode("home");
        return;
      }
      playerId = result.playerId; void applyBrRoom(result.room);
    });
    return;
  }
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
  currentFamily = "planetfall";
  brGame?.deactivate();
  showBrMap(false);
  game.setActive(true);
  room = nextRoom;
  game.setRoom(nextRoom);
  if (nextRoom.phase === "lobby") {
    announcedWinner = undefined;
    lastMinuteCue = 0;
    game.audio.setUrgency(0);
    if (previousPhase !== "lobby") { game.resetVisualEffects(); eventFeed.replaceChildren(); }
    showScreen("lobby"); game.setMode("lobby"); renderLobby();
    if (!shopOverlay.hidden) renderShop();
    if (!passOverlay.hidden) renderPass();
  } else if (nextRoom.phase === "countdown" || nextRoom.phase === "playing" || nextRoom.phase === "overtime") {
    showScreen("hud"); game.setMode("match"); updateHud();
    if (nextRoom.phase === "countdown" && nextRoom.countdownEndsAt && previousPhase !== "countdown") runCountdown(nextRoom.countdownEndsAt);
    if (nextRoom.phase === "overtime" && previousPhase !== "overtime") toast("OVERTIME! Repairs off. Damage doubled.");
  } else if (nextRoom.phase === "results") {
    game.audio.setUrgency(0);
    showResults(nextRoom.winnerId, nextRoom.matchResult);
    if (!shopOverlay.hidden) renderShop();
    if (!passOverlay.hidden) renderPass();
  }
}

async function ensureBrGame(nextRoom: BrRoomView): Promise<BrGame> {
  if (!brGamePromise) brGamePromise = import("./modes/battle-royale/br-game").then(({ BattleRoyaleGame }) => {
    game.setActive(false);
    const instance = new BattleRoyaleGame(canvas, game.renderer, game.getInputController(), game.audio, settings);
    instance.onInput = (input) => socket.emit("br:player:input", input);
    instance.onJumpShip = () => socket.emit("br:player:jump");
    instance.onDeploy = () => socket.emit("br:player:deploy");
    instance.onFire = (origin, direction, clientTime) => socket.emit("br:weapon:fire", { origin, direction, clientTime });
    instance.onReload = () => socket.emit("br:weapon:reload");
    instance.onUseItem = () => socket.emit("br:item:use");
    instance.onPickup = (lootId, replaceSlot) => socket.emit("br:inventory:pickup", { lootId, replaceSlot });
    instance.onOpenCrate = (crateId) => socket.emit("br:crate:open", { crateId });
    instance.onSelectSlot = (slot) => socket.emit("br:inventory:select", { slot });
    instance.onRevive = (targetId, active) => socket.emit("br:revive", { targetId, active });
    instance.onSpectateCycle = (direction) => socket.emit("br:spectate:cycle", { direction });
    instance.onPing = (position) => socket.emit("br:ping", { type: "location", position });
    instance.onEmote = (emote, direction) => socket.emit("br:emote", { emote, direction });
    instance.onHud = renderBrHud;
    instance.onInputMethod = renderInputUi;
    instance.onPause = () => togglePause();
    instance.onMap = (visible) => showBrMap(visible);
    instance.onMenuNavigate = navigateUi;
    brGame = instance;
    if (import.meta.env.DEV) {
      Object.defineProperty(window, "__PLANETFALL_BR_DEBUG__", { value: () => instance.debugState(), configurable: true });
      Object.defineProperty(window, "__PLANETFALL_BR_VIEW__", { value: (poiId: string | null) => instance.setDebugView(poiId), configurable: true });
    }
    return instance;
  });
  const instance = await brGamePromise;
  game.setActive(false);
  instance.activate(nextRoom, playerId);
  if (pendingBrLoot.length) { instance.spawnLoot(pendingBrLoot); pendingBrLoot = []; }
  if (pendingBrCrates.length) { instance.spawnCrates(pendingBrCrates); pendingBrCrates = []; }
  return instance;
}

async function applyBrRoom(nextRoom: BrRoomView): Promise<void> {
  const previousBrPhase = brRoom?.phase;
  brRoom = nextRoom; currentFamily = "battle-royale";
  modifierReveal.classList.remove("visible"); countdown.textContent = ""; leaderboard.classList.remove("visible");
  renderInputUi(brGame?.getInputMethod() ?? game.getInputMethod());
  if (nextRoom.phase === "lobby") {
    if (brGame && previousBrPhase && previousBrPhase !== "lobby") brGame.reset(); pendingBrLoot = []; pendingBrCrates = []; byId("br-kill-feed").replaceChildren(); brInventoryMarkup = ""; brTeammateMarkup = ""; for (const node of brMiniTeammates.values()) node.remove(); brMiniTeammates.clear(); game.setActive(false); showScreen("brLobby"); const instance = await ensureBrGame(nextRoom); instance.setRoom(nextRoom); renderBrLobby();
    if (!shopOverlay.hidden) renderShop(); if (!passOverlay.hidden) renderPass();
    return;
  }
  if (nextRoom.phase === "results") { const instance = await ensureBrGame(nextRoom); instance.setRoom(nextRoom); if (nextRoom.matchResult) showBrResults(nextRoom.matchResult); return; }
  showScreen("brHud");
  const instance = await ensureBrGame(nextRoom); instance.setRoom(nextRoom);
}

function renderBrLobby(): void {
  if (!brRoom) return;
  byId("br-lobby-code").textContent = brRoom.code;
  const isHost = brRoom.hostId === playerId;
  byId("br-team-mode").querySelectorAll<HTMLButtonElement>("button[data-team]").forEach((button) => { button.classList.toggle("selected", button.dataset.team === brRoom!.teamMode); button.disabled = !isHost; });
  byId("br-bot-difficulty").querySelectorAll<HTMLButtonElement>("button[data-difficulty]").forEach((button) => { button.classList.toggle("selected", button.dataset.difficulty === brRoom!.botDifficulty); button.disabled = !isHost; });
  brPlayerTarget.value = String(brRoom.targetPlayers); brPlayerTarget.disabled = !isHost; brFillBots.checked = brRoom.fillBots; brFillBots.disabled = !isHost;
  brTeamList.replaceChildren(...brRoom.teams.map((team, index) => {
    const card = document.createElement("article"); card.className = "br-team"; card.style.setProperty("--team-color", ["#70f5ff", "#ff6b8a", "#ffd84d", "#9d7bff"][index % 4]);
    const members = team.playerIds.map((id) => brRoom!.players.find((player) => player.id === id)).filter(Boolean);
    card.innerHTML = `<header><span>CREW ${index + 1}</span><small>${members.length} PILOT${members.length === 1 ? "" : "S"}</small></header>${members.map((player) => `<div class="br-member" style="--member-color:${player!.color}"><i></i><span>${escapeHtml(player!.name)}${player!.isBot ? " · BOT" : ""}</span><small>${player!.ready ? "READY" : "WAIT"}</small></div>`).join("")}`;
    return card;
  }));
  const me = brRoom.players.find((player) => player.id === playerId); brReadyButton.textContent = me?.ready ? "Ready ✓" : "Ready"; brStartButton.hidden = !isHost;
  byId("br-lobby-fallbucks").textContent = String(me?.fallbucks ?? 0); byId("br-lobby-level").textContent = `LEVEL ${me?.sessionLevel ?? 1}`;
  brStartButton.disabled = !brRoom.players.filter((player) => !player.isBot && player.connected).every((player) => player.ready);
  byId("br-lobby-hint").textContent = `${brRoom.players.length} / ${brRoom.targetPlayers} joined${brRoom.fillBots ? " · bots fill on start" : ""}`;
}

function configureBr(payload: { teamMode?: BrTeamMode; targetPlayers?: 10 | 20 | 40; fillBots?: boolean; botDifficulty?: BotDifficulty }): void {
  if (brRoom?.hostId === playerId && brRoom.phase === "lobby") socket.emit("br:room:configure", payload);
}

function renderBrHud(state: import("./modes/battle-royale/br-game").BrHudState): void {
  const { player } = state;
  byId("br-players-remaining").textContent = `${state.playersRemaining} PLAYERS`; byId("br-teams-remaining").textContent = `${state.teamsRemaining} TEAMS`; byId("br-elims").textContent = `${player.kills} ELIMS`;
  byId("br-hp").textContent = String(Math.ceil(player.hp)); byId("br-shield").textContent = String(Math.ceil(player.shield)); byId<HTMLElement>("br-hp-meter").style.width = `${player.hp}%`; byId<HTMLElement>("br-shield-meter").style.width = `${player.shield}%`;
  const seconds = state.storm.stageEndsAt ? Math.max(0, Math.ceil((state.storm.stageEndsAt - Date.now()) / 1000)) : 0; byId("br-storm-timer").textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; byId("br-storm-copy").textContent = state.storm.stage === "closing" ? "VOID CLOSING" : "VOID STORM";
  const mini = byId("br-minimap"); const miniStorm = mini.querySelector<HTMLElement>(".br-mini-storm")!; const span = 110; miniStorm.style.left = `${50 + (state.storm.center.x - player.position.x) / span * 50}%`; miniStorm.style.top = `${50 + (state.storm.center.z - player.position.z) / span * 50}%`; miniStorm.style.width = `${state.storm.radius / span * 100}%`; miniStorm.style.height = miniStorm.style.width;
  const teamMembers = state.players.filter((entry) => entry.teamId === player.teamId && entry.id !== player.id);
  const teammates = teamMembers.filter((entry) => entry.alive);
  const activeMiniIds = new Set(teammates.map((entry) => entry.id));
  for (const [id, node] of brMiniTeammates) if (!activeMiniIds.has(id)) { node.remove(); brMiniTeammates.delete(id); }
  for (const teammate of teammates) {
    let node = brMiniTeammates.get(teammate.id);
    if (!node) { node = document.createElement("i"); node.className = "br-mini-teammate"; mini.append(node); brMiniTeammates.set(teammate.id, node); }
    node.style.left = `${Math.max(4, Math.min(96, 50 + (teammate.position.x - player.position.x) / span * 50))}%`;
    node.style.top = `${Math.max(4, Math.min(96, 50 + (teammate.position.z - player.position.z) / span * 50))}%`;
    node.style.setProperty("--mate-color", teammate.color);
  }
  byId("br-context-copy").textContent = state.prompt || (document.pointerLockElement === canvas ? "" : "CLICK THE ARENA TO TAKE CONTROL"); byId<HTMLElement>("br-context-progress").style.width = `${Math.max(state.reloadProgress, state.useProgress) * 100}%`;
  const inventory = byId("br-inventory"); const nextInventoryMarkup = player.inventory.map((item, index) => {
    const color = item ? ({ common: "#b8c4dc", rare: "#54b8ff", epic: "#c565ff", legendary: "#ffc84f" }[item.rarity]) : "#56617f";
    const name = item ? isBrWeapon(item.itemId) ? BR_WEAPONS[item.itemId].name : item.itemId.replaceAll("-", " ").toUpperCase() : "EMPTY"; const ammo = item && isBrWeapon(item.itemId) ? item.itemId === "energy-saber" ? "∞" : `${item.magazine} / ${BR_WEAPONS[item.itemId].ammo ? player.ammo[BR_WEAPONS[item.itemId].ammo!] : 0}` : item ? `×${item.count}` : "";
    const icon = item ? isBrWeapon(item.itemId) ? item.itemId : item.itemId.startsWith("shield") ? "shield" : "heal" : "empty";
    return `<div class="br-slot${index === player.selectedSlot ? " selected" : ""}" data-item="${icon}" style="--slot-color:${color}"><i aria-hidden="true"></i><b>${index + 1} · ${name}</b><small>${ammo}</small></div>`;
  }).join("");
  if (nextInventoryMarkup !== brInventoryMarkup) { brInventoryMarkup = nextInventoryMarkup; inventory.innerHTML = nextInventoryMarkup; }
  const nextTeammateMarkup = teamMembers.map((mate) => `<div class="br-teammate" style="--mate-color:${mate.color}"><b>${escapeHtml(mate.name)}</b><span>${mate.downed ? "DOWN" : mate.alive ? `${Math.ceil(mate.hp)} HP` : "OUT"}</span><small>${Math.ceil(mate.shield)} SHIELD</small></div>`).join("");
  if (nextTeammateMarkup !== brTeammateMarkup) { brTeammateMarkup = nextTeammateMarkup; byId("br-team-hud").innerHTML = nextTeammateMarkup; }
  const now = performance.now(); if (!brMapOverlay.hidden && now - lastBrMapRenderAt > 120) { lastBrMapRenderAt = now; renderBrMap(player); }
}

function showBrResults(result: BrMatchResult): void {
  showScreen("brResults"); brRoom && (brRoom.matchResult = result);
  const me = result.players.find((entry) => entry.playerId === playerId); const won = me?.placement === 1;
  byId("br-results-title").textContent = won ? "LAST CREW STANDING" : "CREW ELIMINATED"; byId("br-placement").textContent = `${ordinal(me?.placement ?? result.players.length)} PLACE`;
  const stats = [[me?.kills ?? 0, "ELIMINATIONS"], [Math.round(me?.damage ?? 0), "DAMAGE"], [me?.revives ?? 0, "REVIVES"], [`+${me?.xp ?? 0}`, "SESSION XP"], [`+${me?.fallbucks ?? 0}`, "FALLBUCKS"]] as const;
  byId("br-results-stats").innerHTML = stats.map(([value, label]) => `<div class="br-result-stat"><b>${value}</b><span>${label}</span></div>`).join("");
  const humans = brRoom?.players.filter((player) => !player.isBot && player.connected).length ?? 1;
  const votes = brRoom?.returnVotes.length ?? 0;
  byId<HTMLButtonElement>("br-return-lobby").textContent = brRoom?.returnVotes.includes(playerId) ? `${votes} / ${humans} READY` : `RETURN TO LOBBY · ${votes} / ${humans}`;
  byId<HTMLButtonElement>("br-return-lobby").disabled = Boolean(brRoom?.returnVotes.includes(playerId));
}

function appendBrFeed(message: string, color: string): void { const row = document.createElement("div"); row.className = "br-feed-row"; row.style.setProperty("--feed-color", color); row.textContent = message; byId("br-kill-feed").prepend(row); while (byId("br-kill-feed").children.length > 5) byId("br-kill-feed").lastElementChild?.remove(); setTimeout(() => row.remove(), 6000); }
function brName(id: string): string { return brRoom?.players.find((player) => player.id === id)?.name ?? "A pilot"; }
function showBrPing(name: string, _position: { x: number; y: number; z: number }): void { toast(`${name.toUpperCase()} PINGED A LOCATION`); }
function ordinal(value: number): string { const mod100 = value % 100; return `${value}${mod100 >= 11 && mod100 <= 13 ? "TH" : value % 10 === 1 ? "ST" : value % 10 === 2 ? "ND" : value % 10 === 3 ? "RD" : "TH"}`; }

function showBrMap(visible: boolean): void { brMapOverlay.hidden = !visible; if (visible) { const me = brRoom?.players.find((player) => player.id === playerId); if (me) renderBrMap(me); focusFirst(brMapOverlay); } }
function toggleBrMap(visible: boolean): void { brGame?.setMapVisible(visible); showBrMap(visible); }
function renderBrMap(player: BrRoomView["players"][number]): void {
  const map = byId("br-map-canvas"); const toPercent = (value: number) => 50 + value / BR_MAP.radius * 48;
  const roads=BR_ROADS.map((road)=>{const line=document.createElement("i");line.className="br-map-road";const startX=toPercent(road.from.x),startY=toPercent(road.from.z),endX=toPercent(road.to.x),endY=toPercent(road.to.z);line.style.left=`${startX}%`;line.style.top=`${startY}%`;line.style.width=`${Math.hypot(endX-startX,endY-startY)}%`;line.style.transform=`rotate(${Math.atan2(endY-startY,endX-startX)}rad)`;return line;});
  const secondary=BR_SECONDARY_LOCATIONS.map((location)=>{const dot=document.createElement("i");dot.className="br-map-secondary";dot.style.left=`${toPercent(location.position.x)}%`;dot.style.top=`${toPercent(location.position.z)}%`;dot.title=location.name;return dot;});
  map.replaceChildren(...roads,...secondary,...BR_POIS.map((poi) => { const label = document.createElement("span"); label.className = "br-map-poi"; label.textContent = poi.name; label.style.left = `${toPercent(poi.position.x)}%`; label.style.top = `${toPercent(poi.position.z)}%`; label.style.setProperty("--poi-color", poi.color); return label; }));
  if (brRoom) { const circle = document.createElement("i"); circle.className = "br-map-circle"; circle.style.left = `${toPercent(brRoom.storm.center.x)}%`; circle.style.top = `${toPercent(brRoom.storm.center.z)}%`; circle.style.width = `${brRoom.storm.radius / BR_MAP.radius * 96}%`; circle.style.height = circle.style.width; map.append(circle); }
  if (brRoom) { const next = document.createElement("i"); next.className = "br-map-circle next"; next.style.left = `${toPercent(brRoom.storm.nextCenter.x)}%`; next.style.top = `${toPercent(brRoom.storm.nextCenter.z)}%`; next.style.width = `${brRoom.storm.nextRadius / BR_MAP.radius * 96}%`; next.style.height = next.style.width; map.append(next); }
  if (brRoom?.ship) { const route = document.createElement("i"); route.className = "br-map-route"; const startX = toPercent(brRoom.ship.start.x); const startY = toPercent(brRoom.ship.start.z); const endX = toPercent(brRoom.ship.end.x); const endY = toPercent(brRoom.ship.end.z); route.style.left = `${startX}%`; route.style.top = `${startY}%`; route.style.width = `${Math.hypot(endX - startX, endY - startY)}%`; route.style.transform = `rotate(${Math.atan2(endY - startY, endX - startX)}rad)`; map.append(route); }
  const marker = document.createElement("i"); marker.className = "br-map-player"; marker.style.left = `${toPercent(player.position.x)}%`; marker.style.top = `${toPercent(player.position.z)}%`; map.append(marker);
  for (const teammate of brRoom?.players.filter((entry) => entry.id !== player.id && entry.teamId === player.teamId && entry.alive) ?? []) { const dot = document.createElement("i"); dot.className = "br-map-player teammate"; dot.style.left = `${toPercent(teammate.position.x)}%`; dot.style.top = `${toPercent(teammate.position.z)}%`; dot.style.setProperty("--teammate-color", teammate.color); map.append(dot); }
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
    const crowns = player.crowns > 0 ? `<span class="crown-count" title="Session Crowns">♛ ${player.crowns}</span>` : "";
    const level = !player.isBot ? `<span class="crown-count" title="Session Level">LV ${player.sessionLevel}</span>` : "";
    const badge = player.lobbyBadge ? ` · ${escapeHtml(player.lobbyBadge)}` : "";
    row.innerHTML = `<i class="player-orb" style="background:${player.color};color:${player.color}"></i><div class="player-meta"><b>${escapeHtml(player.name)}${botBadge}</b><br><small>${status}${badge}</small></div>${crowns}${level}<span class="ready-badge ${player.ready ? "" : "waiting"}">${player.ready ? "READY" : "WAIT"}</span>${remove}`;
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
  const isHost = room.hostId === playerId;
  modeClassicButton.disabled = !isHost;
  modeChaosButton.disabled = !isHost;
  modeClassicButton.classList.toggle("selected", room.gameMode === "classic");
  modeChaosButton.classList.toggle("selected", room.gameMode === "chaos");
  document.body.dataset.gameMode = room.gameMode;
  for (const [difficulty, button] of Object.entries(botDifficultyButtons) as [BotDifficulty, HTMLButtonElement][]) {
    button.classList.toggle("selected", room.botDifficulty === difficulty);
    button.disabled = !isHost;
  }
  byId("lobby-fallbucks").textContent = String(me?.fallbucks ?? 0);
  byId("lobby-level").textContent = `LEVEL ${me?.sessionLevel ?? 1}`;
  byId("lobby-emote-hint").querySelector("kbd")!.textContent = inputLabel("emote", game.getInputMethod());
}

function updateHud(): void {
  if (!room) return;
  const me = room.players.find((p) => p.id === playerId);
  const planet = me ? room.planets.find((p) => p.id === me.planetId) : undefined;
  const integrity = Math.round((planet?.integrity ?? 0) / Math.max(1, room.rules.maxIntegrity) * 100);
  byId("health-value").textContent = String(integrity);
  const meter = byId<HTMLElement>("health-meter");
  meter.closest(".health-block")?.classList.toggle("danger", integrity <= 25);
  meter.style.width = `${integrity}%`;
  meter.style.background = integrity <= 25 ? "linear-gradient(90deg,#ff415d,#ff9b4d)" : integrity <= 50 ? "linear-gradient(90deg,#ff9b4d,#ffdc4f)" : "linear-gradient(90deg,#43e899,#70f5ff)";
  byId("scrap-value").textContent = String(me?.scrap ?? 0);
  const modifier = room.activeModifier;
  modifierChip.hidden = !modifier;
  if (modifier) modifierChip.querySelector("span")!.textContent = CHAOS_COPY[modifier].title;
  const remaining = room.phase === "countdown" ? BALANCE.matchMs : Math.max(0, (room.matchEndsAt ?? Date.now()) - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const timer = byId("timer");
  timer.textContent = room.phase === "overtime" ? `OT ${minutes}:${seconds.toString().padStart(2, "0")}` : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const activePlay = room.phase === "playing" || room.phase === "overtime";
  timer.classList.toggle("final-minute", activePlay && remaining <= 60000);
  timer.classList.toggle("final-thirty", activePlay && remaining <= 30000);
  const urgency = activePlay && remaining <= 30000 ? 2 : activePlay && remaining <= 60000 ? 1 : 0;
  if (urgency !== lastMinuteCue) {
    lastMinuteCue = urgency;
    game.audio.setUrgency(urgency);
    if (urgency > 0) showMajorCallout(urgency === 2 ? "final-thirty" : "final-minute");
  }
  renderLeaderboard();
  updateWeapon(game.weapon);
}

function renderLeaderboard(): void {
  if (!room) return;
  const active = new Set(room.players.map((player) => player.id));
  for (const [id, node] of leaderboardNodes) if (!active.has(id)) { node.remove(); leaderboardNodes.delete(id); }
  for (const player of room.players) {
    let node = leaderboardNodes.get(player.id);
    if (!node) {
      node = document.createElement("div");
      node.className = "leader-row";
      node.innerHTML = '<i></i><span class="leader-name"></span><span class="leader-integrity"><b></b><i></i></span><span class="leader-scrap"></span><small class="leader-extra"></small>';
      leaderboardNodes.set(player.id, node);
    }
    const planet = room.planets.find((candidate) => candidate.id === player.planetId);
    const percent = Math.round((planet?.integrity ?? 0) / Math.max(1, room.rules.maxIntegrity) * 100);
    const stats = room.matchStats.find((entry) => entry.playerId === player.id);
    node.style.setProperty("--player-color", player.color);
    node.style.setProperty("--integrity", `${Math.max(0, percent)}%`);
    node.classList.toggle("local", player.id === playerId);
    node.classList.toggle("dead", !player.alive);
    node.classList.toggle("critical", player.alive && percent <= 25);
    node.querySelector(".leader-name")!.innerHTML = `${escapeHtml(player.name)}${player.isBot ? ' <b class="bot-badge">BOT</b>' : ""}`;
    node.querySelector(".leader-integrity b")!.textContent = player.alive ? `${percent}%` : "OUT";
    node.querySelector(".leader-scrap")!.textContent = player.alive ? `◇ ${player.scrap}` : "DESTROYED";
    node.querySelector(".leader-extra")!.textContent = `LV ${player.sessionLevel} · ♛ ${player.crowns} · ${Math.round(stats?.damageDealt ?? 0)} DMG · ${stats?.stolenScrap ?? 0} STOLEN`;
  }
  leaderboardList.replaceChildren(...room.players.map((player) => leaderboardNodes.get(player.id)!));
  leaderboard.classList.toggle("expanded", leaderboardExpanded);
}

function updateWeapon(weapon: WeaponType): void {
  const config = BALANCE.weapons[weapon];
  byId("weapon-name").textContent = WEAPON_COPY[weapon].name;
  byId("weapon-cost").textContent = `${config.cost} scrap`;
  trajectoryLabel.textContent = `${WEAPON_COPY[weapon].name} · ${config.cost} SCRAP`;
  const icon = byId("weapon-button").querySelector("i")!;
  const color = weapon === "rocket" ? "#ff6b8a" : weapon === "asteroid" ? "#b67cff" : weapon === "cluster" ? "#ffdc4f" : "#70f5ff";
  icon.setAttribute("style", `width:${weapon === "rocket" ? 25 : 26}px;height:${weapon === "rocket" ? 10 : 26}px;border-radius:${weapon === "cluster" ? "50%" : "40% 55% 45% 50%"};background:${color};box-shadow:0 0 12px ${color}`);
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

function revealModifier(modifier: ChaosModifier): void {
  const copy = CHAOS_COPY[modifier];
  modifierReveal.querySelector("b")!.textContent = copy.title;
  modifierReveal.querySelector("span")!.textContent = copy.description;
  modifierReveal.classList.remove("visible");
  void modifierReveal.offsetWidth;
  modifierReveal.classList.add("visible");
  game.audio.chaos();
  window.setTimeout(() => modifierReveal.classList.remove("visible"), 2350);
}

function showResults(winnerId: string | null, result: MatchResult | null = room?.matchResult ?? null): void {
  if (!room) return;
  room.winnerId = winnerId; room.phase = "results";
  showScreen("results"); game.setMode("results");
  const winner = room.players.find((p) => p.id === winnerId);
  const isMe = winnerId === playerId;
  if (announcedWinner !== winnerId) {
    game.audio.result(isMe);
    if (result?.progression.some((entry) => entry.playerId === playerId && entry.level > entry.previousLevel)) window.setTimeout(() => game.audio.levelUp(), 480);
    announcedWinner = winnerId;
  }
  byId("results-title").textContent = winner ? isMe ? "You win!" : `${winner.name} wins` : "Draw";
  const crownTotal = result?.crowns.find((entry) => entry.playerId === winnerId)?.crowns ?? winner?.crowns ?? 0;
  const streak = result?.winStreak?.playerId === winnerId && (result.winStreak?.count ?? 0) >= 2 ? ` · ${result.winStreak!.count} WIN STREAK` : "";
  byId("winner-copy").innerHTML = winner
    ? `${winner.isBot ? '<span class="bot-badge">BOT</span> ' : ""}${isMe ? "Your planet survived." : `${escapeHtml(winner.name)} held on.`} <strong class="result-crowns">♛ ${crownTotal}${streak}</strong>`
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
    const crowns = finalResult?.crowns.find((entry) => entry.playerId === placement.playerId)?.crowns ?? player?.crowns ?? 0;
    const integrity = Math.round(placement.integrity / Math.max(1, room!.rules.maxIntegrity) * 100);
    row.innerHTML = `<b>#${placement.place}</b><div><div class="standing-name">${escapeHtml(player?.name ?? "Pilot")}${player?.isBot ? ' <span class="bot-badge">BOT</span>' : ""} <span class="standing-crowns">♛ ${crowns}</span></div><div class="standing-stats">${Math.round(stats?.damageDealt ?? 0)} dmg · ${stats?.stolenScrap ?? 0} stolen · ${stats?.successfulShoves ?? 0} shoves</div></div><span class="standing-integrity">${integrity}%</span>`;
    return row;
  }));
  awards.replaceChildren(...(finalResult?.awards ?? []).map((award) => {
    const player = room!.players.find((entry) => entry.id === award.playerId);
    const card = document.createElement("div"); card.className = "award";
    card.innerHTML = `<strong>${escapeHtml(award.title)}</strong><span style="color:${player?.color ?? "#fff"}">${escapeHtml(player?.name ?? "Pilot")}</span><small>${escapeHtml(award.subtitle)}</small>`;
    return card;
  }));
  const reward = finalResult?.fallbucks.find((entry) => entry.playerId === playerId);
  byId("fallbucks-reward").textContent = reward ? `+${reward.reward} FALLBUCKS  ·  ${reward.balance} TOTAL` : "";
  const progress = finalResult?.progression.find((entry) => entry.playerId === playerId);
  const unlocked = progress?.rewards.map((entry) => entry.label).join(" · ") ?? "";
  byId("progression-reward").innerHTML = progress
    ? `<strong>+${progress.xpEarned} XP</strong> · LEVEL ${progress.level}${progress.level > progress.previousLevel ? " · LEVEL UP!" : ""}${unlocked ? `<br><small>${escapeHtml(unlocked)}</small>` : ""}`
    : "";
  const humans = room.players.filter((p) => p.connected && !p.isBot);
  const votes = room.rematchVotes.filter((id) => humans.some((player) => player.id === id)).length;
  byId("rematch-count").textContent = `${votes} / ${humans.length} READY`;
  byId<HTMLButtonElement>("rematch-button").disabled = room.rematchVotes.includes(playerId);
}

function openShop(): void {
  const previewing = currentScreen === "home" && !room && !brRoom;
  const available = currentFamily === "battle-royale" ? brRoom && (brRoom.phase === "lobby" || brRoom.phase === "results") : room && (room.phase === "lobby" || room.phase === "results");
  if (!previewing && !available) return;
  game.audio.unlock(); game.audio.click();
  shopOverlay.hidden = false;
  captureUi(true);
  renderShop();
  focusFirst(shopOverlay);
}

function closeShop(): void {
  shopOverlay.hidden = true;
  captureUi(false);
  focusFirst(screens[currentScreen]);
}

function renderShop(): void {
  const me = (currentFamily === "battle-royale" ? brRoom?.players : room?.players)?.find((player) => player.id === playerId);
  const previewing = !me;
  byId("shop-balance").textContent = String(me?.fallbucks ?? 0);
  shopNote.hidden = !previewing;
  const categories: { id: CosmeticCategory; label: string }[] = [
    { id: "suit", label: "SUITS" }, { id: "trail", label: "TRAILS" }, { id: "emote", label: "EMOTES" }, { id: "victory", label: "VICTORY" }
  ];
  shopCategories.replaceChildren(...categories.map(({ id, label }) => {
    const button = document.createElement("button"); button.textContent = label; button.classList.toggle("selected", shopCategory === id);
    button.addEventListener("click", () => { shopCategory = id; renderShop(); }); return button;
  }));
  shopGrid.replaceChildren(...SHOP_CATALOG.filter((item) => item.category === shopCategory && !item.passLevel).map((item) => {
    const card = document.createElement("article"); card.className = "shop-item";
    card.style.setProperty("--item-color", item.color ?? (item.category === "emote" ? "#ff8bd9" : "#70f5ff"));
    const owned = me?.ownedCosmetics.includes(item.id) ?? false;
    const equipped = Boolean(me && item.category !== "emote" && me.equippedCosmetics[item.category] === item.id);
    card.innerHTML = `<i></i><b>${escapeHtml(item.name)}</b><small>${owned ? "OWNED" : `${item.price} FALLBUCKS`}</small><button>${previewing ? "PLAY TO UNLOCK" : equipped ? "EQUIPPED" : owned ? item.category === "emote" ? "OWNED" : "EQUIP" : "BUY"}</button>`;
    const button = card.querySelector("button")!;
    button.disabled = previewing || equipped || (owned && item.category === "emote") || (!owned && me!.fallbucks < item.price);
    button.addEventListener("click", () => {
      const done = (result: { ok: boolean; error?: string }) => {
        if (!result.ok) toast(result.error ?? "Shop request failed.");
        else { game.audio.click(); toast(owned ? `${item.name} equipped` : `${item.name} unlocked`); }
      };
      if (currentFamily === "battle-royale") socket.emit(owned ? "br:shop:equip" : "br:shop:buy", { itemId: item.id }, done);
      else socket.emit(owned ? "shop:equip" : "shop:buy", { itemId: item.id }, done);
    });
    return card;
  }));
}

function openPass(): void {
  const available = currentFamily === "battle-royale" ? brRoom && (brRoom.phase === "lobby" || brRoom.phase === "results") : room && (room.phase === "lobby" || room.phase === "results");
  if (!available) return;
  game.audio.unlock(); game.audio.click();
  passOverlay.hidden = false;
  captureUi(true);
  renderPass();
  focusFirst(passOverlay);
}

function closePass(): void {
  passOverlay.hidden = true;
  captureUi(false);
  focusFirst(screens[currentScreen]);
}

function renderPass(): void {
  const me = (currentFamily === "battle-royale" ? brRoom?.players : room?.players)?.find((player) => player.id === playerId);
  const level = me?.sessionLevel ?? 1;
  const xp = me?.sessionXp ?? 0;
  byId("pass-level").textContent = `LEVEL ${level}`;
  byId("pass-xp-copy").textContent = level >= SESSION_PROGRESSION.maxLevel ? "MAX LEVEL" : `${xp} / ${SESSION_PROGRESSION.xpPerLevel} XP`;
  byId<HTMLElement>("pass-xp-meter").style.width = `${level >= SESSION_PROGRESSION.maxLevel ? 100 : Math.min(100, xp)}%`;
  byId("pass-track").replaceChildren(...PLANET_PASS_REWARDS.map((reward) => {
    const tier = document.createElement("article");
    const unlocked = level >= reward.level || Boolean(me?.unlockedPassRewards.includes(reward.id));
    tier.className = `pass-tier${unlocked ? " unlocked" : ""}${level === reward.level ? " current" : ""}`;
    tier.innerHTML = `<strong>${reward.level}</strong><i></i><span>${escapeHtml(reward.label)}</span>`;
    const cosmetic = reward.cosmeticId ? SHOP_CATALOG.find((item) => item.id === reward.cosmeticId) : undefined;
    tier.style.setProperty("--reward-color", cosmetic?.color ?? "#70f5ff");
    if (cosmetic?.color) (tier.querySelector("i") as HTMLElement).style.background = cosmetic.color;
    return tier;
  }));
}

function hydrateSettings(): void {
  mouseSensitivity.value = String(settings.mouseSensitivity);
  controllerSensitivity.value = String(settings.controllerSensitivity);
  invertY.checked = settings.invertY;
  musicVolume.value = String(settings.musicVolume);
  sfxVolume.value = String(settings.sfxVolume);
  cameraShake.value = settings.cameraShake;
  graphicsQuality.value = settings.graphicsQuality;
  updateSettingOutputs();
}

function updateSettingsFromUi(): void {
  settings = parseStoredSettings(JSON.stringify({
    mouseSensitivity: Number(mouseSensitivity.value),
    controllerSensitivity: Number(controllerSensitivity.value),
    invertY: invertY.checked,
    musicVolume: Number(musicVolume.value),
    sfxVolume: Number(sfxVolume.value),
    cameraShake: cameraShake.value,
    graphicsQuality: graphicsQuality.value
  } satisfies Record<keyof UserSettings, unknown>), prefersReducedMotion);
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  game.setSettings(settings);
  brGame?.setSettings(settings);
  updateSettingOutputs();
}

function updateSettingOutputs(): void {
  byId<HTMLOutputElement>("mouse-sensitivity-value").value = `${settings.mouseSensitivity.toFixed(1)}x`;
  byId<HTMLOutputElement>("controller-sensitivity-value").value = `${settings.controllerSensitivity.toFixed(1)}x`;
  byId<HTMLOutputElement>("music-volume-value").value = `${Math.round(settings.musicVolume * 100)}%`;
  byId<HTMLOutputElement>("sfx-volume-value").value = `${Math.round(settings.sfxVolume * 100)}%`;
}

function openSettings(origin: "pause" | "screen"): void {
  settingsReturn = origin;
  if (origin === "pause") pauseOverlay.hidden = true;
  settingsOverlay.hidden = false;
  captureUi(true);
  focusFirst(settingsOverlay);
}

function closeSettings(): void {
  settingsOverlay.hidden = true;
  if (settingsReturn === "pause") {
    pauseOverlay.hidden = false;
    captureUi(true);
    focusFirst(pauseOverlay);
  } else {
    captureUi(false);
    focusFirst(screens[currentScreen]);
  }
}

function togglePause(forceOpen = false): void {
  const classicActive = room && ["countdown", "playing", "overtime"].includes(room.phase);
  const brActive = brRoom && ["countdown", "ship", "combat"].includes(brRoom.phase);
  if (!classicActive && !brActive) return;
  if (!settingsOverlay.hidden) return closeSettings();
  if (!pauseOverlay.hidden && !forceOpen) return closePause();
  pauseOverlay.hidden = false;
  captureUi(true);
  focusFirst(pauseOverlay);
}

function closePause(): void {
  pauseOverlay.hidden = true;
  captureUi(false);
  if ((brGame?.getInputMethod() ?? game.getInputMethod()) === "keyboard") void canvas.requestPointerLock().catch(() => undefined);
}

function renderInputUi(method: InputMethod): void {
  document.body.dataset.input = method;
  const battleRoyale = currentScreen === "home" ? selectedFamily === "battle-royale" : currentFamily === "battle-royale";
  const controls = battleRoyale
    ? method === "gamepad"
      ? [["LS", "Move"], ["RS", "Aim"], ["A", "Jump"], ["B", "Sprint"], ["R3", "Slide"], ["X", "Interact"], ["RT", "Fire"], ["RB", "Reload"], ["Y", "Next Slot"], ["D↓", "Map"]]
      : [["WASD", "Move"], ["MOUSE", "Aim"], ["SPACE", "Jump"], ["SHIFT", "Sprint"], ["CTRL", "Slide"], ["E", "Interact"], ["LMB", "Fire"], ["R", "Reload"], ["1–5", "Slots"], ["M", "Map"]]
    : method === "gamepad"
      ? [["LS", "Move"], ["RS", "Camera"], ["A", "Jump"], ["B", "Burst"], ["X", "Interact"], ["LT", "Grapple"], ["RT", "Fire"], ["RB", "Repair"], ["Y", "Cannon Weapon"], ["D↑", "Emote"]]
      : [["WASD", "Move"], ["MOUSE", "Camera"], ["SPACE", "Jump"], ["SHIFT", "Burst"], ["E", "Interact"], ["RMB", "Grapple"], ["LMB", "Fire"], ["R", "Repair"], ["Q", "Cannon Weapon"], ["V", "Emote"]];
  const html = controls.map(([key, label]) => `<span><kbd>${key}</kbd>${label}</span>`).join("");
  controlHelp.innerHTML = html;
  pauseControls.innerHTML = html;
  homeControls.innerHTML = controls.filter(([, label]) => ["Move", "Interact", "Grapple"].includes(label)).map(([key, label]) => `<span><kbd>${key}</kbd> ${label}</span>`).join("");
  byId("weapon-key").textContent = inputLabel("switchWeapon", method);
  byId("leaderboard-key").textContent = method === "gamepad" ? "VIEW" : "TAB";
  byId("lobby-emote-hint").querySelector("kbd")!.textContent = inputLabel("emote", method);
}

function captureUi(captured: boolean): void {
  game.setUiCaptured(captured);
  brGame?.setUiCaptured(captured);
}

function showFirstMatchControls(): void {
  const key = "planetfall:controls-seen:v1";
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, "seen");
  controlHelp.classList.add("visible");
  clearTimeout(controlsTimer);
  controlsTimer = window.setTimeout(() => controlHelp.classList.remove("visible"), 7500);
}

function navigateUi(action: "up" | "down" | "left" | "right" | "confirm" | "back"): void {
  if (action === "back") {
    if (!brMapOverlay.hidden) return toggleBrMap(false);
    if (!shopOverlay.hidden) return closeShop();
    if (!passOverlay.hidden) return closePass();
    if (!settingsOverlay.hidden) return closeSettings();
    if (!pauseOverlay.hidden) return closePause();
    if (currentScreen === "lobby" || currentScreen === "brLobby") location.reload();
    return;
  }
  const root = !brMapOverlay.hidden ? brMapOverlay : !shopOverlay.hidden ? shopOverlay : !passOverlay.hidden ? passOverlay : !settingsOverlay.hidden ? settingsOverlay : !pauseOverlay.hidden ? pauseOverlay : screens[currentScreen];
  const elements = [...root.querySelectorAll<HTMLElement>("button:not([disabled]):not([hidden]), input[type='range'], input[type='checkbox'], select")]
    .filter((element) => element.offsetParent !== null);
  if (!settingsOpenButton.hidden) elements.push(settingsOpenButton);
  if (!elements.length) return;
  let index = elements.indexOf(document.activeElement as HTMLElement);
  if (index < 0) index = action === "up" || action === "left" ? 0 : -1;
  if (index < 0 && action === "confirm") index = 0;
  const current = elements[index];
  if ((action === "left" || action === "right") && (current instanceof HTMLInputElement && current.type === "range")) {
    current.stepUp(action === "right" ? 1 : -1); current.dispatchEvent(new Event("input", { bubbles: true })); return;
  }
  if ((action === "left" || action === "right") && current instanceof HTMLSelectElement) {
    current.selectedIndex = Math.max(0, Math.min(current.options.length - 1, current.selectedIndex + (action === "right" ? 1 : -1)));
    current.dispatchEvent(new Event("change", { bubbles: true })); return;
  }
  if (action === "confirm") {
    if (current instanceof HTMLButtonElement || (current instanceof HTMLInputElement && current.type === "checkbox")) current.click();
    return;
  }
  const direction = action === "up" || action === "left" ? -1 : 1;
  const next = elements[(index + direction + elements.length) % elements.length];
  document.querySelectorAll(".gamepad-focus").forEach((element) => element.classList.remove("gamepad-focus"));
  next.classList.add("gamepad-focus");
  next.focus({ preventScroll: false });
}

function focusFirst(root: HTMLElement): void {
  document.querySelectorAll(".gamepad-focus").forEach((element) => element.classList.remove("gamepad-focus"));
  const first = root.querySelector<HTMLElement>("button:not([disabled]):not([hidden]), input[type='range'], input[type='checkbox'], select");
  if (game.getInputMethod() === "gamepad" && first) { first.classList.add("gamepad-focus"); first.focus(); }
}

function setGameMode(mode: GameMode): void {
  if (!room || room.hostId !== playerId || room.phase !== "lobby" || room.gameMode === mode) return;
  game.audio.click();
  socket.emit("room:mode", { mode });
}

function showScreen(name: keyof typeof screens): void {
  currentScreen = name;
  game.audio.setMusicScene(name === "hud" || name === "brHud" ? "game" : "menu");
  for (const [key, screen] of Object.entries(screens)) screen.classList.toggle("active", key === name);
  const brScreen = name === "brLobby" || name === "brHud" || name === "brResults";
  document.body.dataset.gameFamily = brScreen ? "battle-royale" : "planetfall";
  if (brScreen) { modifierReveal.classList.remove("visible"); countdown.textContent = ""; leaderboard.classList.remove("visible"); }
  settingsOpenButton.hidden = name === "hud" || name === "brHud";
  if (name === "hud" || name === "brHud") showFirstMatchControls();
}

function setConnection(state: "online" | "offline" | "", text: string): void {
  connectionPill.className = `connection-pill ${state}`; connectionPill.querySelector("span")!.textContent = text;
}

function toast(message: string): void {
  const element = document.createElement("div"); element.className = "toast"; element.textContent = message;
  byId("toast-region").append(element);
  setTimeout(() => element.remove(), 3200);
}

function showMajorCallout(type: MatchCalloutType | "final-minute" | "final-thirty"): void {
  const copy: Record<typeof type, string> = {
    "first-hit": "FIRST HIT",
    "first-raid": "FIRST RAID",
    "planet-down": "PLANET DOWN",
    "last-two": "LAST TWO",
    overtime: "OVERTIME",
    "final-minute": "FINAL MINUTE",
    "final-thirty": "30 SECONDS"
  };
  majorCallout.textContent = copy[type];
  majorCallout.classList.remove("visible");
  void majorCallout.offsetWidth;
  majorCallout.classList.add("visible");
  game.audio.callout(type === "overtime" || type === "planet-down");
  window.setTimeout(() => majorCallout.classList.remove("visible"), type === "final-thirty" ? 1150 : 1500);
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
  setTimeout(() => row.classList.add("leaving"), 5600);
  setTimeout(() => row.remove(), 6200);
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

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

setInterval(() => { if (room && (room.phase === "playing" || room.phase === "overtime")) updateHud(); }, 250);
