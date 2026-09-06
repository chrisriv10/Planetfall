import { expect, test } from "@playwright/test";

test("two players can create, join, ready, and launch", async ({ browser }) => {
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
