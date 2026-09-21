import { expect, test, type Page } from "@playwright/test";
import { BALANCE, BR_MAP } from "@planetfall/shared";

type Point = { x: number; y: number; z: number };
type DebugState = {
  localId: string;
  localPosition: Point;
  cameraForward: Point;
  players: { id: string; planetId: string; surfacePlanetId: string | null; scrap: number; crowns: number; position: Point; velocity: Point }[];
  planets: { id: string; ownerId: string; position: Point; integrity: number; cannonDisabledUntil: number; repairDisabledUntil: number }[];
  scraps: { id: string; planetId: string; position: Point }[];
  launchPads: { planetId: string; position: Point }[];
  cannons: { planetId: string; position: Point }[];
  repairs: { planetId: string; position: Point }[];
  trajectoryMarkerVisible: boolean;
  lobbyAvatarCount: number;
  matchStats: { playerId: string; damageDealt: number; stolenScrap: number; successfulShoves: number; sabotagesCompleted: number }[];
  gameMode: "classic" | "chaos" | null;
  activeModifier: string | null;
  rules: { gravity: number; maxIntegrity: number; launchCooldownMs: number; shoveForce: number };
  performance: { fps: number; drawCalls: number; triangles: number; particles: number; projectiles: number };
};

const debugState = (page: Page) => page.evaluate(() => (window as unknown as { __PLANETFALL_DEBUG__: () => DebugState }).__PLANETFALL_DEBUG__());
const pointDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const collectBrowserErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
};

async function takeControl(page: Page): Promise<void> {
  const hasControl = () => page.evaluate(() => document.pointerLockElement?.id === "game-canvas");
  // Pointer lock is not proof that this page is foreground. Always activate
  // the player being driven before checking its existing lock.
  await page.bringToFront();
  if (await hasControl()) return;
  const canvas = page.locator("#game-canvas");
  await expect(canvas).toBeVisible();
  for (let attempt = 0; attempt < 3; attempt++) {
    const box = await canvas.boundingBox();
    if (!box) throw new Error("game canvas has no clickable bounds");
    // A raw mouse event is still a trusted browser gesture (required by
    // pointer lock), but does not wait indefinitely on Playwright's element
    // actionability loop while the WebGL scene is busy rendering.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    if (await expect.poll(hasControl, { timeout: 2000 }).toBe(true).then(() => true, () => false)) return;
  }
  throw new Error("game canvas did not acquire pointer lock");
}

async function moveTo(
  page: Page,
  targetFor: (state: DebugState) => Point,
  tolerance = 2.2,
  maxSteps = 75,
  done: (state: DebugState) => boolean = () => false,
): Promise<void> {
  await takeControl(page);
  for (let step = 0; step < maxSteps; step++) {
    if (await page.locator("#results-screen").isVisible()) {
      throw new Error("match reached results before navigation completed");
    }
    const state = await debugState(page);
    if (done(state)) return;
    const target = targetFor(state);
    const remaining = pointDistance(state.localPosition, target);
    if (remaining <= tolerance) return;
    const planet = [...state.planets].sort((a, b) => pointDistance(state.localPosition, a.position) - pointDistance(state.localPosition, b.position))[0];
    const turn = (() => {
      const normalize = (point: Point): Point => {
        const magnitude = Math.hypot(point.x, point.y, point.z) || 1;
        return { x: point.x / magnitude, y: point.y / magnitude, z: point.z / magnitude };
      };
      const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y + a.z * b.z;
      const outward = normalize({ x: state.localPosition.x - planet.position.x, y: state.localPosition.y - planet.position.y, z: state.localPosition.z - planet.position.z });
      const tangent = (value: Point) => {
        const radial = dot(value, outward);
        return normalize({ x: value.x - outward.x * radial, y: value.y - outward.y * radial, z: value.z - outward.z * radial });
      };
      const current = tangent(state.cameraForward);
      const desired = tangent({ x: target.x - state.localPosition.x, y: target.y - state.localPosition.y, z: target.z - state.localPosition.z });
      const cross = { x: current.y * desired.z - current.z * desired.y, y: current.z * desired.x - current.x * desired.z, z: current.x * desired.y - current.y * desired.x };
      return Math.atan2(dot(outward, cross), Math.max(-1, Math.min(1, dot(current, desired))));
    })();
    await page.evaluate((movementX) => {
      const event = new MouseEvent("mousemove");
      Object.defineProperty(event, "movementX", { value: movementX });
      window.dispatchEvent(event);
    }, -turn / 0.0022);
    await page.keyboard.down("w");
    try {
      // Cover open ground with fewer browser round trips, but keep short
      // corrections near an interaction so the driver does not overshoot it.
      await page.waitForTimeout(remaining > 8 ? 480 : remaining > 3 ? 240 : 110);
    } finally {
      await page.keyboard.up("w");
    }
  }
  const state = await debugState(page);
  throw new Error(`movement did not reach target; remaining distance ${pointDistance(state.localPosition, targetFor(state)).toFixed(2)} from ${JSON.stringify(state.localPosition)} toward ${JSON.stringify(targetFor(state))}`);
}

