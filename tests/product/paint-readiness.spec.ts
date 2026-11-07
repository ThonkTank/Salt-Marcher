import { test, expect } from "../support/fixture";
import { dataReady, paintedReady, writesSettled, url } from "../support/editor";

test("data and writes can be ready while a concrete camera generation is still unpainted", async ({
  page,
}) => {
  await page.goto(url);
  await paintedReady(page);
  const before = await page.evaluate(() => window.atlasPaint!);
  const scale = () =>
    page
      .getByTestId("atlas-canvas")
      .evaluate(
        (canvas: HTMLCanvasElement) =>
          canvas.getContext("2d")!.getTransform().a,
      );
  const priorScale = await scale();
  await page.evaluate(() => {
    const request = window.requestAnimationFrame,
      cancel = window.cancelAnimationFrame;
    const held = new Map<number, FrameRequestCallback>();
    window.requestAnimationFrame = (callback) => {
      const id = request(() => held.set(id, callback));
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      held.delete(id);
      cancel(id);
    };
    Object.assign(window, {
      releasePaint: () => {
        window.requestAnimationFrame = request;
        window.cancelAnimationFrame = cancel;
        for (const callback of held.values()) callback(performance.now());
        held.clear();
      },
    });
  });
  await page.getByTestId("atlas-canvas").dispatchEvent("wheel", {
    deltaY: -200,
    clientX: 600,
    clientY: 400,
  });
  await expect
    .poll(() => page.evaluate(() => window.atlasPaint!.cameraGeneration))
    .toBeGreaterThan(before.cameraGeneration);
  await dataReady(page);
  await writesSettled(page);
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  expect(await scale()).toBe(priorScale);
  const target = await page.evaluate(() => window.atlasPaint!);
  expect(target.base.painted).not.toBe(target.base.requested);
  expect(target.overlay.painted).not.toBe(target.overlay.requested);
  await page.evaluate(() =>
    (window as unknown as { releasePaint: () => void }).releasePaint(),
  );
  await paintedReady(page, target);
  expect(await scale()).not.toBe(priorScale);
  const after = await page.evaluate(() => window.atlasPaint!);
  expect(after.version).toEqual(before.version);
  expect(after.cameraGeneration).toBe(target.cameraGeneration);
  await page.evaluate(() => window.atlasUnmount!());
  await expect.poll(() => page.evaluate(() => window.atlasPaint)).toBeNull();
  await page.evaluate(() => window.atlasRemount!());
  await paintedReady(page);
  expect((await page.evaluate(() => window.atlasPaint!)).mount).not.toBe(
    before.mount,
  );
});

test("write completion remains observable after unmount while a response is held", async ({
  page,
}) => {
  await page.goto(url);
  await paintedReady(page);
  await page.getByRole("button", { name: "Höhen", exact: true }).click();
  await paintedReady(page);
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.evaluate(() => {
    window.atlasHold = { cmd: "beginTerrainStroke" };
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => page.evaluate(() => window.atlasHeld)).toBe(true);
  await page.evaluate(() => window.atlasUnmount!());
  await expect.poll(() => page.evaluate(() => window.atlasPaint)).toBeNull();
  expect(await page.evaluate(() => window.atlasWritesIdle())).toBe(false);
  await page.evaluate(() => window.atlasRelease!());
  await writesSettled(page);
  await page.mouse.up();
  await page.evaluate(() => window.atlasRemount!());
  await paintedReady(page);
  expect(
    await page.evaluate(() => window.atlasPaint!.version!.revision),
  ).toBeGreaterThan(0);
});
