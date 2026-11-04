import { expect, test } from "../support/fixture";

async function house(page: import("@playwright/test").Page) {
  await page.goto("http://127.0.0.1:1420/tests/support/atlas.html");
  await page.evaluate(async () =>
    window.atlasCore("commit", {
      version: await window.atlasCore("status", {}),
      intent: {
        type: "createHouse",
        parcelId: null,
        transform: { x: 0, y: 0, angle: 0 },
        width: 8,
        depth: 8,
      },
    }),
  );
  await page.reload();
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
}
test("Fit loading tracks its extent read", async ({ page }) => {
  await house(page);
  await page.evaluate(() => {
    window.atlasHold = { cmd: "extent" };
  });
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.atlasHeld)).toBe(true);
  const loading = page.getByText("Ansicht wird geladen …");
  await expect(loading).toBeVisible();
  expect(await loading.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe(
    "none",
  );
  await page.evaluate(() => window.atlasRelease?.());
  await expect.poll(() => page.evaluate(() => window.atlasHeld)).toBe(false);
  await expect(loading).toHaveCount(0);
});
test("superseded Fit cannot override wheel", async ({ page }) => {
  await house(page);
  await page.evaluate(() => {
    window.atlasHold = { cmd: "extent" };
  });
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.atlasHeld)).toBe(true);
  await page.getByTestId("atlas-canvas").hover();
  const before = await page.locator(".atlas-navigation>span").textContent();
  await page.mouse.wheel(0, 120);
  await expect(page.locator(".atlas-navigation>span")).not.toHaveText(before!);
  const wheel = await page.locator(".atlas-navigation>span").textContent();
  await page.evaluate(() => window.atlasRelease?.());
  await expect(page.locator(".atlas-navigation>span")).toHaveText(wheel!);
});
test("two Fits retain the newer target when the old extent returns", async ({
  page,
}) => {
  await house(page);
  await page.evaluate(() => {
    window.atlasHold = { cmd: "extent" };
  });
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.atlasHeld)).toBe(true);
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  await page.evaluate(() => window.atlasRelease?.());
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
});
test("camera-only changes render without a paint acknowledgement", async ({
  page,
}) => {
  await house(page);
  await page.getByTestId("atlas-canvas").hover();
  await page.mouse.wheel(0, 120);
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
});
test("empty or failed extent ends Fit loading", async ({ page }) => {
  await house(page);
  await page.evaluate(() => {
    const original = window.atlasCore;
    window.atlasCore = async <T>(cmd: string, args: Record<string, unknown>) =>
      cmd === "extent" ? (null as T) : original<T>(cmd, args);
  });
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await page.evaluate(() => {
    const original = window.atlasCore;
    window.atlasCore = async <T>(
      cmd: string,
      args: Record<string, unknown>,
    ) => {
      if (cmd === "extent") throw Error("held-extent-error");
      return original<T>(cmd, args);
    };
  });
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  await expect(page.getByText(/held-extent-error/)).toBeVisible();
});
test("document replacement supersedes a held Fit", async ({ page }) => {
  await house(page);
  const oldSession = await page.evaluate(
    async () =>
      (
        await window.atlasCore<import("../../src/atlas/model").Status>(
          "status",
          {},
        )
      ).sessionId,
  );
  await page.evaluate(() => {
    const original = window.atlasCore;
    (window as any).readinessScenes = [];
    window.atlasCore = async <T>(
      cmd: string,
      args: Record<string, unknown>,
    ) => {
      const result = await original<T>(cmd, args);
      if (cmd === "scene") (window as any).readinessScenes.push(result);
      if (cmd === "extent") (window as any).heldFitExtent = result;
      return result;
    };
    window.atlasCalls = [];
    window.atlasHold = { cmd: "extent" };
  });
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.atlasHeld)).toBe(true);
  expect(
    await page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "extent").length,
    ),
  ).toBe(1);
  expect(await page.evaluate(() => (window as any).heldFitExtent)).toEqual([
    0, 0, 40, 40,
  ]);
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  await page.getByRole("button", { name: "Verwerfen", exact: true }).click();
  await expect
    .poll(async () =>
      page.evaluate(
        async () =>
          (
            await window.atlasCore<import("../../src/atlas/model").Status>(
              "status",
              {},
            )
          ).sessionId,
      ),
    )
    .not.toBe(oldSession);
  const replacement = await page.evaluate(
    async () =>
      (
        await window.atlasCore<import("../../src/atlas/model").Status>(
          "status",
          {},
        )
      ).sessionId,
  );
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          (window as any).readinessScenes.some(
            (scene: import("../../src/atlas/model").Scene) =>
              scene.status.sessionId === id,
          ),
        replacement,
      ),
    )
    .toBe(true);
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  expect(await page.evaluate(() => window.atlasHeld)).toBe(true);
  const camera = await page.locator(".atlas-navigation>span").textContent();
  const before = await page.getByTestId("atlas-canvas").screenshot();
  await page.evaluate(() => window.atlasRelease?.());
  await expect.poll(() => page.evaluate(() => window.atlasHeld)).toBe(false);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await expect(page.locator(".atlas-navigation>span")).toHaveText(camera!);
  expect(await page.getByTestId("atlas-canvas").screenshot()).toEqual(before);
});
