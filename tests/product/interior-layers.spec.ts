import { expect, test } from "../support/fixture";
import {
  calls,
  clearCalls,
  commit,
  holdResponse,
  paintedReady,
  releaseResponse,
  screen,
  seedParcels,
  selectObject,
  settled,
  status,
  url,
} from "../support/editor";
import type { Parcel, WorldPoint } from "../../src/atlas/model";

declare global {
  interface Window {
    layerProbe?: ReturnType<typeof import("../support/layerProbe").layerProbe>;
  }
}

function local(parcel: Parcel, x: number, y: number): WorldPoint {
  const c = Math.cos(parcel.frame.angle),
    s = Math.sin(parcel.frame.angle);
  return [
    parcel.frame.x + 5 * (x * c - y * s),
    parcel.frame.y + 5 * (x * s + y * c),
  ];
}

for (const empty of [false, true]) {
  test(`exterior layers suspend in ${empty ? "empty parcel" : "house"} and resume at the new revision`, async ({
    page,
  }) => {
    await page.goto(url);
    const setup = await seedParcels(page, empty);
    const region = await commit(page, {
      type: "regionEdit",
      action: { kind: "create", name: "Testregion", rankId: "builtin-rank-3" },
    });
    expect(region.valid).toBe(true);
    expect(
      (
        await commit(page, {
          type: "regionStroke",
          id: region.regions![0].id,
          points: [
            [0, 30],
            [80, 30],
          ],
          radius: 35,
          erase: false,
        })
      ).valid,
    ).toBe(true);
    expect(
      (
        await commit(page, {
          type: "riverEdit",
          action: {
            kind: "put",
            id: null,
            name: "Testfluss",
            nodes: [
              { id: "", point: [0, 120], width: 20 },
              { id: "", point: [100, 120], width: 20 },
            ],
            settings: {
              tolerance: 0.1,
              roughness: 0.5,
              meander: 40,
              sourceFade: true,
              seed: 1,
            },
            reverse: false,
            automatic: true,
            snap: 0,
          },
          view: { tiles: [[0, 0]], level: 0 },
        })
      ).valid,
    ).toBe(true);
    await page.reload();
    await paintedReady(page);
    await expect
      .poll(async () =>
        (await calls(page, "regions")).some((c) => c.args.bounds === null),
      )
      .toBe(true);
    await expect
      .poll(async () =>
        (await calls(page, "regions")).some((c) => c.args.bounds !== null),
      )
      .toBe(true);
    await expect
      .poll(async () => (await calls(page, "rivers")).length)
      .toBeGreaterThan(0);
    if (!empty) {
      await page.evaluate(async () => {
        const modulePath = "/tests/support/layerProbe.tsx";
        const { layerProbe } = await import(/* @vite-ignore */ modulePath);
        window.layerProbe = layerProbe(await window.atlasCore("status", {}));
        window.layerProbe!.render(true);
      });
      await expect
        .poll(() =>
          page.evaluate(() => {
            const { regions, rivers } = window.layerProbe!.snapshot();
            return (
              regions.fresh &&
              rivers.fresh &&
              regions.regions.length > 0 &&
              rivers.views.length > 0
            );
          }),
        )
        .toBe(true);
      await page.evaluate(() => window.layerProbe!.render(true, true));
      await expect
        .poll(() =>
          page.evaluate(() => window.layerProbe!.snapshot().regions.fresh),
        )
        .toBe(true);
      await page.evaluate(
        (id) => window.layerProbe!.snapshot().regions.select(id),
        region.regions![0].id,
      );
      await expect
        .poll(() =>
          page.evaluate(() => window.layerProbe!.snapshot().regions.selected),
        )
        .toBe(region.regions![0].id);
      await expect
        .poll(() =>
          page.evaluate(() => window.layerProbe!.snapshot().regions.fresh),
        )
        .toBe(true);
      await page.evaluate(() => window.layerProbe!.render(false));
      await expect
        .poll(() =>
          page.evaluate(() => {
            const { regions, rivers } = window.layerProbe!.snapshot();
            return (
              !regions.fresh &&
              !rivers.fresh &&
              !regions.error &&
              !rivers.error &&
              !regions.regions.length &&
              !regions.summaries.length &&
              !regions.markerRanks.length &&
              !rivers.views.length &&
              !rivers.handles.length
            );
          }),
        )
        .toBe(true);
      const count = await page.evaluate(
        () => window.layerProbe!.requests.length,
      );
      await page.evaluate(() => window.layerProbe!.render(true, true));
      await expect
        .poll(() =>
          page.evaluate(() => {
            const { regions, rivers } = window.layerProbe!.snapshot();
            return regions.fresh && rivers.fresh && regions.selected;
          }),
        )
        .toBe(region.regions![0].id);
      expect(
        await page.evaluate(() => window.layerProbe!.requests.length),
      ).toBe(count);
      await page.evaluate(() => window.layerProbe!.render(false));
      await expect
        .poll(() =>
          page.evaluate(() => !window.layerProbe!.snapshot().regions.fresh),
        )
        .toBe(true);
      await page.evaluate(async () => {
        const { regions, rivers } = window.layerProbe!.snapshot();
        regions.retry();
        rivers.retry();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      });
      expect(
        await page.evaluate(() => window.layerProbe!.requests.length),
      ).toBe(count);
      await page.evaluate(() => window.layerProbe!.render(true, true));
      await expect
        .poll(() =>
          page.evaluate(() => window.layerProbe!.snapshot().regions.selected),
        )
        .toBe(region.regions![0].id);
      await page.evaluate(() => window.layerProbe!.close());
    }
    await selectObject(page, empty ? "▱ Parzelle" : `⌂ ${setup.house.name}`);
    await page
      .getByRole("button", {
        name: empty ? "Parzelle öffnen" : "Innen öffnen",
        exact: true,
      })
      .click();
    await paintedReady(page);
    await settled(page);
    await clearCalls(page);
    const canvas = page.getByTestId("atlas-canvas"),
      box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    await paintedReady(page);
    const beforePan = await screen(page, [0, 0]);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(
      box.x + box.width / 2 + 40,
      box.y + box.height / 2 + 20,
    );
    await page.mouse.up({ button: "middle" });
    await paintedReady(page);
    expect(await screen(page, [0, 0])).not.toEqual(beforePan);
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await paintedReady(page);
    if (!empty) {
      await page.getByLabel("Geschoss", { exact: true }).fill("-1");
      await page.getByLabel("Geschoss", { exact: true }).press("Enter");
      await paintedReady(page);
    }
    const before = (await status(page)).revision;
    await page.getByRole("button", { name: "Raum", exact: true }).click();
    await paintedReady(page);
    const start = await screen(page, local(setup.parcel, -3.8, 1.2));
    const end = await screen(page, local(setup.parcel, -2.8, 2.2));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 3 });
    await page.mouse.up();
    await expect
      .poll(async () => (await status(page)).revision)
      .toBeGreaterThan(before);
    await settled(page);
    expect(await calls(page, "regions")).toEqual([]);
    expect(await calls(page, "rivers")).toEqual([]);
    await page
      .getByRole("button", { name: "Zur Atlasansicht", exact: true })
      .click();
    await paintedReady(page);
    await expect
      .poll(async () =>
        (await calls(page, "regions")).some(
          (c) => c.args.version.revision > before,
        ),
      )
      .toBe(true);
    await expect
      .poll(async () =>
        (await calls(page, "rivers")).some(
          (c) => c.args.version.revision > before,
        ),
      )
      .toBe(true);
    if (!empty) {
      await page.evaluate(async () => {
        const modulePath = "/tests/support/layerProbe.tsx";
        const { layerProbe } = await import(/* @vite-ignore */ modulePath);
        window.layerProbe = layerProbe(await window.atlasCore("status", {}));
        window.layerProbe!.render(true);
      });
      await expect
        .poll(() =>
          page.evaluate(() => {
            const { regions, rivers } = window.layerProbe!.snapshot();
            return (
              regions.fresh &&
              rivers.fresh &&
              regions.regions.length > 0 &&
              rivers.views.length > 0
            );
          }),
        )
        .toBe(true);
      await page.evaluate(() => window.layerProbe!.close());
    }
  });
}

test("a held exterior river response cannot restart reads inside", async ({
  page,
}) => {
  await page.goto(url);
  const setup = await seedParcels(page);
  await page.reload();
  await paintedReady(page);
  await selectObject(page, `⌂ ${setup.house.name}`);
  await holdResponse(page, "rivers");
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 800);
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await page.getByRole("button", { name: "Innen öffnen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Zur Atlasansicht", exact: true }),
  ).toBeVisible();
  await clearCalls(page);
  await releaseResponse(page);
  await expect.poll(() => page.evaluate(() => window.atlasPending)).toBe(0);
  expect(await calls(page, "regions")).toEqual([]);
  expect(await calls(page, "rivers")).toEqual([]);
});