async function aimAt(page: Page, targetFor: (state: DebugState) => Point, origin: "cannon" | "player" = "cannon"): Promise<void> {
  await takeControl(page);
  for (let attempt = 0; attempt < 12; attempt++) {
    const state = await debugState(page);
    const target = targetFor(state);
    const planet = [...state.planets].sort((a, b) => pointDistance(state.localPosition, a.position) - pointDistance(state.localPosition, b.position))[0];
    const cannon = [...state.cannons].sort((a, b) => pointDistance(state.localPosition, a.position) - pointDistance(state.localPosition, b.position))[0];
    const normalize = (point: Point): Point => {
      const magnitude = Math.hypot(point.x, point.y, point.z) || 1;
      return { x: point.x / magnitude, y: point.y / magnitude, z: point.z / magnitude };
    };
    const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y + a.z * b.z;
    const tangent = (value: Point, outward: Point) => {
      const radial = dot(value, outward);
      return normalize({ x: value.x - outward.x * radial, y: value.y - outward.y * radial, z: value.z - outward.z * radial });
    };
    const outward = normalize({ x: state.localPosition.x - planet.position.x, y: state.localPosition.y - planet.position.y, z: state.localPosition.z - planet.position.z });
    const aimOrigin = origin === "player" ? state.localPosition : cannon.position;
    const desired = normalize({ x: target.x - aimOrigin.x, y: target.y - aimOrigin.y, z: target.z - aimOrigin.z });
    if (dot(normalize(state.cameraForward), desired) > .999) return;
    const currentTangent = tangent(state.cameraForward, outward);
    const desiredTangent = tangent(desired, outward);
    const cross = {
      x: currentTangent.y * desiredTangent.z - currentTangent.z * desiredTangent.y,
      y: currentTangent.z * desiredTangent.x - currentTangent.x * desiredTangent.z,
      z: currentTangent.x * desiredTangent.y - currentTangent.y * desiredTangent.x
    };
    const yaw = Math.atan2(dot(outward, cross), Math.max(-1, Math.min(1, dot(currentTangent, desiredTangent))));
    const currentPitch = Math.asin(Math.max(-1, Math.min(1, dot(normalize(state.cameraForward), outward))));
    const desiredPitch = Math.asin(Math.max(-1, Math.min(1, dot(desired, outward))));
    const yawStep = Math.max(-.55, Math.min(.55, yaw));
    const pitchStep = Math.max(-.3, Math.min(.3, currentPitch - desiredPitch));
    await page.evaluate(({ movementX, movementY }) => {
      const event = new MouseEvent("mousemove");
      Object.defineProperty(event, "movementX", { value: movementX });
      Object.defineProperty(event, "movementY", { value: movementY });
      window.dispatchEvent(event);
    }, { movementX: -yawStep / 0.0022, movementY: pitchStep / 0.0018 });
    // Headless WebGL can render below 20 FPS. Give each synthetic look input one
    // complete frame so repeated corrections do not accumulate into an overshoot.
    await page.waitForTimeout(180);
  }
}

async function fireCannon(page: Page): Promise<void> {
  const canvas = page.locator("#game-canvas");
  await canvas.dispatchEvent("mousedown", { button: 0 });
  await canvas.dispatchEvent("mouseup", { button: 0 });
}

