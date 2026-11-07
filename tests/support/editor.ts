import type { CanvasPaintState } from "../../src/atlas/canvasPaintState";
import { expect, type Page } from "@playwright/test";
import type {
  House,
  Intent,
  Parcel,
  Road,
  WorldPoint,
} from "../../src/atlas/model";
import type { BrowserCall, BrowserCommand } from "./browserContract";

export { editorUrl as url } from "./browserServer";

/** Current editable data, independent of whether Canvas has drawn it yet. */
export async function dataReady(page: Page) {
  await expect(page.getByTestId("atlas-canvas")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.atlasPaint?.dataReady ?? false))
    .toBe(true);
}
/** Compatibility name for data readiness; visual observations use paintedReady. */
export const ready = dataReady;
export async function writesSettled(page: Page) {
  await expect
    .poll(() => page.evaluate(() => window.atlasWritesIdle()))
    .toBe(true);
}
/** Wait for both actual draws of the current (or explicitly captured) generation. */
export async function paintedReady(page: Page, target?: CanvasPaintState) {
  await dataReady(page);
  await waitForPaint(page, target, true);
}
/** Actual drawings, including intentionally stale presentation during a held read. */
export async function drawn(page: Page, target?: CanvasPaintState) {
  await waitForPaint(page, target, false);
}
async function waitForPaint(
  page: Page,
  target: CanvasPaintState | undefined,
  currentData: boolean,
) {
  await expect
    .poll(() =>
      page.evaluate(
        ({ target, currentData }) => {
          const state = window.atlasPaint;
          return (
            !!state?.version &&
            (!currentData || state.dataReady) &&
            state.base.requested === state.base.painted &&
            state.overlay.requested === state.overlay.painted &&
            (!target ||
              (state.mount === target.mount &&
                state.version.sessionId === target.version?.sessionId &&
                state.version.revision === target.version?.revision &&
                state.presentationGeneration ===
                  target.presentationGeneration &&
                state.cameraGeneration === target.cameraGeneration &&
                state.base.painted >= target.base.requested &&
                state.overlay.painted >= target.overlay.requested))
          );
        },
        { target, currentData },
      ),
    )
    .toBe(true);
}
export async function settled(page: Page) {
  await writesSettled(page);
  await expect(
    page.getByText(/Vorschau wird aktualisiert|Änderung wird übernommen/),
  ).toHaveCount(0);
  await dataReady(page);
}
export function status(page: Page) {
  return page.evaluate(() => window.atlasCore("status", {}));
}
export function scene(page: Page) {
  return page.evaluate(() =>
    window.atlasCore("scene", {
      context: { kind: "exterior" },
      bounds: [-10000, -10000, 10000, 10000],
    }),
  );
}
export function commit(page: Page, intent: Intent) {
  return page.evaluate(
    async (intent) =>
      window.atlasCore("commit", {
        version: await window.atlasCore("status", {}),
        intent,
      }),
    intent,
  );
}
export function history(page: Page, redo = false) {
  return page.evaluate(
    async (redo) =>
      window.atlasCore("history", {
        version: await window.atlasCore("status", {}),
        redo,
      }),
    redo,
  );
}
export function metadata(page: Page, buildingId: string) {
  return page.evaluate(
    (buildingId) => window.atlasCore("interiorMetadata", { buildingId }),
    buildingId,
  );
}
export function tile(
  page: Page,
  buildingId: string,
  floor = 0,
  bounds: import("../../src/atlas/model").Bounds = [-2, -2, 140, 140],
) {
  return page.evaluate(
    ({ buildingId, floor, bounds }) =>
      window.atlasCore("interiorTile", {
        buildingId,
        floor,
        bounds,
        includeLower: true,
      }),
    { buildingId, floor, bounds },
  );
}
export function calls<K extends BrowserCommand>(
  page: Page,
  cmd: K,
): Promise<BrowserCall<K>[]> {
  return page.evaluate(
    (cmd) => window.atlasCalls.filter((c) => c.cmd === cmd) as BrowserCall<K>[],
    cmd,
  );
}
export function clearCalls(page: Page) {
  return page.evaluate(() => {
    window.atlasCalls = [];
  });
}
export async function screen(
  page: Page,
  p: WorldPoint,
  data: "current" | "displayed" = "current",
) {
  if (data === "current") await paintedReady(page);
  else await drawn(page);
  const canvas = page.getByTestId("atlas-canvas"),
    box = (await canvas.boundingBox())!;
  const camera = await canvas.evaluate((c: HTMLCanvasElement) => {
    const t = c.getContext("2d")!.getTransform(),
      d = devicePixelRatio || 1;
    return { x: t.e / d, y: t.f / d, scale: t.a / d };
  });
  return {
    x: box.x + camera.x + p[0] * camera.scale,
    y: box.y + camera.y + p[1] * camera.scale,
  };
}
export async function clickWorld(page: Page, p: WorldPoint) {
  const q = await screen(page, p);
  await page.mouse.click(q.x, q.y);
}
export async function dragWorld(
  page: Page,
  a: WorldPoint,
  b: WorldPoint,
  release = true,
) {
  const start = await screen(page, a),
    end = await screen(page, b);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  if (release) await page.mouse.up();
}
export function rectangle(
  width: number,
  depth: number,
  x = 0,
  y = 0,
): [number, number][] {
  return Array.from({ length: width * depth }, (_, i) => [
    x + (i % width),
    y + Math.floor(i / width),
  ]);
}
export async function seedHouse(
  page: Page,
  width = 8,
  depth = 8,
  floors: number[] = [0, 1],
  x = 0,
) {
  const result = await commit(page, {
    type: "createHouse",
    parcelId: null,
    transform: { x, y: 0, angle: 0 },
    width,
    depth,
  });
  const house = result.objects.find((o): o is House => o.kind === "house")!;
  for (const floor of floors.filter((f) => f !== 0))
    await commit(page, {
      type: "room",
      buildingId: house.id,
      intent: { kind: "draw", floor, cells: rectangle(width, depth) },
    });
  return house;
}
export async function openHouse(page: Page, house: House) {
  await page.reload();
  await ready(page);
  await selectObject(page, `⌂ ${house.name}`);
  await page.getByRole("button", { name: "Innen öffnen", exact: true }).click();
  await ready(page);
}
export const population = {
  side: "right" as const,
  setback: 5,
  gap: 10,
  minWidth: 4,
  maxWidth: 4,
  minDepth: 4,
  maxDepth: 4,
  parcelDepth: 40,
  seed: 1,
};
export async function seedRoad(page: Page, populated = true, length = 80) {
  const result = await commit(page, {
    type: "createRoad",
    road: {
      name: "Testweg",
      width: 10,
      material: "earth",
      nodes: [
        { point: [0, 0], incoming: null, outgoing: null },
        { point: [length, 0], incoming: null, outgoing: null },
      ],
    },
    population: populated ? population : null,
  });
  return result.objects.find((o): o is Road => o.kind === "road")!;
}
export async function holdResponse(page: Page, cmd: string, floor?: number) {
  await page.evaluate(
    ({ cmd, floor }) => {
      window.atlasHeld = false;
      window.atlasHold = { cmd, floor };
    },
    { cmd, floor },
  );
}
export function releaseResponse(page: Page) {
  return page.evaluate(() => window.atlasRelease?.());
}
export async function authorSnapshot(
  page: Page,
  houseId: string,
  floors = [-1, 0, 1],
) {
  const view = await scene(page),
    meta = await metadata(page, houseId);
  const cells = [];
  for (const floor of floors)
    cells.push({ floor, cells: (await tile(page, houseId, floor)).cells });
  return {
    objects: view.objects,
    rooms: meta.rooms,
    connections: meta.connections,
    cells,
  };
}
export async function selectRoom(
  page: Page,
  houseId: string,
  floor = 0,
  index = 0,
) {
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  const room = (await metadata(page, houseId)).rooms.filter(
    (r) => r.floor === floor,
  )[index];
  await page
    .getByRole("button", {
      name: `${room.name} · G ${room.floor}`,
      exact: true,
    })
    .click();
  await ready(page);
  return room;
}
export async function setFloor(page: Page, floor: number) {
  await page.getByLabel("Geschoss", { exact: true }).fill(String(floor));
  await page.getByLabel("Geschoss", { exact: true }).blur();
  await ready(page);
}

