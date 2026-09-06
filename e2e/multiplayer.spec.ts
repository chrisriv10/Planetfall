import { expect, test, type Page } from "@playwright/test";

type Point = { x: number; y: number; z: number };
type DebugState = {
  localId: string;
  localPosition: Point;
  cameraForward: Point;
  players: { id: string; planetId: string; surfacePlanetId: string | null; scrap: number; position: Point; velocity: Point }[];
  planets: { id: string; ownerId: string; position: Point; cannonDisabledUntil: number; repairDisabledUntil: number }[];
  scraps: { id: string; planetId: string; position: Point }[];
  launchPads: { planetId: string; position: Point }[];
  cannons: { planetId: string; position: Point }[];
  repairs: { planetId: string; position: Point }[];
};

const debugState = (page: Page) => page.evaluate(() => (window as unknown as { __PLANETFALL_DEBUG__: () => DebugState }).__PLANETFALL_DEBUG__());
const pointDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

async function takeControl(page: Page): Promise<void> {
  const hasControl = () => page.evaluate(() => document.pointerLockElement?.id === "game-canvas");
  if (await hasControl()) return;
  await page.bringToFront();
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.locator("#game-canvas").click({ position: { x: 320, y: 240 } });
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
    const state = await debugState(page);
    if (done(state)) return;
    const target = targetFor(state);
    if (pointDistance(state.localPosition, target) <= tolerance) return;
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
    await page.waitForTimeout(110);
    await page.keyboard.up("w");
  }
  const state = await debugState(page);
  throw new Error(`movement did not reach target; remaining distance ${pointDistance(state.localPosition, targetFor(state)).toFixed(2)} from ${JSON.stringify(state.localPosition)} toward ${JSON.stringify(targetFor(state))}`);
}

test("two players can create, join, ready, and start", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  await Promise.all([host.goto("/"), guest.goto("/")]);

  await host.getByLabel("Name").fill("Nova");
  await expect(host.getByRole("button", { name: "Create Room" })).toBeEnabled();
  await expect(host.getByLabel("Name")).toHaveValue("Nova");
  await host.getByRole("button", { name: "Create Room" }).click();
  await expect(host.getByRole("heading", { name: "Players" })).toBeVisible();
  const code = (await host.locator("#lobby-code").textContent())!;

  await guest.getByLabel("Name").fill("Orbit");
  await guest.getByLabel("Room code").fill(code);
  await guest.getByRole("button", { name: "Join Game" }).click();
  await expect(guest.getByText("Nova")).toBeVisible();

  await guest.getByRole("button", { name: "Ready" }).click();
  await host.getByRole("button", { name: "Ready" }).click();
  await expect(host.getByRole("button", { name: "Start" })).toBeEnabled();
  await host.getByRole("button", { name: "Start" }).click();
  await expect(host.locator("#hud")).toBeVisible();
  await expect(guest.locator("#hud")).toBeVisible();
  await expect(host.locator("#timer")).toContainText(":", { timeout: 7000 });

  await hostContext.close(); await guestContext.close();
});

test("a human can raid, steal, shove, sabotage, and resume cannon play", async ({ browser }) => {
  test.setTimeout(90_000);
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const guestContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  await Promise.all([host.goto("/"), guest.goto("/")]);
  await host.getByLabel("Name").fill("Chris");
  await host.getByRole("button", { name: "Create Room" }).click();
  await expect(host.getByRole("heading", { name: "Players" })).toBeVisible();
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
  await moveTo(host, (state) => state.launchPads.find((pad) => pad.planetId === hostPlanetId)!.position, 2.6);
  await expect(host.locator("#context-prompt")).toContainText("Launch");
  await host.keyboard.press("e");
  await expect(host.locator("#context-prompt")).toContainText("Launch to Nova");
  await host.keyboard.press("e");
  await expect.poll(async () => (await debugState(host)).players.find((player) => player.id === hostPlayer.id)?.surfacePlanetId, { timeout: 7000 }).toBe(guestPlanetId);

  hostState = await debugState(host);
  if ((hostState.players.find((player) => player.id === hostPlayer.id)?.scrap ?? 0) === 20) {
    await moveTo(host, (state) => {
      const scraps = state.scraps.filter((scrap) => scrap.planetId === guestPlanetId);
      return scraps.sort((a, b) => pointDistance(state.localPosition, a.position) - pointDistance(state.localPosition, b.position))[0].position;
    }, 1.45, 75, (state) => (state.players.find((player) => player.id === hostPlayer.id)?.scrap ?? 0) > 20);
  }
  await expect.poll(async () => (await debugState(host)).players.find((player) => player.id === hostPlayer.id)?.scrap ?? 0).toBeGreaterThan(20);

  const neutralPoint = (state: DebugState): Point => {
    const planet = state.planets.find((candidate) => candidate.id === guestPlanetId)!;
    return { x: planet.position.x, y: planet.position.y, z: planet.position.z + 8.95 };
  };
  await moveTo(host, neutralPoint, 1.8);
  await moveTo(guest, (state) => state.players.find((player) => player.id === hostPlayer.id)!.position, 1.75);
  await expect(host.locator("#context-prompt")).toContainText("Shove Nova");
  const guestBeforeShove = (await debugState(guest)).localPosition;
  await host.keyboard.press("e");
  await expect.poll(async () => pointDistance((await debugState(guest)).localPosition, guestBeforeShove), { timeout: 3000 }).toBeGreaterThan(0.7);

  await moveTo(host, (state) => state.repairs.find((repair) => repair.planetId === guestPlanetId)!.position, 2.5);
  await expect(host.locator("#context-prompt")).toContainText("JAM REPAIR CORE");
  await host.keyboard.down("e");
  await host.waitForTimeout(1500);
  await host.keyboard.up("e");
  await expect.poll(async () => (await debugState(host)).planets.find((planet) => planet.id === guestPlanetId)!.repairDisabledUntil, { timeout: 3000 }).toBeGreaterThan(Date.now());

  await moveTo(guest, (state) => state.cannons.find((cannon) => cannon.planetId === guestPlanetId)!.position, 3.7);
  const scrapBeforeFire = (await debugState(guest)).players.find((player) => player.id === guestPlayer.id)!.scrap;
  await guest.locator("#game-canvas").click({ position: { x: 640, y: 360 } });
  await expect.poll(async () => (await debugState(guest)).players.find((player) => player.id === guestPlayer.id)!.scrap, { timeout: 3000 }).toBeLessThan(scrapBeforeFire);

  await hostContext.close();
  await guestContext.close();
});

test("solo quick play starts with three clearly marked bots", async ({ page }) => {
  const musicResponse = page.waitForResponse((response) => response.url().endsWith("/audio/bot-city.ogg"));
  await page.goto("/");
  expect((await musicResponse).ok()).toBe(true);
  await page.getByLabel("Name").fill("Chris");
  await page.getByRole("button", { name: "Play Solo" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#alive-list .bot-badge")).toHaveCount(3);
  await expect(page.locator("#countdown")).toContainText(/[123]|GO!/, { timeout: 4000 });
  await expect(page.locator("#timer")).toContainText(":", { timeout: 7000 });
});