test("settings persist across reloads", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Mouse Sensitivity").fill("1.4");
  await page.getByLabel("Controller Sensitivity").fill("1.3");
  await page.getByLabel("Invert Camera Y").check();
  await page.getByLabel("Music").fill("0.45");
  await page.getByLabel("SFX").fill("0.6");
  await page.getByLabel("Camera Shake").selectOption("reduced");
  await page.getByLabel("Quality").selectOption("medium");
  await page.getByRole("button", { name: "Done" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByLabel("Mouse Sensitivity")).toHaveValue("1.4");
  await expect(page.getByLabel("Controller Sensitivity")).toHaveValue("1.3");
  await expect(page.getByLabel("Invert Camera Y")).toBeChecked();
  await expect(page.getByLabel("Music")).toHaveValue("0.45");
  await expect(page.getByLabel("SFX")).toHaveValue("0.6");
  await expect(page.getByLabel("Camera Shake")).toHaveValue("reduced");
  await expect(page.getByLabel("Quality")).toHaveValue("medium");
  expect(browserErrors).toEqual([]);
});

test("the home menu previews the Fallbucks shop", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: "SHOP · COSMETICS" }).click();
  await expect(page.getByRole("heading", { name: "Shop" })).toBeVisible();
  await expect(page.locator("#shop-note")).toContainText("JOIN A ROOM TO EARN AND SPEND FALLBUCKS");
  await expect(page.locator("#shop-grid").getByRole("button", { name: "PLAY TO UNLOCK" }).first()).toBeDisabled();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator("#home-screen")).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("Battle Royale creates an isolated room and enters the Starliner drop", async ({ page }) => {
  test.setTimeout(180_000);
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/");
  // Chromium's CI software renderer is intentionally kept on Low for this
  // gameplay-state test; visual budgets are covered by the dedicated scene test.
  await page.evaluate(() => localStorage.setItem("planetfall:settings:v1", JSON.stringify({ mouseSensitivity: 1, controllerSensitivity: 1, invertY: false, musicVolume: 0, sfxVolume: 0, cameraShake: "off", graphicsQuality: "low" })));
  await page.reload();
  await page.getByLabel("Name").fill("Star Pilot");
  await page.locator("#family-br").click();
  await page.getByRole("button", { name: "Create BR Room" }).click();
  await expect(page.locator("#br-lobby-screen")).toBeVisible();
  await expect(page.locator("#br-team-list")).toContainText("Star Pilot");
  await page.locator("#br-ready-button").click();
  await page.locator("#br-start-button").click();
  await expect(page.locator("#br-hud")).toBeVisible();
  await expect(page.locator("#hud")).toBeHidden();
  await expect(page.locator("#modifier-reveal")).toBeHidden();
  await expect(page.locator("#modifier-chip")).not.toHaveClass(/visible/);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __PLANETFALL_BR_DEBUG__?: () => { phase: string; players: unknown[]; crateCount: number } }).__PLANETFALL_BR_DEBUG__?.().phase), { timeout: 9000 }).toBe("ship");
  await expect(page.locator("#br-storm-copy")).toHaveText("DROP PHASE");
  await expect(page.locator("#br-storm-timer")).toHaveText("—");
  const state = await page.evaluate(() => (window as unknown as { __PLANETFALL_BR_DEBUG__: () => { players: unknown[]; crateCount: number; world:{shipVisible:boolean;islandObjects:number} } }).__PLANETFALL_BR_DEBUG__());
  expect(state.players).toHaveLength(10);
  expect(state.crateCount).toBeGreaterThanOrEqual(19);
  expect(state.world.shipVisible).toBe(true);
  expect(state.world.islandObjects).toBeGreaterThan(50);
  await expect.poll(() => page.evaluate(() => {
    const player = (window as unknown as { __PLANETFALL_BR_DEBUG__: () => { localPlayer: { position: Point } } }).__PLANETFALL_BR_DEBUG__().localPlayer;
    return Math.hypot(player.position.x, player.position.z);
  // Enter the island's playable airspace before jumping. Requiring the ship to
  // reach a narrow central radius made this browser flow depend on timer
  // scheduling under heavily loaded software-rendered CI hosts.
  }), { timeout: 20_000 }).toBeLessThan(BR_MAP.radius - 80);
  await takeControl(page);
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __PLANETFALL_BR_DEBUG__: () => { localPlayer: { deployment: string } } }).__PLANETFALL_BR_DEBUG__().localPlayer.deployment)).toBe("freefall");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __PLANETFALL_BR_DEBUG__: () => { localPlayer: { deployment: string } } }).__PLANETFALL_BR_DEBUG__().localPlayer.deployment), { timeout: 20_000 }).toBe("grounded");
  expect(browserErrors).toEqual([]);
});

