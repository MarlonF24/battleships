/** Browser acceptance for the restored interface and responsive geometry. */

import { expect, test } from "@playwright/test";

async function openBotPlacement(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Computer" }).click();
  await page.getByRole("button", { name: "Create Game" }).click();
  await expect(page).toHaveURL(/\/matches\/.+\/player\/.+/);
  const viewport = page.viewportSize();
  if (viewport && viewport.width < viewport.height && viewport.width <= 640) {
    await page.setViewportSize({
      width: viewport.height,
      height: viewport.width,
    });
  }
  await expect(
    page.getByRole("grid", { name: "Fleet placement board" }),
  ).toBeVisible();
}

test("creates a bot game and reaches a server-owned target board", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openBotPlacement(page);

  await page.getByRole("button", { name: "Randomize all ships" }).click();
  await page.getByRole("button", { name: /^Ready!/ }).click();
  await page.getByRole("button", { name: "Ready!", exact: true }).click();
  const opponentBoard = page.getByRole("grid", { name: "Opponent board" });
  await expect(opponentBoard).toBeVisible({ timeout: 10_000 });
  await opponentBoard.locator("button:not([disabled])").first().click();

  expect(pageErrors).toEqual([]);
});

test("keeps welcome and placement inside the viewport", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome to Battleship!" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    ),
  ).toBeLessThanOrEqual(0);

  await openBotPlacement(page);
  const board = page.getByRole("grid", { name: "Fleet placement board" });
  const garage = page.getByRole("grid", { name: "Ship garage" });
  const [boardBox, garageBox] = await Promise.all([
    board.boundingBox(),
    garage.boundingBox(),
  ]);
  if (!boardBox || !garageBox) throw new Error("Expected placement geometry.");
  expect(Math.abs(garageBox.y - boardBox.y)).toBeLessThan(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    ),
  ).toBeLessThanOrEqual(0);
});

test("touch pointer dragging places a garage ship on the board", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Uses Chromium touch input.");
  await openBotPlacement(page);
  const board = page.getByRole("grid", { name: "Fleet placement board" });
  const garageShip = page
    .getByRole("grid", { name: "Ship garage" })
    .getByRole("button")
    .first();
  await garageShip.scrollIntoViewIfNeeded();
  const [initialBoardBox, shipBox] = await Promise.all([
    board.boundingBox(),
    garageShip.boundingBox(),
  ]);
  if (!initialBoardBox || !shipBox)
    throw new Error("Expected touch drag targets.");

  // CDP emits genuine touch input, which the browser promotes to Pointer Events.
  const session = await page.context().newCDPSession(page);
  const source = { x: shipBox.x + 10, y: shipBox.y + shipBox.height / 2 };
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [source],
  });
  const rotate = page.getByRole("button", { name: "Rotate" });
  await expect(rotate).toBeVisible();
  await rotate.dispatchEvent("pointerdown", {
    pointerId: 2,
    pointerType: "touch",
    button: 0,
  });
  await page.waitForTimeout(250);
  const rotatedClone = await page.locator(".drag-clone").boundingBox();
  if (!rotatedClone) throw new Error("Expected the rotated drag clone.");
  expect(rotatedClone.height).toBeGreaterThan(rotatedClone.width);

  const boardBox = await board.boundingBox();
  if (!boardBox) throw new Error("Expected the visible placement board.");
  const pointerToCloneCentre = shipBox.x + shipBox.width / 2 - source.x;
  const boardCellSize = (boardBox.width - 4) / 10;
  const target = {
    x: boardBox.x + 2 + boardCellSize * 4.5 - pointerToCloneCentre,
    y: boardBox.y + 2 + boardCellSize * 4.5,
  };
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [target],
  });
  const suggestion = board.locator(".bg-suggestion");
  await expect(suggestion).toBeVisible();
  const [cloneBox, suggestionBox] = await Promise.all([
    page.locator(".drag-clone").boundingBox(),
    suggestion.boundingBox(),
  ]);
  if (!cloneBox || !suggestionBox)
    throw new Error("Expected aligned drag feedback.");
  expect(Math.abs(cloneBox.x - suggestionBox.x)).toBeLessThan(2);
  expect(Math.abs(cloneBox.y - suggestionBox.y)).toBeLessThan(2);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });

  await expect(board.locator("button.legacy-ship")).toHaveCount(1);
});