export async function seedParcels(page: Page, empty = false, offset = 0) {
  return page.evaluate(
    async ({ empty, offset }) => {
      const result = await window.atlasCore("commit", {
        version: await window.atlasCore("status", {}),
        intent: {
          type: "createRoad",
          road: {
            name: "Teststraße",
            width: 10,
            material: "earth",
            nodes: [
              { point: [offset, 0], incoming: null, outgoing: null },
              {
                point: [offset + 80, 0],
                incoming: null,
                outgoing: null,
              },
            ],
          },
          population: {
            side: "right",
            setback: 5,
            gap: 10,
            minWidth: 8,
            maxWidth: 8,
            minDepth: 8,
            maxDepth: 8,
            seed: 1,
            parcelDepth: 100,
          },
        },
      });
      const parcel = result.objects.find(
        (o): o is Parcel => o.kind === "parcel",
      )!;
      const house = result.objects.find((o): o is House => o.kind === "house")!;
      if (empty)
        await window.atlasCore("commit", {
          version: await window.atlasCore("status", {}),
          intent: { type: "delete", id: house.id },
        });
      return {
        parcel,
        house,
        status: await window.atlasCore("status", {}),
      };
    },
    { empty, offset },
  );
}

export async function showObjects(page: Page) {
  await expect(page.getByTestId("atlas-canvas")).toBeVisible();
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await ready(page);
  const drawer = page.locator(".atlas-object-drawer");
  if ((await drawer.count()) && (await drawer.getAttribute("open")) === null)
    await drawer.locator("summary").first().click();
  const list = page.locator(".atlas-object-list");
  if ((await list.count()) && (await list.getAttribute("open")) === null)
    await list.locator("summary").first().click();
}
export async function selectObject(page: Page, name: string | RegExp) {
  await showObjects(page);
  await page
    .getByRole("button", { name, exact: typeof name === "string" })
    .click();
}
export async function finishRoad(page: Page) {
  const q = await screen(page, [0, 0]);
  await page.mouse.click(q.x, q.y, { button: "right" });
}
export async function populationDetails(page: Page) {
  const details = page.locator(".atlas-population-details");
  if ((await details.getAttribute("open")) === null)
    await details.locator("summary").first().click();
}