test("the cannon guide marks its predicted planet impact", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/");
  await page.getByLabel("Name").fill("Nova");
  await page.getByRole("button", { name: "Play Solo" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator(".weapon-panel")).toContainText("CANNON WEAPON");
  const initial = await debugState(page);
  const local = initial.players.find((player) => player.id === initial.localId)!;
  const target = initial.planets.find((planet) => planet.id !== local.planetId)!;
  await moveTo(page, (state) => state.cannons.find((cannon) => cannon.planetId === local.planetId)!.position, 3.7);
  await aimAt(page, () => target.position);
  await expect.poll(async () => (await debugState(page)).trajectoryMarkerVisible).toBe(true);
  expect(browserErrors).toEqual([]);
});

test("two players can create, join, ready, and start", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const browserErrors = [collectBrowserErrors(host), collectBrowserErrors(guest)];
  await Promise.all([host.goto("/"), guest.goto("/")]);

  await host.getByLabel("Name").fill("Nova");
  await expect(host.getByRole("button", { name: "Create Room" })).toBeEnabled();
  await expect(host.getByLabel("Name")).toHaveValue("Nova");
  await host.getByRole("button", { name: "Create Room" }).click();
  await expect(host.getByRole("heading", { name: "Crew" })).toBeVisible();
  await expect.poll(async () => (await debugState(host)).lobbyAvatarCount).toBe(1);
  await host.getByRole("button", { name: /PLANET PASS/ }).click();
  await expect(host.getByRole("heading", { name: "Planet Pass" })).toBeVisible();
  await expect(host.locator("#pass-track .pass-tier")).toHaveCount(10);
  await host.locator("#pass-close").click();
  await expect(host.locator("#mode-classic")).toHaveClass(/selected/);
  await host.locator("#bot-hard").click();
  await expect(host.locator("#bot-hard")).toHaveClass(/selected/);
  const code = (await host.locator("#lobby-code").textContent())!;

  await guest.getByLabel("Name").fill("Orbit");
  await guest.getByLabel("Room code").fill(code);
  await guest.getByRole("button", { name: "Join Game" }).click();
  await expect(guest.getByText("Nova")).toBeVisible();
  await expect(guest.locator("#bot-hard")).toBeDisabled();

  await guest.getByRole("button", { name: "Ready" }).click();
  await host.getByRole("button", { name: "Ready" }).click();
  await expect(host.getByRole("button", { name: "Start" })).toBeEnabled();
  await host.getByRole("button", { name: "Start" }).click();
  await expect(host.locator("#hud")).toBeVisible();
  await expect(guest.locator("#hud")).toBeVisible();
  await expect(host.locator("#leaderboard-list .leader-row")).toHaveCount(2);
  await expect(host.locator("#timer")).toContainText(":", { timeout: 7000 });
  await expect(host.locator("#modifier-chip")).toBeHidden();
  expect((await debugState(host)).gameMode).toBe("classic");
  expect(browserErrors.flat()).toEqual([]);

  await hostContext.close(); await guestContext.close();
});

test("a human can raid, steal, shove, sabotage, and resume cannon play", async ({ browser }) => {
  test.setTimeout(220_000);
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const guestContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const browserErrors = [collectBrowserErrors(host), collectBrowserErrors(guest)];
  await Promise.all([host.goto("/"), guest.goto("/")]);
  await host.getByLabel("Name").fill("Chris");
  await host.getByRole("button", { name: "Create Room" }).click();
  await expect(host.getByRole("heading", { name: "Crew" })).toBeVisible();
  await expect(host.locator("#lobby-code")).not.toHaveText("------");
  const code = (await host.locator("#lobby-code").textContent())!;
  await guest.getByLabel("Name").fill("Nova");
  await guest.getByLabel("Room code").fill(code);
  await guest.getByRole("button", { name: "Join Game" }).click();
  await expect(guest.getByText("Chris")).toBeVisible();
  await guest.getByRole("button", { name: "Ready" }).click();
  await host.getByRole("button", { name: "Ready" }).click();
  await host.getByRole("button", { name: "Start" }).click();
  await expect(host.locator("#context-prompt")).not.toContainText("Get ready", { timeout: 7000 });

  let hostState = await debugState(host);
  const hostPlayer = hostState.players.find((player) => player.id === hostState.localId)!;
  const guestPlayer = hostState.players.find((player) => player.id !== hostState.localId)!;
  const hostPlanetId = hostPlayer.planetId;
  const guestPlanetId = guestPlayer.planetId;
  await moveTo(host, (state) => state.launchPads.find((pad) => pad.planetId === hostPlanetId)!.position, 1.5);
  await expect(host.locator("#context-prompt")).toContainText(/LAUNCH/i);
  await host.keyboard.press("e");
  await expect(host.locator("#context-prompt")).toContainText(/LAUNCH TO NOVA/i);
  await host.keyboard.press("e");
  await expect(host.locator("#event-feed")).toContainText("Chris launched to Nova");
  await expect.poll(async () => (await debugState(host)).players.find((player) => player.id === hostPlayer.id)?.surfacePlanetId, { timeout: 12_000 }).toBe(guestPlanetId);

  hostState = await debugState(host);
  const stolenScrapFeed = expect(host.locator("#event-feed")).toContainText("Chris stole Nova's scrap", { timeout: 75_000 });
  if ((hostState.matchStats.find((stats) => stats.playerId === hostPlayer.id)?.stolenScrap ?? 0) === 0) {
    await moveTo(host, (state) => {
      const scraps = state.scraps.filter((scrap) => scrap.planetId === guestPlanetId);
      return scraps.sort((a, b) => pointDistance(state.localPosition, a.position) - pointDistance(state.localPosition, b.position))[0].position;
    }, 1.45, 75, (state) => (state.matchStats.find((stats) => stats.playerId === hostPlayer.id)?.stolenScrap ?? 0) >= BALANCE.scrapValue);
  }
  await Promise.all([
    expect.poll(async () => (await debugState(host)).matchStats.find((stats) => stats.playerId === hostPlayer.id)?.stolenScrap ?? 0).toBeGreaterThanOrEqual(BALANCE.scrapValue),
    stolenScrapFeed
  ]);

  // Bring the defender to the invader's actual landing/loot position. A detour
  // through a fixed neutral point makes this real-time match expire while the
  // browser drives both avatars across the planet.
  for (let approach = 0; approach < 2; approach++) {
    await moveTo(guest, (state) => state.players.find((player) => player.id === hostPlayer.id)!.position, .9, 100);
    await moveTo(host, (state) => state.players.find((player) => player.id === guestPlayer.id)!.position, .9, 40);
    const state = await debugState(host);
    const attacker = state.players.find((player) => player.id === hostPlayer.id)!;
    const target = state.players.find((player) => player.id === guestPlayer.id)!;
    if (attacker.surfacePlanetId === guestPlanetId && target.surfacePlanetId === guestPlanetId
      && pointDistance(state.localPosition, target.position) < BALANCE.shove.range) break;
  }
  await expect.poll(async () => {
    const state = await debugState(host);
    const attacker = state.players.find((player) => player.id === hostPlayer.id)!;
    const target = state.players.find((player) => player.id === guestPlayer.id)!;
    return attacker.surfacePlanetId === guestPlanetId && target.surfacePlanetId === guestPlanetId
      && pointDistance(state.localPosition, target.position) < BALANCE.shove.range;
  }).toBe(true);
  for (let aimAttempt = 0; aimAttempt < 3; aimAttempt++) {
    await aimAt(host, (state) => state.players.find((player) => player.id === guestPlayer.id)!.position, "player");
    if (/SHOVE NOVA/i.test(await host.locator("#context-prompt").innerText())) break;
    await moveTo(host, (state) => state.players.find((player) => player.id === guestPlayer.id)!.position, .8, 60);
  }
  await expect(host.locator("#context-prompt")).toContainText(/SHOVE NOVA/i);
  const guestBeforeShoveState = await debugState(guest);
  const guestBeforeShove = guestBeforeShoveState.localPosition;
  const guestAuthoritativeBeforeShove = guestBeforeShoveState.players.find((player) => player.id === guestPlayer.id)!.position;
  await host.keyboard.press("e");
  try {
    await expect.poll(async () => {
      const successful = (await debugState(host)).matchStats.find((stats) => stats.playerId === hostPlayer.id)?.successfulShoves ?? 0;
      if (successful < 1) {
        await moveTo(host, (state) => state.players.find((player) => player.id === guestPlayer.id)!.position, .7, 10);
        await aimAt(host, (state) => state.players.find((player) => player.id === guestPlayer.id)!.position, "player");
        await host.keyboard.press("e");
        // The input is asynchronous. Observe the server stat after this attempt;
        // returning the pre-input value can fail on the final successful retry.
        await expect.poll(async () => (await debugState(host)).matchStats.find((stats) => stats.playerId === hostPlayer.id)?.successfulShoves ?? 0,
          { timeout: 800, intervals: [100, 150, 250] }).toBeGreaterThanOrEqual(1).catch(() => undefined);
      }
      return (await debugState(host)).matchStats.find((stats) => stats.playerId === hostPlayer.id)?.successfulShoves ?? 0;
    }, { timeout: 6000, intervals: [350, 500, 700] }).toBeGreaterThanOrEqual(1);
  } catch (error) {
    const state = await debugState(host);
    const attacker = state.players.find((player) => player.id === hostPlayer.id)!;
    const target = state.players.find((player) => player.id === guestPlayer.id)!;
    const denial = await host.locator(".toast").last().textContent().catch(() => null);
    throw new Error(`shove was rejected: ${denial ?? "no server reason"}; predicted=${pointDistance(state.localPosition, target.position).toFixed(2)} authoritative=${pointDistance(attacker.position, target.position).toFixed(2)} surfaces=${attacker.surfacePlanetId}/${target.surfacePlanetId}`, { cause: error });
  }
  await expect(host.locator("#event-feed")).toContainText("Chris shoved Nova");
  // The defender's presentation is frame-driven. Observe it in a foreground
  // tab rather than testing a throttled background WebGL loop. Independently
  // require authoritative displacement so a camera/prediction update cannot
  // stand in for real server knockback. Neither threshold is relaxed.
  await guest.bringToFront();
  await expect.poll(async () => {
    const state = await debugState(guest);
    return pointDistance(state.players.find((player) => player.id === guestPlayer.id)!.position, guestAuthoritativeBeforeShove);
  }, { timeout: 3000 }).toBeGreaterThan(0.6);
  await expect.poll(async () => pointDistance((await debugState(guest)).localPosition, guestBeforeShove), { timeout: 3000 }).toBeGreaterThan(0.6);

  await moveTo(host, (state) => state.repairs.find((repair) => repair.planetId === guestPlanetId)!.position, 2.5);
  await expect(host.locator("#context-prompt")).toContainText("JAM REPAIR");
  await host.keyboard.down("e");
  await host.waitForTimeout(650);
  await expect(host.locator("#context-progress")).not.toHaveCSS("width", "0px");
  await host.waitForTimeout(850);
  await host.keyboard.up("e");
  await expect.poll(async () => (await debugState(host)).planets.find((planet) => planet.id === guestPlanetId)!.repairDisabledUntil, { timeout: 3000 }).toBeGreaterThan(Date.now());
  await expect(host.locator("#event-feed")).toContainText("Chris jammed Nova's repair");
  await expect.poll(async () => (await debugState(host)).matchStats.find((stats) => stats.playerId === hostPlayer.id)?.stolenScrap ?? 0, { timeout: 3000 }).toBeGreaterThanOrEqual(5);
  // The shove retry loop above permits more than one successful shove while a
  // snapshot is in flight. Require the action outcome, not exactly one retry.
  await expect.poll(async () => (await debugState(host)).matchStats.find((stats) => stats.playerId === hostPlayer.id)?.successfulShoves ?? 0).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => (await debugState(host)).matchStats.find((stats) => stats.playerId === hostPlayer.id)?.sabotagesCompleted).toBe(1);

  await moveTo(host, (state) => state.launchPads.find((pad) => pad.planetId === guestPlanetId)!.position, 1.5);
  await expect(host.locator("#context-prompt")).toContainText(/LAUNCH/i);
  await host.keyboard.press("e");
  await expect(host.locator("#context-prompt")).toContainText(/LAUNCH TO CHRIS/i);
  await host.keyboard.press("e");
  // Separate server acceptance from arrival so a rejected return launch does
  // not surface only as a destination timeout twelve seconds later.
  await expect(host.locator("#event-feed")).toContainText("Chris launched to Chris");
  await expect.poll(async () => (await debugState(host)).players.find((player) => player.id === hostPlayer.id)?.surfacePlanetId, { timeout: 12_000 }).toBe(hostPlanetId);

  await moveTo(guest, (state) => state.cannons.find((cannon) => cannon.planetId === guestPlanetId)!.position, 3.7);
  await aimAt(guest, (state) => state.planets.find((planet) => planet.id === hostPlanetId)!.position);
  const scrapBeforeFire = (await debugState(guest)).players.find((player) => player.id === guestPlayer.id)!.scrap;
  await fireCannon(guest);
  // Feed entries expire after 6.2 seconds. Observe the first hit as it happens,
  // not after the second-shot navigation/retry sequence (which can outlast it).
  await Promise.all([
    expect.poll(async () => (await debugState(guest)).players.find((player) => player.id === guestPlayer.id)!.scrap, { timeout: 3000 }).toBeLessThan(scrapBeforeFire),
    expect.poll(async () => (await debugState(host)).planets.find((planet) => planet.id === hostPlanetId)!.integrity, { timeout: 5000 }).toBeLessThan(100),
    expect(host.locator("#event-feed")).toContainText("Nova hit Chris")
  ]);
  await guest.waitForTimeout(BALANCE.weapons.rocket.cooldownMs + 100);
  const scrapAfterFirst = (await debugState(guest)).players.find((player) => player.id === guestPlayer.id)!.scrap;
  for (let attempt = 0; attempt < 3; attempt++) {
    await moveTo(guest, (state) => state.cannons.find((cannon) => cannon.planetId === guestPlanetId)!.position, 3.35, 30);
    await aimAt(guest, (state) => state.planets.find((planet) => planet.id === hostPlanetId)!.position);
    await fireCannon(guest);
    await guest.waitForTimeout(350);
    const currentScrap = (await debugState(guest)).players.find((player) => player.id === guestPlayer.id)!.scrap;
    if (currentScrap < scrapAfterFirst) break;
    await guest.waitForTimeout(BALANCE.weapons.rocket.cooldownMs);
  }
  await expect.poll(async () => (await debugState(guest)).players.find((player) => player.id === guestPlayer.id)!.scrap, { timeout: 3000 }).toBeLessThan(scrapAfterFirst);
  await expect.poll(async () => (await debugState(host)).matchStats.find((stats) => stats.playerId === guestPlayer.id)?.damageDealt ?? 0, { timeout: 5000 }).toBeGreaterThanOrEqual(BALANCE.weapons.rocket.damage * 2);

  await expect(host.locator("#results-screen")).toBeVisible({ timeout: 55_000 });
  await expect(guest.locator("#results-screen")).toBeVisible();
  await expect(host.locator("#results-standings .standing")).toHaveCount(2);
  await expect(host.locator("#results-awards")).toContainText("MENACE");
  await expect(host.locator("#results-awards")).toContainText("SPACE THIEF");
  await expect(host.locator("#progression-reward")).toContainText("XP");
  await expect(host.locator("#winner-copy .result-crowns")).toContainText("♛ 1");
  const winnerPage = (await host.locator("#results-title").textContent())?.includes("You win") ? host : guest;
  await expect(winnerPage.locator("#fallbucks-reward")).toContainText("+100 FALLBUCKS");
  await winnerPage.getByRole("button", { name: "Shop" }).click();
  const solarCard = winnerPage.locator(".shop-item").filter({ hasText: "Solar Gold" });
  await solarCard.getByRole("button", { name: "BUY" }).click();
  await expect(solarCard.getByRole("button", { name: "EQUIP" })).toBeVisible();
  await solarCard.getByRole("button", { name: "EQUIP" }).click();
  await expect(solarCard.getByRole("button", { name: "EQUIPPED" })).toBeVisible();
  await winnerPage.getByRole("button", { name: "Done" }).click();
  await guest.locator("#rematch-button").click();
  await host.locator("#rematch-button").click();
  await expect(host.locator("#lobby-screen")).toBeVisible();
  await expect(host.locator('#player-list .crown-count[title="Session Crowns"]')).toHaveCount(1);
  await expect(host.getByRole("button", { name: "Start" })).toBeEnabled();
  await expect.poll(async () => (await debugState(host)).matchStats.every((stats) => stats.stolenScrap === 0 && stats.successfulShoves === 0 && stats.sabotagesCompleted === 0)).toBe(true);
  expect(browserErrors.flat()).toEqual([]);

  await hostContext.close();
  await guestContext.close();
});

test("the host can start one clearly revealed Chaos modifier", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const browserErrors = [collectBrowserErrors(host), collectBrowserErrors(guest)];
  await Promise.all([host.goto("/"), guest.goto("/")]);
  await host.getByLabel("Name").fill("Vega");
  await host.getByRole("button", { name: "Create Room" }).click();
  await expect(host.locator("#lobby-code")).not.toHaveText("------");
  const code = (await host.locator("#lobby-code").textContent())!;
  await guest.getByLabel("Name").fill("Luna");
  await guest.getByLabel("Room code").fill(code);
  await guest.getByRole("button", { name: "Join Game" }).click();
  await expect(guest.getByRole("heading", { name: "Crew" })).toBeVisible();
  await expect(guest.getByText("Vega")).toBeVisible();
  await host.locator("#mode-chaos").click();
  await expect(host.locator("#mode-chaos")).toHaveClass(/selected/);
  await expect(guest.locator("#mode-chaos")).toBeDisabled();
  await guest.getByRole("button", { name: "Ready" }).click();
  await host.getByRole("button", { name: "Ready" }).click();
  await host.getByRole("button", { name: "Start" }).click();
  await expect(host.locator("#modifier-reveal")).toHaveClass(/visible/);
  await expect(host.locator("#modifier-reveal")).toBeVisible();
  await expect(host.locator("#modifier-chip")).toBeVisible();
  const state = await debugState(host);
  expect(state.gameMode).toBe("chaos");
  expect(state.activeModifier).not.toBeNull();
  await expect(host.locator("#modifier-chip")).toContainText(/LOW GRAVITY|SCRAP RUSH|FRAGILE WORLDS|LAUNCH PARTY|SUPER SHOVE/);
  await expect(host.locator("#timer")).toContainText(":", { timeout: 7000 });
  expect(browserErrors.flat()).toEqual([]);
  await hostContext.close(); await guestContext.close();
});

test("six participants remain readable and within the visual budget", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/");
  await page.getByLabel("Name").fill("Clarity");
  await page.getByRole("button", { name: "Create Room" }).click();
  for (let index = 0; index < 5; index++) await page.getByRole("button", { name: "+ Add Bot" }).click();
  await expect(page.locator("#player-list .player-row")).toHaveCount(6);
  await page.locator("#mode-chaos").click();
  await page.getByRole("button", { name: "Ready" }).click();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#leaderboard-list .bot-badge")).toHaveCount(5);
  await expect(page.locator("#timer")).toContainText(":", { timeout: 7000 });
  await page.waitForTimeout(1000);
  const state = await debugState(page);
  expect(state.players).toHaveLength(6);
  expect(state.planets).toHaveLength(6);
  expect(state.activeModifier).not.toBeNull();
  expect(state.performance.fps).toBeGreaterThan(0);
  expect(state.performance.drawCalls).toBeLessThan(500);
  expect(state.performance.particles).toBeLessThanOrEqual(180);
  expect(browserErrors).toEqual([]);
});

test("solo quick play starts with three clearly marked bots", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  const musicResponse = page.waitForResponse((response) => response.url().endsWith("/audio/bot-city.ogg"));
  await page.goto("/");
  expect((await musicResponse).ok()).toBe(true);
  await page.getByLabel("Name").fill("Chris");
  await page.getByRole("button", { name: "Play Solo" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#leaderboard-list .bot-badge")).toHaveCount(3);
  await expect(page.locator("#countdown")).toContainText(/[123]|GO!/, { timeout: 4000 });
  await expect(page.locator("#timer")).toContainText(":", { timeout: 7000 });
  const metrics = (await debugState(page)).performance;
  expect(metrics.fps).toBeGreaterThan(0);
  expect(metrics.drawCalls).toBeLessThan(500);
  expect(metrics.particles).toBeLessThanOrEqual(180);
  expect(browserErrors).toEqual([]);
});
